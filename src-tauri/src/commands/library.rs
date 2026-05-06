use crate::AppState;
use serde::{Deserialize, Serialize};
use std::fs::{self, metadata};

use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryInfo {
    pub name: String,
    pub description: String,
    pub total_files: i64,
    pub total_size: i64,
    pub total_compressed_size: i64,
    pub total_tags: i64,
    pub db_file_size: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryHistoryEntry {
    pub name: String,
    pub path: String,
    pub last_opened: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenLibraryOptions {
    pub path: String,
    pub name: Option<String>,
    pub description: Option<String>,
}

fn get_config_dir() -> Result<std::path::PathBuf, String> {
    let dir = std::env::temp_dir().join("littlefile").join("config");
    fs::create_dir_all(&dir).map_err(|e| format!("{e}"))?;
    Ok(dir)
}

fn now_string() -> String {
    let t = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = t.as_secs();
    format!("{}", secs)
}

fn save_library_history(path: &str, name: String) -> Result<(), String> {
    let mut history = get_library_history().unwrap_or_default();
    history.retain(|e| e.path != path);
    history.insert(
        0,
        LibraryHistoryEntry {
            name,
            path: path.to_string(),
            last_opened: now_string(),
        },
    );
    if history.len() > 20 {
        history.truncate(20);
    }
    let config_dir = get_config_dir()?;
    let data = serde_json::to_string(&history).map_err(|e| format!("{e}"))?;
    fs::write(config_dir.join("library_history.json"), data).map_err(|e| format!("{e}"))?;
    Ok(())
}

#[tauri::command]
pub fn open_library(
    options: OpenLibraryOptions,
    state: State<'_, AppState>,
) -> Result<LibraryInfo, String> {
    if let Ok(mut guard) = state.db.lock() {
        if let Some(ref mut conn) = *guard {
            crate::db::close_database(conn)?;
        }
        *guard = None;
    }
    let conn = crate::db::open_database(&options.path)?;
    let info = get_library_info_inner(&conn, &options.path)?;
    if let Ok(mut guard) = state.db.lock() {
        *guard = Some(conn);
    }
    save_library_history(&options.path, info.name.clone())?;
    Ok(info)
}

#[tauri::command]
pub fn close_library(state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(mut guard) = state.db.lock() {
        if let Some(ref mut conn) = *guard {
            crate::db::close_database(conn)?;
        }
        *guard = None;
    }
    Ok(())
}

#[tauri::command]
pub fn get_library_info(state: State<'_, AppState>) -> Result<LibraryInfo, String> {
    let guard = state.db.lock().map_err(|e| format!("{e}"))?;
    let conn = guard.as_ref().ok_or("No database open")?;
    get_library_info_inner(conn, "")
}

#[tauri::command]
pub fn get_library_history() -> Result<Vec<LibraryHistoryEntry>, String> {
    let config_dir = get_config_dir()?;
    let history_path = config_dir.join("library_history.json");
    if !history_path.exists() {
        return Ok(vec![]);
    }
    let data = fs::read_to_string(&history_path).map_err(|e| format!("{e}"))?;
    serde_json::from_str(&data).map_err(|e| format!("{e}"))
}

#[tauri::command]
pub fn remove_library_from_history(path: String) -> Result<(), String> {
    let mut history = get_library_history()?;
    history.retain(|e| e.path != path);
    let config_dir = get_config_dir()?;
    fs::create_dir_all(&config_dir).map_err(|e| format!("{e}"))?;
    let data = serde_json::to_string(&history).map_err(|e| format!("{e}"))?;
    fs::write(config_dir.join("library_history.json"), data).map_err(|e| format!("{e}"))?;
    Ok(())
}

#[tauri::command]
pub fn get_remote_tags(db_path: String) -> Result<Vec<crate::commands::tags::TagInfo>, String> {
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| format!("{e}"))?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, COUNT(ft.file_id) as file_count, t.created_at FROM tags t LEFT JOIN file_tags ft ON t.id = ft.tag_id GROUP BY t.id ORDER BY t.name COLLATE NOCASE",
        )
        .map_err(|e| format!("{e}"))?;
    let rows = stmt.query_map([], |row| {
        Ok(crate::commands::tags::TagInfo {
            id: row.get(0)?,
            name: row.get(1)?,
            file_count: row.get(2)?,
            created_at: row.get(3)?,
        })
    })
    .map_err(|e| format!("{e}"))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("{e}"))
}

fn get_library_info_inner(conn: &rusqlite::Connection, path: &str) -> Result<LibraryInfo, String> {
    let (name, description, created_at): (String, String, String) = conn.query_row(
        "SELECT MAX(CASE WHEN key='name' THEN value ELSE '' END), MAX(CASE WHEN key='description' THEN value ELSE '' END), MAX(CASE WHEN key='created_at' THEN value ELSE '' END) FROM db_meta",
        [],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )
    .map_err(|e| format!("{e}"))?;
    let (total_files, total_size, total_compressed_size): (i64, i64, i64) = conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(size),0), COALESCE(SUM(compressed_size),0) FROM files",
        [],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )
    .unwrap_or((0, 0, 0));
    let total_tags: i64 = conn
        .query_row("SELECT COUNT(*) FROM tags", [], |row| row.get(0))
        .unwrap_or(0);
    let db_file_size = if !path.is_empty() {
        metadata(path).map(|m| m.len() as i64).unwrap_or(0)
    } else {
        0
    };
    Ok(LibraryInfo {
        name,
        description,
        total_files,
        total_size,
        total_compressed_size,
        total_tags,
        db_file_size,
        created_at,
    })
}
