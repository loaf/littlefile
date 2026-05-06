use rusqlite::Connection;

/// Apply PRAGMAs, create all tables, indexes, and insert initial metadata.
pub fn create_tables(conn: &Connection) -> Result<(), rusqlite::Error> {
    // PRAGMAs
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA page_size = 16384;
         PRAGMA synchronous = NORMAL;
         PRAGMA cache_size = -32000;
         PRAGMA mmap_size = 67108864;
         PRAGMA temp_store = MEMORY;
         PRAGMA busy_timeout = 30000;",
    )?;

    // Tables
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS files (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            filename        TEXT NOT NULL,
            author          TEXT NOT NULL DEFAULT '',
            original_path   TEXT DEFAULT '',
            size            INTEGER NOT NULL,
            compressed_size INTEGER NOT NULL,
            encoding        TEXT NOT NULL DEFAULT 'utf-8',
            description     TEXT NOT NULL DEFAULT '',
            content         BLOB NOT NULL,
            sha256          TEXT NOT NULL,
            last_read_line  INTEGER NOT NULL DEFAULT 0,
            is_read         INTEGER NOT NULL DEFAULT 0,
            created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
            updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
        );

        CREATE TABLE IF NOT EXISTS tags (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
        );

        CREATE TABLE IF NOT EXISTS file_tags (
            file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
            tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (file_id, tag_id)
        ) WITHOUT ROWID;

        CREATE TABLE IF NOT EXISTS db_meta (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );",
    )?;

    // Indexes
    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_files_filename   ON files(filename COLLATE NOCASE);
         CREATE INDEX IF NOT EXISTS idx_files_author     ON files(author COLLATE NOCASE);
         CREATE INDEX IF NOT EXISTS idx_files_sha256     ON files(sha256);
         CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
         CREATE INDEX IF NOT EXISTS idx_file_tags_tag_id ON file_tags(tag_id, file_id);
         CREATE INDEX IF NOT EXISTS idx_tags_name        ON tags(name COLLATE NOCASE);",
    )?;

    // Initial meta data
    conn.execute_batch(
        "INSERT OR IGNORE INTO db_meta (key, value) VALUES
            ('version', '3'),
            ('name', ''),
            ('description', ''),
            ('created_at', strftime('%Y-%m-%d %H:%M:%S', 'now'));",
    )?;

    Ok(())
}
