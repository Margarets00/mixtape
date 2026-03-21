mod download;
mod errors;
mod search;
mod state;
mod title;
mod updater;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(state::AppState::default())
        .invoke_handler(tauri::generate_handler![
            download::download,
            updater::check_ytdlp_version,
            updater::update_ytdlp,
            search::search,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app.state::<state::AppState>();

                // Kill active download PID
                let pid_opt = state.active_pid.lock().ok().and_then(|g| *g);
                if let Some(pid) = pid_opt {
                    kill_pid(pid);
                }

                // Kill preview PID
                let preview_pid_opt = state.preview_pid.lock().ok().and_then(|g| *g);
                if let Some(pid) = preview_pid_opt {
                    kill_pid(pid);
                }

                // Kill all queue PIDs
                let queue_pids: Vec<u32> = state
                    .queue_pids
                    .lock()
                    .ok()
                    .map(|g| g.values().cloned().collect())
                    .unwrap_or_default();
                for pid in queue_pids {
                    kill_pid(pid);
                }
            }
        });
}

fn kill_pid(pid: u32) {
    #[cfg(unix)]
    unsafe {
        libc::kill(pid as libc::pid_t, libc::SIGTERM);
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .status();
    }
}
