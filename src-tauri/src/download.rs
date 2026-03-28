use std::process::Stdio;
use tauri::Manager;
use tokio::io::AsyncBufReadExt;
use tokio::process::Command;

#[derive(serde::Serialize, Clone, Debug)]
#[serde(tag = "type", content = "data")]
pub enum DownloadEvent {
    Starting,
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
    RetryWait {
        attempt: u32,
        wait_secs: u64,
        remaining_secs: u64,
    },
}

/// Locate a sidecar binary adjacent to the current executable.
///
/// In Tauri dev builds, sidecars are placed in `target/debug/` WITHOUT the
/// target-triple suffix (e.g. `target/debug/yt-dlp`).
/// In Tauri production bundles, they keep the triple suffix
/// (e.g. `Contents/MacOS/yt-dlp-aarch64-apple-darwin`).
pub fn locate_sidecar(name: &str) -> Result<std::path::PathBuf, String> {
    // Test hook: YTDLP_PATH env var overrides normal sidecar lookup
    if let Ok(p) = std::env::var("YTDLP_PATH") {
        return Ok(std::path::PathBuf::from(p));
    }

    let exe = std::env::current_exe().map_err(|e| format!("current_exe: {}", e))?;
    let dir = exe.parent().ok_or("no parent dir for executable")?;

    // On Windows binaries need .exe extension
    let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };

    // Dev mode: no triple suffix
    let simple = dir.join(format!("{}{}", name, ext));
    if simple.exists() {
        return Ok(simple);
    }

    // Production mode: with compile-time target triple
    let triple: &str = if cfg!(all(target_arch = "aarch64", target_os = "macos")) {
        "aarch64-apple-darwin"
    } else if cfg!(all(target_arch = "x86_64", target_os = "macos")) {
        "x86_64-apple-darwin"
    } else if cfg!(all(target_arch = "x86_64", target_os = "windows")) {
        "x86_64-pc-windows-msvc"
    } else if cfg!(all(target_arch = "x86_64", target_os = "linux")) {
        "x86_64-unknown-linux-gnu"
    } else {
        ""
    };

    if !triple.is_empty() {
        let with_triple = dir.join(format!("{}-{}{}", name, triple, ext));
        if with_triple.exists() {
            return Ok(with_triple);
        }
    }

    Err(format!("sidecar '{}' not found in {:?}", name, dir))
}

/// Create a Command for a yt-dlp sidecar with UTF-8 forced on Windows.
/// On Windows, yt-dlp (Python) defaults to the system code page (e.g. CP949),
/// which corrupts Korean and other non-ASCII output. PYTHONUTF8=1 fixes this.
pub fn ytdlp_command(path: &std::path::Path) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(path);
    #[cfg(target_os = "windows")]
    cmd.env("PYTHONUTF8", "1");
    cmd
}

