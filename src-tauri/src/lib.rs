mod cookies;
mod deps;
mod download;
mod errors;
mod preview;
mod queue;
mod search;
mod state;
mod title;
mod updater;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 쿠키 자동감지 없음 — 사용자가 Settings에서 명시적으로 선택한 브라우저만 사용.
            // 프론트엔드(App.tsx)가 저장된 browser를 복원한 뒤 extract_saved_cookies 커맨드를 호출.
            Ok(())
        })
        .manage(state::AppState::default())
        .invoke_handler(tauri::generate_handler![
            download::download,
            updater::check_ytdlp_version,
            updater::update_ytdlp,
            search::search,
            search::search_playlist,
            preview::preview_start,
            preview::preview_stop,
            queue::queue_download,
            queue::cancel_download,
            cookies::detect_cookie_browser,
            cookies::set_cookie_browser,
            cookies::extract_saved_cookies,
            deps::check_deps,
            deps::set_dep_path,
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

                // Clean up preview temp files
                if let Ok(tmp_dir) = std::env::temp_dir().read_dir() {
                    for entry in tmp_dir.flatten() {
                        let name = entry.file_name();
                        let name_str = name.to_string_lossy();
                        if name_str.starts_with("preview_") && name_str.ends_with(".mp3") {
                            let _ = std::fs::remove_file(entry.path());
                        }
                    }
                }

                // Clean up cookie temp file
                let cookie_path = state.cookie_file_path.lock().ok().and_then(|g| g.clone());
                if let Some(path) = cookie_path {
                    let _ = std::fs::remove_file(&path);
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
