use rusqlite::Connection;

/// Migration v3: Add reading progress columns to files table.
pub fn migrate(conn: &Connection) -> Result<(), rusqlite::Error> {
    let stmts = [
        "ALTER TABLE files ADD COLUMN last_read_line INTEGER NOT NULL DEFAULT 0;",
        "ALTER TABLE files ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0;",
    ];
    for sql in &stmts {
        let result = conn.execute_batch(sql);
        match result {
            Ok(()) => {}
            Err(ref e) => {
                if e.to_string().contains("duplicate column name") {
                    continue;
                } else {
                    return result;
                }
            }
        }
    }
    Ok(())
}