pub fn parse_yt_dlp_line(line: &str) -> Option<DownloadEvent> {
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
        if let Some(msg) = crate::errors::parse_ytdlp_error(line) {
            return Some(DownloadEvent::Error { message: msg });
        }
    }
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
        if let Some(msg) = crate::errors::parse_ytdlp_error(line) {
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
    let ytdlp_path = locate_sidecar("yt-dlp")?;
    let ffmpeg_path = locate_sidecar("ffmpeg")?;
    let ffmpeg_str = ffmpeg_path.to_string_lossy().to_string();

    // Detect playlists: skip blocking title-fetch and use yt-dlp's own naming.
    // For single videos we pre-fetch the title so we can clean noise words.
    let is_playlist = url.contains("list=") || url.contains("/playlist");

    // Get cookie args from AppState before entering async branches
    let cookie_args = {
        let state = app.state::<crate::state::AppState>();
        crate::cookies::cookie_file_args(&state)
    };

    // Emit Starting immediately — covers the title-fetch gap before progress begins
    let _ = on_event.send(DownloadEvent::Starting);

    let (output_template, output_path) = if is_playlist {
        let template = format!("{}/%(playlist_index)02d - %(title)s.%(ext)s", save_dir);
        let path = save_dir.clone(); // report the folder, not a single file
        (template, path)
    } else {
        // Step 1: Get raw title (no download)
        let title_output = Command::new(&ytdlp_path)
            .args(["--print", "title", &url])
            .args(&cookie_args)
            .output()
            .await
            .map_err(|e| format!("Failed to get title: {}", e))?;

        let raw_title = String::from_utf8_lossy(&title_output.stdout)
            .trim()
            .to_string();
        let cleaned_title = crate::title::clean_title(&raw_title);
        let safe_title = crate::title::sanitize_filename(&cleaned_title);

        let path = format!("{}/{}.mp3", save_dir, safe_title);
        let template = format!("{}/{}.%(ext)s", save_dir, safe_title);
        (template, path)
    };

    // Step 2: Spawn download process with streaming output
    let mut child = Command::new(&ytdlp_path)
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
            &url,
        ])
        .args(&cookie_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    // Store PID in AppState for cleanup on app exit
    if let Some(pid) = child.id() {
        let state = app.state::<crate::state::AppState>();
        if let Ok(mut guard) = state.active_pid.lock() {
            *guard = Some(pid);
        };
    }

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let on_event_stdout = on_event.clone();
    let on_event_stderr = on_event.clone();

    // Stream stdout (progress lines)
    tauri::async_runtime::spawn(async move {
        let mut reader = tokio::io::BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if let Some(evt) = parse_yt_dlp_line(&line) {
                let _ = on_event_stdout.send(evt);
            }
        }
    });

    // Stream stderr (error lines)
    tauri::async_runtime::spawn(async move {
        let mut reader = tokio::io::BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if let Some(evt) = parse_yt_dlp_line(&line) {
                let _ = on_event_stderr.send(evt);
            }
        }
    });

    // Wait for process and emit Done/Error
    tauri::async_runtime::spawn(async move {
        match child.wait().await {
            Ok(status) => {
                if status.success() {
                    let _ = on_event.send(DownloadEvent::Done { path: output_path });
                } else {
                    let _ = on_event.send(DownloadEvent::Error {
                        message: format!(
                            "yt-dlp exited with code {}",
                            status.code().unwrap_or(-1)
                        ),
                    });
                }
            }
            Err(e) => {
                let _ = on_event.send(DownloadEvent::Error {
                    message: format!("Failed to wait for yt-dlp: {}", e),
                });
            }
        }
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_progress_line() {
        let evt = parse_yt_dlp_line("PROGRESS 42.5 1.2MiB/s 00:30");
        assert!(evt.is_some(), "expected Some for valid PROGRESS line");
        match evt.unwrap() {
            DownloadEvent::Progress { percent, speed, eta } => {
                assert!((percent - 42.5).abs() < 0.01, "percent should be ~42.5, got {}", percent);
                assert_eq!(speed, "1.2MiB/s");
                assert_eq!(eta, "00:30");
            }
            other => panic!("expected Progress, got {:?}", other),
        }
    }

    #[test]
    fn test_parse_error_keyword_video_unavailable() {
        let evt = parse_yt_dlp_line("ERROR: Video unavailable");
        assert!(evt.is_some(), "expected Some for ERROR line");
        match evt.unwrap() {
            DownloadEvent::Error { message } => {
                assert!(
                    message.contains("unavailable") || message.contains("removed"),
                    "message should mention unavailable, got: {}", message
                );
            }
            other => panic!("expected Error, got {:?}", other),
        }
    }

    // -- locate_sidecar tests (per D-03, D-06, D-07) --

    fn write_fake_binary(dir: &std::path::Path, name: &str) -> std::path::PathBuf {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let path = dir.join(name);
            std::fs::write(&path, "#!/bin/sh\nexit 0").unwrap();
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
            path
        }
        #[cfg(windows)]
        {
            let path = dir.join(format!("{}.bat", name));
            std::fs::write(&path, "@exit /b 0").unwrap();
            path
        }
    }

    #[test]
    fn test_locate_sidecar_via_env_override() {
        let dir = tempfile::tempdir().unwrap();
        let fake_path = write_fake_binary(dir.path(), "yt-dlp-fake");

        std::env::set_var("YTDLP_PATH", fake_path.to_str().unwrap());
        let result = locate_sidecar("yt-dlp");
        std::env::remove_var("YTDLP_PATH");

        assert!(result.is_ok(), "locate_sidecar should succeed with YTDLP_PATH set");
        assert_eq!(result.unwrap(), fake_path);
    }

    #[test]
    fn test_locate_sidecar_missing_returns_err_in_ci() {
        std::env::remove_var("YTDLP_PATH");
        if std::env::var("CI").is_ok() {
            let result = locate_sidecar("yt-dlp-nonexistent-test-binary-xyz");
            assert!(result.is_err(), "locate_sidecar should fail for nonexistent binary in CI");
        }
    }
}
