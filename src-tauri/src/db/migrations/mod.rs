pub mod v2;
pub mod v3;

use rusqlite::Connection;

type MigrationFn = fn(&Connection) -> Result<(), rusqlite::Error>;

struct Migration {
    version: i64,
    description: &'static str,
    migrate: MigrationFn,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 2,
        description: "Add author column",
        migrate: v2::migrate,
    },
    Migration {
        version: 3,
        description: "Add reading progress columns",
        migrate: v3::migrate,
    },
];

/// Run all migrations newer than `current_version`. Returns new version.
pub fn run_pending_migrations(conn: &Connection, current_version: i64) -> Result<i64, String> {
    let mut new_version = current_version;

    for migration in MIGRATIONS {
        if migration.version > current_version {
            let desc = migration.description;
            let ver = migration.version;

            conn.execute_batch("BEGIN;").map_err(|e| {
                format!("Failed to begin transaction for migration v{ver} ({desc}): {e}")
            })?;

            if let Err(e) = (migration.migrate)(conn) {
                conn.execute_batch("ROLLBACK;").map_err(|re| {
                    format!(
                        "Migration v{ver} ({desc}) failed: {e}, and rollback also failed: {re}"
                    )
                })?;
                return Err(format!("Migration v{ver} ({desc}) failed: {e}"));
            }

            conn.execute(
                "UPDATE db_meta SET value = ?1 WHERE key = 'version'",
                [&ver.to_string()],
            )
            .map_err(|e| format!("Failed to update version after migration v{ver}: {e}"))?;

            conn.execute_batch("COMMIT;").map_err(|e| {
                format!("Failed to commit transaction for migration v{ver} ({desc}): {e}")
            })?;

            eprintln!("Applied migration v{ver}: {desc}");
            new_version = ver;
        }
    }

    Ok(new_version)
}
