use rusqlite::Connection;

/// Migration v2: Add author column to files table.
pub fn migrate(conn: &Connection) -> Result<(), rusqlite::Error> {
    let result = conn.execute_batch("ALTER TABLE files ADD COLUMN author TEXT NOT NULL DEFAULT '';");
    match result {
        Ok(()) => Ok(()),
        Err(ref e) => {
            // SQLite returns "duplicate column name" if the column already exists.
            if e.to_string().contains("duplicate column name") {
                Ok(())
            } else {
                result
            }
        }
    }
}
