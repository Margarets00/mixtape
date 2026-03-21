use std::sync::Mutex;
use tauri_plugin_shell::process::CommandChild;

pub struct AppState {
    pub active_child: Mutex<Option<CommandChild>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            active_child: Mutex::new(None),
        }
    }
}
