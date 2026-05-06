pub mod db;
pub mod services;
pub mod commands;

use rusqlite::Connection;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

pub struct ImportState {
    pub paused: Arc<AtomicBool>,
    pub cancelled: Arc<AtomicBool>,
    pub running: Arc<AtomicBool>,
}

pub struct AppState {
    pub db: Mutex<Option<Connection>>,
    pub import: ImportState,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            db: Mutex::new(None),
            import: ImportState {
                paused: Arc::new(AtomicBool::new(false)),
                cancelled: Arc::new(AtomicBool::new(false)),
                running: Arc::new(AtomicBool::new(false)),
            },
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::import::scan_import_path,
            commands::import::start_import,
            commands::import::pause_import,
            commands::import::resume_import,
            commands::import::cancel_import,
            commands::files::list_files,
            commands::files::delete_files,
            commands::viewer::get_file_content_for_reading,
            commands::viewer::save_reading_progress,
            commands::viewer::get_file_preview,
            commands::viewer::mark_as_read,
            commands::viewer::open_with_external_app,
            commands::viewer::list_configured_readers,
            commands::tags::list_tags,
            commands::tags::create_tag,
            commands::tags::rename_tag,
            commands::tags::delete_tag,
            commands::tags::add_tags_to_files,
            commands::tags::remove_tags_from_files,
            commands::tags::update_description,
            commands::export::export_files,
            commands::library::open_library,
            commands::library::close_library,
            commands::library::get_library_info,
            commands::library::get_library_history,
            commands::library::remove_library_from_history,
            commands::library::get_remote_tags,
            commands::transfer::move_files_to_library,
            commands::transfer::copy_files_to_library,
            commands::maintenance::backup_library,
            commands::maintenance::check_integrity,
            commands::maintenance::optimize_database
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
