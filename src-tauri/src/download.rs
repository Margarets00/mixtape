use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

use crate::errors;

#[derive(serde::Serialize, Clone)]
#[serde(tag = "type", content = "data")]
pub enum DownloadEvent {
    Progress {
        percent: f32,
        speed: String,
        eta: String,
    },
    Postprocessing,
    Done {
        path: String,
    },
    Error {
        message: String,
    },
}

fn resolve_sidecar_path(app: &tauri::AppHandle, name: &str) -> Result<String, String> {
    app.path()
        .resolve(
            format!("binaries/{}", name),
            tauri::path::BaseDirectory::Resource,
        )
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to resolve {} path: {}", name, e))
}

fn parse_yt_dlp_line(line: &str) -> Option<DownloadEvent> {
    if line.starts_with("PROGRESS ") {
        let parts: Vec<&str> = line.splitn(4, ' ').collect();
        if parts.len() >= 4 {
            let percent = parts[1].parse::<f32>().ok()?;
            return Some(DownloadEvent::Progress {
                percent,
                speed: parts[2].to_string(),
                eta: parts[3].trim().to_string(),
            });
        }
    }
    if line.contains("[ExtractAudio]") || line.contains("Destination:") {
        return Some(DownloadEvent::Postprocessing);
    }
    if line.contains("ERROR:") {
        if let Some(msg) = errors::parse_ytdlp_error(line) {
            return Some(DownloadEvent::Error { message: msg });
        }
    }
    // Check other specific error patterns (non-ERROR: prefixed)
    if line.contains("HTTP Error 429")
        || line.contains("HTTP Error 403")
        || line.contains("Video unavailable")
        || line.contains("This video is not available")
        || line.contains("Sign in to confirm")
        || line.contains("Private video")
        || line.contains("ffmpeg not found")
        || line.contains("ffprobe and ffmpeg not found")
        || line.contains("urlopen error")
        || line.contains("Unable to connect")
        || line.contains("is not a valid URL")
        || line.contains("Unsupported URL")
    {
        if let Some(msg) = errors::parse_ytdlp_error(line) {
            return Some(DownloadEvent::Error { message: msg });
        }
    }
    None
}

#[tauri::command]
pub async fn download(
    app: tauri::AppHandle,
    url: String,
    save_dir: String,
    on_event: tauri::ipc::Channel<DownloadEvent>,
) -> Result<(), String> {
    let ffmpeg_path = resolve_sidecar_path(&app, "ffmpeg")?;

    // Step 1: Get raw title (no download)
    let title_output = app
        .shell()
        .sidecar("binaries/yt-dlp")
        .map_err(|e| format!("Failed to create yt-dlp sidecar: {}", e))?
        .args(["--print", "title", &url])
        .output()
        .await
        .map_err(|e| format!("Failed to get title: {}", e))?;

    let raw_title = String::from_utf8_lossy(&title_output.stdout)
        .trim()
        .to_string();
    let cleaned_title = crate::title::clean_title(&raw_title);
    let safe_title = crate::title::sanitize_filename(&cleaned_title);

    // Construct deterministic output path
    let output_path = format!("{}/{}.mp3", save_dir, safe_title);
    let output_template = format!("{}/{}.%(ext)s", save_dir, safe_title);

    // Step 2: Download with cleaned title as output filename
    let (mut rx, child) = app
        .shell()
        .sidecar("binaries/yt-dlp")
        .map_err(|e| format!("Failed to create yt-dlp sidecar: {}", e))?
        .args([
            "-x",
            "--audio-format",
            "mp3",
            "--audio-quality",
            "0",
            "--embed-metadata",
            "--ffmpeg-location",
            &ffmpeg_path,
            "--progress-template",
            "download:PROGRESS %(progress._percent)f %(progress._speed_str)s %(progress._eta_str)s",
            "--newline",
            "-o",
            &output_template,
            &url,
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    // Store child handle in AppState for cleanup on app exit
    {
        let state = app.state::<crate::state::AppState>();
        let mut guard = state
            .active_child
            .lock()
            .map_err(|e| e.to_string())?;
        *guard = Some(child);
    }

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    if let Some(evt) = parse_yt_dlp_line(&text) {
                        let _ = on_event.send(evt);
                    }
                }
                CommandEvent::Terminated(status) => {
                    if status.code.unwrap_or(-1) == 0 {
                        // Deterministic path — we control the -o template with safe_title
                        let _ = on_event.send(DownloadEvent::Done {
                            path: output_path,
                        });
                    } else {
                        let _ = on_event.send(DownloadEvent::Error {
                            message: format!(
                                "yt-dlp exited with code {}",
                                status.code.unwrap_or(-1)
                            ),
                        });
                    }
                    // Clear active child state
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
}
