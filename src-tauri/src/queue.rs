use std::sync::{Arc, Mutex};
use tauri::Manager;
use tokio::io::AsyncBufReadExt;

const BACKOFF_SECS: [u64; 3] = [30, 60, 120];

fn is_rate_limit_error(line: &str) -> bool {
    line.contains("HTTP Error 429")
}

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

    // Pre-fetch title for clean filename (outside the retry loop — happens once)
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

    // Move into spawned task — permit held for full download + retry duration
    let item_id_clone = item_id.clone();
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        let _permit = permit; // held until this block exits, releasing semaphore slot
        let mut attempt: u32 = 0;

        loop {
            // Spawn yt-dlp download process for this attempt
            let mut child = match tokio::process::Command::new(&ytdlp_path)
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
            {
                Ok(c) => c,
                Err(e) => {
                    let _ = on_event.send(crate::download::DownloadEvent::Error {
                        message: format!("Failed to spawn yt-dlp: {}", e),
                    });
                    break;
                }
            };

            // Register PID for cancel support (QUEUE-06) — update for each retry
            if let Some(pid) = child.id() {
                if let Ok(mut guard) = app_clone
                    .state::<crate::state::AppState>()
                    .queue_pids
                    .lock()
                {
                    guard.insert(item_id_clone.clone(), pid);
                }
            }

            let stdout = child.stdout.take().unwrap();
            let stderr = child.stderr.take().unwrap();

            let on_event_stdout = on_event.clone();
            // Stderr lines are collected for 429 detection after process exits
            let stderr_lines: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
            let stderr_lines_writer = stderr_lines.clone();

            // Stream stdout for progress events
            let stdout_task = tauri::async_runtime::spawn(async move {
                let mut reader = tokio::io::BufReader::new(stdout).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    if let Some(evt) = crate::download::parse_yt_dlp_line(&line) {
                        let _ = on_event_stdout.send(evt);
                    }
                }
            });

            // Collect stderr lines (do NOT emit errors yet — retry logic decides)
            let stderr_task = tauri::async_runtime::spawn(async move {
                let mut reader = tokio::io::BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    if let Ok(mut guard) = stderr_lines_writer.lock() {
                        guard.push(line);
                    }
                }
            });

            // Wait for process to finish, then process result
            let wait_result = child.wait().await;

            // Wait for stdout/stderr tasks to drain
            let _ = stdout_task.await;
            let _ = stderr_task.await;

            // Remove PID from registry after this attempt
            if let Ok(mut guard) = app_clone
                .state::<crate::state::AppState>()
                .queue_pids
                .lock()
            {
                guard.remove(&item_id_clone);
            }

            match wait_result {
                Ok(status) => {
                    if status.success() {
                        let _ = on_event
                            .send(crate::download::DownloadEvent::Done { path: output_path });
                        break;
                    }

                    // Check if this was a 429 rate-limit error
                    let is_429 = stderr_lines
                        .lock()
                        .map(|guard| guard.iter().any(|l| is_rate_limit_error(l)))
                        .unwrap_or(false);

                    if is_429 && attempt < 3 {
                        let wait_secs = BACKOFF_SECS[attempt as usize];

                        // Send initial RetryWait event
                        let _ = on_event.send(crate::download::DownloadEvent::RetryWait {
                            attempt: attempt + 1,
                            wait_secs,
                            remaining_secs: wait_secs,
                        });

                        // Countdown loop — 1 event per second
                        for remaining in (0..wait_secs).rev() {
                            // Check for cancellation: if item_id no longer in queue_pids
                            // (it was removed by cancel), abort the retry
                            let cancelled = app_clone
                                .state::<crate::state::AppState>()
                                .queue_pids
                                .lock()
                                .map(|guard| !guard.contains_key(&item_id_clone))
                                .unwrap_or(false);
                            if cancelled {
                                return;
                            }

                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;

                            let _ = on_event.send(crate::download::DownloadEvent::RetryWait {
                                attempt: attempt + 1,
                                wait_secs,
                                remaining_secs: remaining,
                            });
                        }

                        attempt += 1;
                        // Continue loop — re-spawn yt-dlp for next attempt
                    } else if is_429 {
                        // Exhausted all 3 retry attempts
                        let _ = on_event.send(crate::download::DownloadEvent::Error {
                            message: "YouTube rate limit (429). Tried 3 times with backoff. Try again later.".to_string(),
                        });
                        break;
                    } else {
                        // Non-429 error — emit the first recognizable error from stderr
                        let error_msg = stderr_lines
                            .lock()
                            .ok()
                            .and_then(|guard| {
                                guard.iter().find_map(|l| crate::errors::parse_ytdlp_error(l))
                            })
                            .unwrap_or_else(|| {
                                format!(
                                    "yt-dlp exited with code {}",
                                    status.code().unwrap_or(-1)
                                )
                            });
                        let _ = on_event.send(crate::download::DownloadEvent::Error {
                            message: error_msg,
                        });
                        break;
                    }
                }
                Err(e) => {
                    let _ = on_event.send(crate::download::DownloadEvent::Error {
                        message: format!("Failed to wait for yt-dlp: {}", e),
                    });
                    break;
                }
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
