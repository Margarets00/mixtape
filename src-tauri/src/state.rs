use std::sync::Mutex;

pub struct AppState {
    pub active_pid: Mutex<Option<u32>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            active_pid: Mutex::new(None),
        }
    }
}
