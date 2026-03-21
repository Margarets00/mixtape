use tauri::Manager;
use tokio::io::AsyncBufReadExt;

#[tauri::command]
pub async fn queue_download(
    app: tauri::AppHandle,
    item_id: String,
    video_url: String,
    save_dir: String,
    on_event: tauri::ipc::Channel<crate::download::DownloadEvent>,
) -> Result<(), String> {
    // Acquire semaphore permit — blocks if 2 downloads already running (QUEUE-04)
    let sem = app
        .state::<crate::state::AppState>()
        .download_semaphore
        .clone();

    let permit = sem
        .acquire_owned()
        .await
        .map_err(|_| "download semaphore closed".to_string())?;

    // 2-second delay between download starts (QUEUE-04)
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    let ytdlp_path = crate::download::locate_sidecar("yt-dlp")?;
    let ffmpeg_path = crate::download::locate_sidecar("ffmpeg")?;
    let ffmpeg_str = ffmpeg_path.to_string_lossy().to_string();

    // Pre-fetch title for clean filename (same pattern as download.rs)
    let title_output = tokio::process::Command::new(&ytdlp_path)
        .args(["--print", "title", &video_url])
        .output()
        .await
        .map_err(|e| format!("Failed to get title: {}", e))?;

    let raw_title = String::from_utf8_lossy(&title_output.stdout)
        .trim()
        .to_string();
    let cleaned_title = crate::title::clean_title(&raw_title);
    let safe_title = crate::title::sanitize_filename(&cleaned_title);
    let output_path = format!("{}/{}.mp3", save_dir, safe_title);
    let output_template = format!("{}/{}.%(ext)s", save_dir, safe_title);

    // Spawn yt-dlp download process
    let mut child = tokio::process::Command::new(&ytdlp_path)
        .args([
            "-x",
            "--audio-format",
            "mp3",
            "--audio-quality",
            "0",
            "--embed-metadata",
            "--ffmpeg-location",
            &ffmpeg_str,
            "--progress-template",
            "download:PROGRESS %(progress._percent)f %(progress._speed_str)s %(progress._eta_str)s",
            "--newline",
            "-o",
            &output_template,
            &video_url,
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    // Register PID for cancel support (QUEUE-06)
    if let Some(pid) = child.id() {
        if let Ok(mut guard) = app.state::<crate::state::AppState>().queue_pids.lock() {
            guard.insert(item_id.clone(), pid);
        }
    }

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let on_event_stdout = on_event.clone();
    let on_event_stderr = on_event.clone();

    // Stream stdout for progress
    tauri::async_runtime::spawn(async move {
        let mut reader = tokio::io::BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if let Some(evt) = crate::download::parse_yt_dlp_line(&line) {
                let _ = on_event_stdout.send(evt);
            }
        }
    });

    // Stream stderr for errors
    tauri::async_runtime::spawn(async move {
        let mut reader = tokio::io::BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if let Some(evt) = crate::download::parse_yt_dlp_line(&line) {
                let _ = on_event_stderr.send(evt);
            }
        }
    });

    // Wait for process and emit Done/Error — permit is moved into this block
    // so it is held for the full duration of the download (QUEUE-04)
    let item_id_clone = item_id.clone();
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        let _permit = permit; // held until this block exits, releasing semaphore slot
        match child.wait().await {
            Ok(status) => {
                // Remove PID from registry
                if let Ok(mut guard) = app_clone
                    .state::<crate::state::AppState>()
                    .queue_pids
                    .lock()
                {
                    guard.remove(&item_id_clone);
                }
                if status.success() {
                    let _ = on_event.send(crate::download::DownloadEvent::Done { path: output_path });
                } else {
                    let _ = on_event.send(crate::download::DownloadEvent::Error {
                        message: format!(
                            "yt-dlp exited with code {}",
                            status.code().unwrap_or(-1)
                        ),
                    });
                }
            }
            Err(e) => {
                let _ = on_event.send(crate::download::DownloadEvent::Error {
                    message: format!("Failed to wait for yt-dlp: {}", e),
                });
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_download(app: tauri::AppHandle, item_id: String) -> Result<(), String> {
    let pid_opt = app
        .state::<crate::state::AppState>()
        .queue_pids
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&item_id);

    if let Some(pid) = pid_opt {
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
    // Note: partial file cleanup happens naturally — yt-dlp writes to a .part file
    // which is not renamed to .mp3 until completion. If killed, the .part file remains
    // but is harmless. No explicit cleanup needed.
    Ok(())
}
