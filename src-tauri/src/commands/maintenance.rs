use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityResult {
    pub ok: bool,
    pub message: String,
}

#[tauri::command]
pub fn backup_library(backup_path: String, state: tauri::State<'_, crate::AppState>) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| format!("{e}"))?;
    let conn = guard.as_ref().ok_or("No database open")?;
    conn.execute("VACUUM INTO ?1", rusqlite::params![&backup_path]).map_err(|e| format!("{e}"))?;
    Ok(())
}

#[tauri::command]
pub fn check_integrity(state: tauri::State<'_, crate::AppState>) -> Result<IntegrityResult, String> {
    let guard = state.db.lock().map_err(|e| format!("{e}"))?;
    let conn = guard.as_ref().ok_or("No database open")?;
    let msg: String = conn.query_row("PRAGMA integrity_check", [], |row| row.get(0)).map_err(|e| format!("{e}"))?;
    Ok(IntegrityResult { ok: msg == "ok", message: msg })
}

#[tauri::command]
pub fn optimize_database(state: tauri::State<'_, crate::AppState>) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| format!("{e}"))?;
    let conn = guard.as_ref().ok_or("No database open")?;
    conn.execute_batch("PRAGMA optimize; ANALYZE;").map_err(|e| format!("{e}"))?;
    Ok(())
}
