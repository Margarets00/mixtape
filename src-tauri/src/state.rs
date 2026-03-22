use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::Semaphore;

pub struct AppState {
    pub active_pid: Mutex<Option<u32>>,
    pub preview_pid: Mutex<Option<u32>>,
    pub queue_pids: Mutex<HashMap<String, u32>>,
    pub download_semaphore: Arc<Semaphore>,
    pub cookie_browser: Mutex<Option<String>>,
    pub cookie_file_path: Mutex<Option<String>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            active_pid: Mutex::new(None),
            preview_pid: Mutex::new(None),
            queue_pids: Mutex::new(HashMap::new()),
            download_semaphore: Arc::new(Semaphore::new(2)),
            cookie_browser: Mutex::new(None),
            cookie_file_path: Mutex::new(None),
        }
    }
}
