mod download;
mod errors;
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
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                let pid_opt = {
                    let state = app.state::<state::AppState>();
                    state.active_pid.lock().ok().and_then(|g| *g)
                };
                if let Some(pid) = pid_opt {
                    {
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
                }
            }
        });
}
