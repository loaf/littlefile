pub mod migrations;
pub mod models;
pub mod schema;

use rusqlite::Connection;
use std::path::Path;

/// Open a database at the given path. Creates tables if new. Runs pending migrations.
pub fn open_database(path: &str) -> Result<Connection, String> {
    // Ensure parent directory exists
    if let Some(parent) = Path::new(path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create database directory: {e}"))?;
        }
    }

    // Open connection (creates file if not exists)
    let conn =
        Connection::open(path).map_err(|e| format!("Failed to open database at '{path}': {e}"))?;

    // Apply PRAGMAs, create tables, indexes, initial meta
    schema::create_tables(&conn)
        .map_err(|e| format!("Failed to initialize database schema: {e}"))?;

    // Read current version from db_meta
    let current_version: i64 = conn
        .query_row(
            "SELECT CAST(value AS INTEGER) FROM db_meta WHERE key = 'version'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(1);

    // Run pending migrations
    migrations::run_pending_migrations(&conn, current_version)?;

    Ok(conn)
}

/// Close a database connection gracefully with WAL checkpoint.
pub fn close_database(conn: &mut Connection) -> Result<(), String> {
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|e| format!("Failed to checkpoint WAL: {e}"))?;
    // Connection drops automatically here, closing the database
    Ok(())
}
