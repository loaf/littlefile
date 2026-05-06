use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferOptions {
    pub file_ids: Vec<i64>,
    pub target_db_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagMapping {
    pub source_tag_id: i64,
    pub action: String,
    pub target_tag_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferWithTagMapping {
    pub file_ids: Vec<i64>,
    pub target_db_path: String,
    pub tag_mappings: Vec<TagMapping>,
}

#[tauri::command]
pub fn move_files_to_library(
    opts: TransferWithTagMapping,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| format!("{e}"))?;
    let src_conn = guard.as_ref().ok_or("No database open")?;

    src_conn.execute("ATTACH DATABASE ?1 AS target", rusqlite::params![&opts.target_db_path])
        .map_err(|e| format!("Failed to ATTACH: {e}"))?;

    let result = (|| -> Result<(), String> {
        src_conn.execute_batch("BEGIN;").map_err(|e| format!("{e}"))?;

        for &file_id in &opts.file_ids {
            src_conn.execute(
                "INSERT INTO target.files (filename, author, original_path, size, compressed_size, encoding, description, content, sha256, last_read_line, is_read, created_at, updated_at) SELECT filename, author, original_path, size, compressed_size, encoding, description, content, sha256, last_read_line, is_read, created_at, updated_at FROM files WHERE id = ?1",
                rusqlite::params![file_id],
            ).map_err(|e| format!("Insert failed: {e}"))?;

            for mapping in &opts.tag_mappings {
                match mapping.action.as_str() {
                    "map" => {
                        let target_id = mapping.target_tag_id.ok_or("Missing target_tag_id")?;
                        src_conn.execute("INSERT OR IGNORE INTO target.file_tags (file_id, tag_id) VALUES (?1, ?2)", rusqlite::params![file_id, target_id]).map_err(|e| format!("{e}"))?;
                    }
                    "create" => {
                        let name: String = src_conn.query_row("SELECT name FROM tags WHERE id = ?1", rusqlite::params![mapping.source_tag_id], |row| row.get(0)).map_err(|e| format!("{e}"))?;
                        src_conn.execute("INSERT OR IGNORE INTO target.tags (name) VALUES (?1)", rusqlite::params![&name]).map_err(|e| format!("{e}"))?;
                        let new_id: i64 = src_conn.query_row("SELECT id FROM target.tags WHERE name = ?1 COLLATE NOCASE", rusqlite::params![&name], |row| row.get(0)).map_err(|e| format!("{e}"))?;
                        src_conn.execute("INSERT OR IGNORE INTO target.file_tags (file_id, tag_id) VALUES (?1, ?2)", rusqlite::params![file_id, new_id]).map_err(|e| format!("{e}"))?;
                    }
                    "skip" => {}
                    _ => {}
                }
            }

            src_conn.execute("DELETE FROM files WHERE id = ?1", rusqlite::params![file_id]).map_err(|e| format!("{e}"))?;
        }

        src_conn.execute_batch("COMMIT;").map_err(|e| format!("{e}"))?;
        Ok(())
    })();

    let _ = src_conn.execute_batch("DETACH DATABASE target;");

    result
}

#[tauri::command]
pub fn copy_files_to_library(
    opts: TransferWithOptions,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| format!("{e}"))?;
    let src_conn = guard.as_ref().ok_or("No database open")?;

    src_conn.execute("ATTACH DATABASE ?1 AS target", rusqlite::params![&opts.target_db_path])
        .map_err(|e| format!("Failed to ATTACH: {e}"))?;

    let result = (|| -> Result<(), String> {
        src_conn.execute_batch("BEGIN;").map_err(|e| format!("{e}"))?;

        for &file_id in &opts.file_ids {
            src_conn.execute(
                "INSERT INTO target.files (filename, author, original_path, size, compressed_size, encoding, description, content, sha256, last_read_line, is_read, created_at, updated_at) SELECT filename, author, original_path, size, compressed_size, encoding, description, content, sha256, last_read_line, is_read, created_at, updated_at FROM files WHERE id = ?1",
                rusqlite::params![file_id],
            ).map_err(|e| format!("Insert failed: {e}"))?;

            for mapping in &opts.tag_mappings {
                match mapping.action.as_str() {
                    "map" => {
                        let target_id = mapping.target_tag_id.ok_or("Missing target_tag_id")?;
                        src_conn.execute("INSERT OR IGNORE INTO target.file_tags (file_id, tag_id) VALUES (?1, ?2)", rusqlite::params![file_id, target_id]).map_err(|e| format!("{e}"))?;
                    }
                    "create" => {
                        let name: String = src_conn.query_row("SELECT name FROM tags WHERE id = ?1", rusqlite::params![mapping.source_tag_id], |row| row.get(0)).map_err(|e| format!("{e}"))?;
                        src_conn.execute("INSERT OR IGNORE INTO target.tags (name) VALUES (?1)", rusqlite::params![&name]).map_err(|e| format!("{e}"))?;
                        let new_id: i64 = src_conn.query_row("SELECT id FROM target.tags WHERE name = ?1 COLLATE NOCASE", rusqlite::params![&name], |row| row.get(0)).map_err(|e| format!("{e}"))?;
                        src_conn.execute("INSERT OR IGNORE INTO target.file_tags (file_id, tag_id) VALUES (?1, ?2)", rusqlite::params![file_id, new_id]).map_err(|e| format!("{e}"))?;
                    }
                    "skip" => {}
                    _ => {}
                }
            }
        }

        src_conn.execute_batch("COMMIT;").map_err(|e| format!("{e}"))?;
        Ok(())
    })();

    let _ = src_conn.execute_batch("DETACH DATABASE target;");

    result
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferWithOptions {
    pub file_ids: Vec<i64>,
    pub target_db_path: String,
    pub tag_mappings: Vec<TagMapping>,
}
