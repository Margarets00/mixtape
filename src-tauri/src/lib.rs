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
                let state = app.state::<state::AppState>();
                let child_opt = state.active_child.lock();
                if let Ok(mut guard) = child_opt {
                    if let Some(child) = guard.take() {
                        let _ = child.kill();
                    }
                };
            }
        });
}
