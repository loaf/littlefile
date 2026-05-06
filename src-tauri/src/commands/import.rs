use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::time::Duration;
use tauri::{Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub file_count: usize,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportOptions {
    pub batch_size: usize,
    pub dedup_strategy: String,
    pub delete_after_import: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportProgress {
    pub total: usize,
    pub completed: usize,
    pub current_file: String,
    pub elapsed_secs: f64,
    pub estimated_remaining_secs: f64,
    pub paused: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportErrorItem {
    pub file: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportSummary {
    pub total: usize,
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<ImportErrorItem>,
}

fn collect_txt_files(dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory '{}': {e}", dir.display()))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
        let path = entry.path();
        if path.is_dir() {
            collect_txt_files(&path, files)?;
        } else if path
            .extension()
            .map(|ext| ext.eq_ignore_ascii_case("txt"))
            .unwrap_or(false)
        {
            files.push(path);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn scan_import_path(path: String) -> Result<ScanResult, String> {
    let dir = Path::new(&path);
    if !dir.exists() {
        return Err(format!("Path does not exist: {path}"));
    }
    if !dir.is_dir() {
        return Err(format!("Path is not a directory: {path}"));
    }

    let mut files = Vec::new();
    collect_txt_files(dir, &mut files)?;

    let mut total_size: u64 = 0;
    for f in &files {
        total_size += std::fs::metadata(f)
            .map_err(|e| format!("Failed to read file size: {e}"))?
            .len();
    }

    Ok(ScanResult {
        file_count: files.len(),
        total_size,
    })
}

#[tauri::command]
pub async fn start_import(
    path: String,
    options: ImportOptions,
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    state.import.paused.store(false, Ordering::SeqCst);
    state.import.cancelled.store(false, Ordering::SeqCst);

    let dir = Path::new(&path);
    let mut files = Vec::new();
    collect_txt_files(dir, &mut files)?;

    let total = files.len();
    let paused = state.import.paused.clone();
    let cancelled = state.import.cancelled.clone();
    let running = state.import.running.clone();
    let app_clone = app.clone();

    state.import.running.store(true, Ordering::SeqCst);

    std::thread::spawn(move || {
        import_worker(files, options, total, app_clone, paused, cancelled, running);
    });

    Ok(())
}

fn import_worker(
    files: Vec<PathBuf>,
    options: ImportOptions,
    total: usize,
    app: tauri::AppHandle,
    paused: Arc<AtomicBool>,
    cancelled: Arc<AtomicBool>,
    running: Arc<AtomicBool>,
) {
    let start = std::time::Instant::now();
    let mut completed: usize = 0;
    let mut skipped: usize = 0;
    let mut errors: Vec<ImportErrorItem> = Vec::new();

    for file_path in &files {
        if cancelled.load(Ordering::SeqCst) {
            break;
        }
        while paused.load(Ordering::SeqCst) && !cancelled.load(Ordering::SeqCst) {
            std::thread::sleep(Duration::from_millis(100));
        }
        if cancelled.load(Ordering::SeqCst) {
            break;
        }

        match process_file(file_path, &options, &app) {
            Ok(was_skipped) => {
                if was_skipped {
                    skipped += 1;
                }
                completed += 1;
            }
            Err(err_msg) => {
                let _ = app.emit(
                    "import:error",
                    ImportErrorItem {
                        file: file_path.to_string_lossy().to_string(),
                        error: err_msg.clone(),
                    },
                );
                errors.push(ImportErrorItem {
                    file: file_path.to_string_lossy().to_string(),
                    error: err_msg,
                });
                if options.dedup_strategy == "error" {
                    break;
                }
                completed += 1;
            }
        }

        if completed > 0 && completed % options.batch_size == 0 {
            let elapsed = start.elapsed().as_secs_f64();
            let estimated_remaining = if completed > 0 {
                (elapsed / completed as f64) * (total - completed) as f64
            } else {
                0.0
            };
            let _ = app.emit(
                "import:progress",
                ImportProgress {
                    total,
                    completed,
                    current_file: file_path.to_string_lossy().to_string(),
                    elapsed_secs: elapsed,
                    estimated_remaining_secs: estimated_remaining,
                    paused: paused.load(Ordering::SeqCst),
                },
            );
        }
    }

    let _ = app.emit(
        "import:complete",
        ImportSummary {
            total,
            imported: completed,
            skipped,
            errors,
        },
    );

    paused.store(false, Ordering::SeqCst);
    cancelled.store(false, Ordering::SeqCst);
    running.store(false, Ordering::SeqCst);
}

fn process_file(
    file_path: &Path,
    options: &ImportOptions,
    app: &tauri::AppHandle,
) -> Result<bool, String> {
    let bytes = std::fs::read(file_path)
        .map_err(|e| format!("Failed to read file '{}': {e}", file_path.display()))?;

    let encoding_name = crate::services::encoding::detect_encoding(file_path)?;

    let enc = encoding_rs::Encoding::for_label(encoding_name.as_bytes())
        .unwrap_or(encoding_rs::UTF_8);
    let (text, _, _) = enc.decode(&bytes);
    let text = text.into_owned();

    let sha256 = crate::services::hashing::sha256_hex(&bytes);

    let compressed = crate::services::compression::compress_zlib(text.as_bytes())?;

    let app_state = app.state::<crate::AppState>();
    let conn_guard = app_state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM files WHERE sha256 = ?1",
            [&sha256],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to query duplicate: {e}"))?;

    if count > 0 {
        match options.dedup_strategy.as_str() {
            "skip" => return Ok(true),
            "overwrite" => {
                conn.execute("DELETE FROM files WHERE sha256 = ?1", [&sha256])
                    .map_err(|e| format!("Failed to delete existing record: {e}"))?;
            }
            "error" => {
                return Err(format!(
                    "Duplicate file detected: {}",
                    file_path.display()
                ));
            }
            _ => return Ok(true),
        }
    }

    let filename = file_path
        .file_name()
        .ok_or_else(|| format!("Failed to get filename from '{}'", file_path.display()))?
        .to_string_lossy()
        .to_string();
    let original_path = file_path.to_string_lossy().to_string();
    let original_size = bytes.len() as i64;

    conn.execute(
        "INSERT INTO files (filename, author, original_path, size, compressed_size, encoding, description, content, sha256) VALUES (?1, '', ?2, ?3, ?4, ?5, '', ?6, ?7)",
        params![filename, original_path, original_size, compressed.len() as i64, encoding_name, compressed, sha256],
    )
    .map_err(|e| format!("Failed to insert file record: {e}"))?;

    if options.delete_after_import {
        std::fs::remove_file(file_path).ok();
    }

    Ok(false)
}

#[tauri::command]
pub fn pause_import(state: tauri::State<'_, crate::AppState>) -> Result<(), String> {
    state
        .import
        .paused
        .store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn resume_import(state: tauri::State<'_, crate::AppState>) -> Result<(), String> {
    state
        .import
        .paused
        .store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn cancel_import(state: tauri::State<'_, crate::AppState>) -> Result<(), String> {
    state
        .import
        .cancelled
        .store(true, Ordering::SeqCst);
    state
        .import
        .paused
        .store(false, Ordering::SeqCst);
    Ok(())
}
