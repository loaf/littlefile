use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportOptions {
    pub file_ids: Vec<i64>,
    pub target_dir: String,
    pub encoding: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportProgress {
    pub total: usize,
    pub completed: usize,
    pub current_file: String,
}

#[tauri::command]
pub async fn export_files(
    options: ExportOptions,
    #[allow(unused_variables)]
    state: tauri::State<'_, crate::AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let total = options.file_ids.len();
    let dir = std::path::PathBuf::from(&options.target_dir);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create directory: {e}"))?;

    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut completed: usize = 0;
        for &file_id in &options.file_ids {
            let app_state = app_clone.state::<crate::AppState>();
            let result = (|| -> Result<String, String> {
                let guard = app_state.db.lock().map_err(|e| format!("{e}"))?;
                let conn = guard.as_ref().ok_or("No database open")?;
                let (filename, content_blob, encoding): (String, Vec<u8>, String) = conn
                    .query_row(
                        "SELECT filename, content, encoding FROM files WHERE id = ?1",
                        params![file_id],
                        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                    )
                    .map_err(|e| format!("Query failed: {e}"))?;
                let text = crate::services::compression::decompress_zlib(&content_blob)?;
                let bytes = if options.encoding == "original" {
                    crate::services::encoding::encode_to(&text, &encoding)?
                } else {
                    text.into_bytes()
                };
                let file_path = dir.join(&filename);
                std::fs::write(&file_path, &bytes).map_err(|e| format!("Write failed: {e}"))?;
                Ok(filename)
            })();

            match result {
                Ok(filename) => {
                    completed += 1;
                    let _ = app_clone.emit(
                        "export:progress",
                        ExportProgress {
                            total,
                            completed,
                            current_file: filename,
                        },
                    );
                }
                Err(_) => {
                    // Skip failed files, continue with next
                    completed += 1;
                }
            }
        }
        let _ = app_clone.emit("export:complete", ());
    });

    Ok(())
}
