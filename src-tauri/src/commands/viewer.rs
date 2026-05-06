use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileReadingData {
    pub id: i64,
    pub content: String,
    pub encoding: String,
    pub filename: String,
    pub author: String,
    pub last_read_line: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingProgress {
    pub id: i64,
    pub last_read_line: i64,
    pub is_read: bool,
}

#[tauri::command]
pub fn get_file_content_for_reading(
    id: i64,
    state: tauri::State<'_, crate::AppState>,
) -> Result<FileReadingData, String> {
    let conn_guard = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    let result = conn
        .query_row(
            "SELECT id, content, encoding, filename, author, last_read_line FROM files WHERE id = ?1",
            params![id],
            |row| {
                let content_blob: Vec<u8> = row.get("content")?;
                let encoding: String = row.get("encoding")?;
                let filename: String = row.get("filename")?;
                let author: String = row.get("author")?;
                let last_read_line: i64 = row.get("last_read_line")?;
                Ok((content_blob, encoding, filename, author, last_read_line))
            },
        )
        .map_err(|e| format!("Failed to query file: {e}"))?;

    let (content_blob, encoding, filename, author, last_read_line) = result;
    let content =
        crate::services::compression::decompress_zlib(&content_blob)?;

    Ok(FileReadingData {
        id,
        content,
        encoding,
        filename,
        author,
        last_read_line,
    })
}

#[tauri::command]
pub fn save_reading_progress(
    id: i64,
    last_read_line: i64,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let conn_guard = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    conn.execute(
        "UPDATE files SET last_read_line = ?1, updated_at = strftime('%Y-%m-%d %H:%M:%S', 'now') WHERE id = ?2",
        params![last_read_line, id],
    )
    .map_err(|e| format!("Failed to save reading progress: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn get_file_preview(
    id: i64,
    lines: i64,
    state: tauri::State<'_, crate::AppState>,
) -> Result<String, String> {
    let conn_guard = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    let content_blob: Vec<u8> = conn
        .query_row(
            "SELECT content FROM files WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to query file content: {e}"))?;

    let content = crate::services::compression::decompress_zlib(&content_blob)?;

    let preview: String = content
        .split('\n')
        .take(lines as usize)
        .collect::<Vec<&str>>()
        .join("\n");

    Ok(preview)
}

#[tauri::command]
pub fn mark_as_read(
    id: i64,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let conn_guard = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    conn.execute(
        "UPDATE files SET is_read = 1, updated_at = strftime('%Y-%m-%d %H:%M:%S', 'now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| format!("Failed to mark file as read: {e}"))?;

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalReader {
    pub name: String,
    pub path: String,
    pub preferred: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalReaderConfig {
    pub readers: Vec<ExternalReader>,
}

#[tauri::command]
pub fn open_with_external_app(
    id: i64,
    reader_path: Option<String>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let conn_guard = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    let (filename, content_blob): (String, Vec<u8>) = conn
        .query_row(
            "SELECT filename, content FROM files WHERE id = ?1",
            params![id],
            |row| Ok((row.get("filename")?, row.get("content")?)),
        )
        .map_err(|e| format!("Failed to query file: {e}"))?;

    let text = crate::services::compression::decompress_zlib(&content_blob)?;

    let temp_dir = std::env::temp_dir().join("littlefile");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {e}"))?;

    let file_path = temp_dir.join(&filename);
    std::fs::write(&file_path, text.as_bytes())
        .map_err(|e| format!("Failed to write temp file: {e}"))?;

    if let Some(reader) = reader_path {
        std::process::Command::new(&reader)
            .arg(file_path.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| format!("Failed to open with '{}': {e}", reader))?;
    } else {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &file_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open file: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn list_configured_readers() -> Result<Vec<ExternalReader>, String> {
    Ok(Vec::new())
}
