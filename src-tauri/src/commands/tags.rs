use rusqlite::params;
use rusqlite::params_from_iter;
use rusqlite::types::Value;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagInfo {
    pub id: i64,
    pub name: String,
    pub file_count: i64,
    pub created_at: String,
}

#[tauri::command]
pub fn list_tags(
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<TagInfo>, String> {
    let conn_guard = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, COUNT(ft.file_id) AS file_count, t.created_at \
             FROM tags t \
             LEFT JOIN file_tags ft ON t.id = ft.tag_id \
             GROUP BY t.id \
             ORDER BY t.name COLLATE NOCASE",
        )
        .map_err(|e| format!("Failed to prepare list_tags query: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(TagInfo {
                id: row.get("id")?,
                name: row.get("name")?,
                file_count: row.get("file_count")?,
                created_at: row.get("created_at")?,
            })
        })
        .map_err(|e| format!("Failed to query tags: {e}"))?;

    let mut tags = Vec::new();
    for item in rows {
        let tag = item.map_err(|e| format!("Failed to read tag row: {e}"))?;
        tags.push(tag);
    }

    Ok(tags)
}

#[tauri::command]
pub fn create_tag(
    name: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<TagInfo, String> {
    if state.import.running.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("导入进行中，请稍后操作".to_string());
    }

    let trimmed = name.trim();
    if trimmed.len() < 2 || trimmed.len() > 50 {
        return Err("Tag name must be 2-50 characters".to_string());
    }

    let conn_guard = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    conn.execute(
        "INSERT OR IGNORE INTO tags (name) VALUES (?1)",
        params![trimmed],
    )
    .map_err(|e| format!("Failed to create tag: {e}"))?;

    conn.query_row(
        "SELECT id, name, 0 as file_count, created_at FROM tags WHERE name = ?1 COLLATE NOCASE",
        params![trimmed],
        |row| {
            Ok(TagInfo {
                id: row.get("id")?,
                name: row.get("name")?,
                file_count: row.get("file_count")?,
                created_at: row.get("created_at")?,
            })
        },
    )
    .map_err(|e| format!("Failed to fetch created tag: {e}"))
}

#[tauri::command]
pub fn rename_tag(
    id: i64,
    new_name: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    if state.import.running.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("导入进行中，请稍后操作".to_string());
    }

    let trimmed = new_name.trim();
    if trimmed.len() < 2 || trimmed.len() > 50 {
        return Err("Tag name must be 2-50 characters".to_string());
    }

    let conn_guard = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tags WHERE name = ?1 COLLATE NOCASE AND id != ?2",
            params![trimmed, id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check existing tag name: {e}"))?;

    if count > 0 {
        return Err("Tag name already exists".to_string());
    }

    conn.execute(
        "UPDATE tags SET name = ?1 WHERE id = ?2",
        params![trimmed, id],
    )
    .map_err(|e| format!("Failed to rename tag: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn delete_tag(
    id: i64,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    if state.import.running.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("导入进行中，请稍后操作".to_string());
    }

    let conn_guard = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    conn.execute("DELETE FROM tags WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete tag: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn add_tags_to_files(
    file_ids: Vec<i64>,
    tag_ids: Vec<i64>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    if state.import.running.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("导入进行中，请稍后操作".to_string());
    }

    let conn_guard = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    for &file_id in &file_ids {
        for &tag_id in &tag_ids {
            conn.execute(
                "INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?1, ?2)",
                params![file_id, tag_id],
            )
            .map_err(|e| format!("Failed to add tag to file: {e}"))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn remove_tags_from_files(
    file_ids: Vec<i64>,
    tag_ids: Vec<i64>,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    if state.import.running.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("导入进行中，请稍后操作".to_string());
    }

    let conn_guard = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    let file_placeholders: Vec<String> = file_ids.iter().map(|_| "?".to_string()).collect();
    let tag_placeholders: Vec<String> = tag_ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "DELETE FROM file_tags WHERE file_id IN ({}) AND tag_id IN ({})",
        file_placeholders.join(", "),
        tag_placeholders.join(", ")
    );

    let mut params: Vec<Value> = file_ids
        .iter()
        .map(|&id| Value::Integer(id))
        .collect();
    params.extend(tag_ids.iter().map(|&id| Value::Integer(id)));

    conn.execute(&sql, params_from_iter(params.iter()))
        .map_err(|e| format!("Failed to remove tags from files: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn update_description(
    id: i64,
    description: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    if state.import.running.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("导入进行中，请稍后操作".to_string());
    }

    let desc = if description.len() > 500 {
        &description[..500]
    } else {
        &description
    };

    let conn_guard = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    conn.execute(
        "UPDATE files SET description = ?1, updated_at = strftime('%Y-%m-%d %H:%M:%S', 'now') WHERE id = ?2",
        params![desc, id],
    )
    .map_err(|e| format!("Failed to update description: {e}"))?;

    Ok(())
}
