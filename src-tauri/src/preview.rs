use tauri::Manager;
use tokio::io::AsyncBufReadExt;

#[tauri::command]
pub async fn preview_start(
    app: tauri::AppHandle,
    video_id: String,
    video_url: String,
) -> Result<String, String> {
    // Kill any existing preview process first
    preview_stop_internal(&app).await;

    let ytdlp = crate::download::locate_sidecar("yt-dlp")?;
    let ffmpeg = crate::download::locate_sidecar("ffmpeg")?;
    let tmp_path = std::env::temp_dir().join(format!("preview_{}.mp3", video_id));

    // Delete stale temp file if it exists
    let _ = std::fs::remove_file(&tmp_path);

    let mut child = tokio::process::Command::new(&ytdlp)
        .args([
            "--download-sections",
            "*0-60",
            "-x",
            "--audio-format",
            "mp3",
            "--ffmpeg-location",
            ffmpeg.to_str().unwrap(),
            "--no-warnings",
            "--no-playlist",
            "-o",
            tmp_path.to_str().unwrap(),
            &video_url,
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp for preview: {}", e))?;

    // Store PID for cancellation / cleanup
    if let Some(pid) = child.id() {
        if let Ok(mut guard) = app.state::<crate::state::AppState>().preview_pid.lock() {
            *guard = Some(pid);
        }
    }

    // Drain stderr/stdout so process doesn't stall if output buffer fills
    let stderr = child.stderr.take().unwrap();
    let stdout = child.stdout.take().unwrap();
    tauri::async_runtime::spawn(async move {
        let mut reader = tokio::io::BufReader::new(stderr).lines();
        while let Ok(Some(_)) = reader.next_line().await {}
    });
    tauri::async_runtime::spawn(async move {
        let mut reader = tokio::io::BufReader::new(stdout).lines();
        while let Ok(Some(_)) = reader.next_line().await {}
    });

    // Wait for download to complete
    let status = child
        .wait()
        .await
        .map_err(|e| format!("Preview download failed: {}", e))?;

    // Clear PID after completion
    if let Ok(mut guard) = app.state::<crate::state::AppState>().preview_pid.lock() {
        *guard = None;
    }

    if !status.success() {
        return Err("Preview download failed".to_string());
    }

    // Return absolute path — frontend converts with convertFileSrc()
    tmp_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid temp path".to_string())
}

#[tauri::command]
pub async fn preview_stop(app: tauri::AppHandle) -> Result<(), String> {
    preview_stop_internal(&app).await;
    Ok(())
}

pub async fn preview_stop_internal(app: &tauri::AppHandle) {
    let pid_opt = app
        .state::<crate::state::AppState>()
        .preview_pid
        .lock()
        .ok()
        .and_then(|mut g| g.take());

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
    // Clean up temp files matching preview_*.mp3
    if let Ok(tmp_dir) = std::env::temp_dir().read_dir() {
        for entry in tmp_dir.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with("preview_") && name_str.ends_with(".mp3") {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
}
