use rusqlite::params_from_iter;
use rusqlite::types::Value;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileFilter {
    pub filename_query: Option<String>,
    pub author_query: Option<String>,
    pub description_query: Option<String>,
    pub tag_ids: Option<Vec<i64>>,
    pub tag_filter_mode: Option<String>,
    pub size_min: Option<i64>,
    pub size_max: Option<i64>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub encoding_filter: Option<String>,
    pub has_description: Option<bool>,
    pub has_tags: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileItem {
    pub id: i64,
    pub filename: String,
    pub author: String,
    pub size: i64,
    pub compressed_size: i64,
    pub encoding: String,
    pub description: String,
    pub tags: String,
    pub tag_ids: String,
    pub last_read_line: i64,
    pub is_read: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileListResult {
    pub total_count: i64,
    pub files: Vec<FileItem>,
}

#[tauri::command]
pub fn list_files(
    filter: FileFilter,
    offset: i64,
    limit: i64,
    sort_by: String,
    sort_order: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<FileListResult, String> {
    let valid_sort_columns = ["filename", "author", "size", "created_at"];
    if !valid_sort_columns.contains(&sort_by.as_str()) {
        return Err(format!("Invalid sort column: {}", sort_by));
    }
    let sort_dir = if sort_order.to_lowercase() == "asc" {
        "ASC"
    } else {
        "DESC"
    };

    let conn_guard = state
        .db
        .lock()
        .map_err(|e| format!("Failed to acquire DB lock: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or("No database connection open")?;

    let mut conditions: Vec<String> = vec!["1=1".to_string()];
    let mut params: Vec<Value> = Vec::new();

    if let Some(ref q) = filter.filename_query {
        if !q.is_empty() {
            conditions.push("f.filename LIKE ?".to_string());
            params.push(Value::Text(format!("%{}%", q)));
        }
    }

    if let Some(ref q) = filter.author_query {
        if !q.is_empty() {
            conditions.push("f.author LIKE ?".to_string());
            params.push(Value::Text(format!("%{}%", q)));
        }
    }

    if let Some(ref q) = filter.description_query {
        if !q.is_empty() {
            conditions.push("f.description LIKE ?".to_string());
            params.push(Value::Text(format!("%{}%", q)));
        }
    }

    if let Some(ref tag_id_list) = filter.tag_ids {
        if !tag_id_list.is_empty() {
            let mode = filter
                .tag_filter_mode
                .as_deref()
                .unwrap_or("OR")
            .to_uppercase();

            let placeholders: Vec<String> = tag_id_list.iter().map(|_| "?".to_string()).collect();
            let in_clause = placeholders.join(", ");

            if mode == "AND" {
                let count = tag_id_list.len() as i64;
                conditions.push(format!(
                    "f.id IN (SELECT ft.file_id FROM file_tags ft WHERE ft.tag_id IN ({}) GROUP BY ft.file_id HAVING COUNT(DISTINCT ft.tag_id) = ?)",
                    in_clause
                ));
                for &id in tag_id_list {
                    params.push(Value::Integer(id));
                }
                params.push(Value::Integer(count));
            } else {
                conditions.push(format!(
                    "f.id IN (SELECT ft.file_id FROM file_tags ft WHERE ft.tag_id IN ({}))",
                    in_clause
                ));
                for &id in tag_id_list {
                    params.push(Value::Integer(id));
                }
            }
        }
    }

    if let Some(min) = filter.size_min { conditions.push("f.size >= ?".to_string()); params.push(Value::Integer(min)); }
    if let Some(max) = filter.size_max { conditions.push("f.size <= ?".to_string()); params.push(Value::Integer(max)); }
    if let Some(ref d) = filter.date_from { conditions.push("f.created_at >= ?".to_string()); params.push(Value::Text(format!("{} 00:00:00", d))); }
    if let Some(ref d) = filter.date_to { conditions.push("f.created_at <= ?".to_string()); params.push(Value::Text(format!("{} 23:59:59", d))); }
    if let Some(ref enc) = filter.encoding_filter { conditions.push("f.encoding = ?".to_string()); params.push(Value::Text(enc.clone())); }
    if let Some(v) = filter.has_description {
        if v { conditions.push("f.description != ''".to_string()); }
        else { conditions.push("f.description = ''".to_string()); }
    }
    if let Some(v) = filter.has_tags {
        if v { conditions.push("f.id IN (SELECT DISTINCT file_id FROM file_tags)".to_string()); }
        else { conditions.push("f.id NOT IN (SELECT DISTINCT file_id FROM file_tags)".to_string()); }
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!(
        "SELECT COUNT(DISTINCT f.id) FROM files f \
         LEFT JOIN file_tags ft ON f.id = ft.file_id \
         LEFT JOIN tags t ON ft.tag_id = t.id \
         WHERE {}",
        where_clause
    );

    let total_count: i64 = conn
        .query_row(&count_sql, params_from_iter(params.iter()), |row| {
            row.get(0)
        })
        .map_err(|e| format!("Failed to count files: {e}"))?;

    let data_sql = format!(
        "SELECT DISTINCT f.id, f.filename, f.author, f.size, f.compressed_size, \
         f.encoding, f.description, f.last_read_line, f.is_read, \
         f.created_at, f.updated_at, \
         COALESCE(GROUP_CONCAT(t.name, ', '), '') AS tags, \
         COALESCE(GROUP_CONCAT(t.id, ','), '') AS tag_ids \
         FROM files f \
         LEFT JOIN file_tags ft ON f.id = ft.file_id \
         LEFT JOIN tags t ON ft.tag_id = t.id \
         WHERE {} \
         GROUP BY f.id \
         ORDER BY {} {} \
         LIMIT ? OFFSET ?",
        where_clause, sort_by, sort_dir
    );

    let mut data_params = params.clone();
    data_params.push(Value::Integer(limit));
    data_params.push(Value::Integer(offset));

    let mut stmt = conn
        .prepare(&data_sql)
        .map_err(|e| format!("Failed to prepare query: {e}"))?;

    let rows = stmt
        .query_map(params_from_iter(data_params.iter()), |row| {
            Ok(FileItem {
                id: row.get("id")?,
                filename: row.get("filename")?,
                author: row.get("author")?,
                size: row.get("size")?,
                compressed_size: row.get("compressed_size")?,
                encoding: row.get("encoding")?,
                description: row.get("description")?,
                last_read_line: row.get("last_read_line")?,
                is_read: row.get::<_, i64>("is_read")? != 0,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
                tags: row.get("tags")?,
                tag_ids: row.get("tag_ids")?,
            })
        })
        .map_err(|e| format!("Failed to map rows: {e}"))?;

    let mut files = Vec::new();
    for item in rows {
        let file_item = item.map_err(|e| format!("Failed to read row: {e}"))?;
        files.push(file_item);
    }

    Ok(FileListResult {
        total_count,
        files,
    })
}

#[tauri::command]
pub fn delete_files(file_ids: Vec<i64>, state: tauri::State<'_, crate::AppState>) -> Result<(), String> {
    if state.import.running.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("导入进行中，请稍后操作".to_string());
    }

    let guard = state.db.lock().map_err(|e| format!("{e}"))?;
    let conn = guard.as_ref().ok_or("No database open")?;
    if file_ids.is_empty() { return Ok(()); }
    let ph: Vec<String> = file_ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!("DELETE FROM files WHERE id IN ({})", ph.join(", "));
    let params: Vec<rusqlite::types::Value> = file_ids.iter().map(|&id| rusqlite::types::Value::Integer(id)).collect();
    conn.execute(&sql, rusqlite::params_from_iter(params.iter())).map_err(|e| format!("{e}"))?;
    Ok(())
}
