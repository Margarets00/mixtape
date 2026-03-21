use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[derive(serde::Serialize)]
pub struct VersionInfo {
    pub current: String,
    pub latest: String,
    pub update_available: bool,
}

#[tauri::command]
pub async fn check_ytdlp_version(app: tauri::AppHandle) -> Result<VersionInfo, String> {
    // 1. Get current version by spawning: yt-dlp --version
    let current = get_current_version(&app).await?;

    // 2. Fetch latest tag from GitHub API
    let latest = get_latest_version().await?;

    // 3. Compare
    let update_available = latest != current;

    Ok(VersionInfo {
        current,
        latest,
        update_available,
    })
}

async fn get_current_version(app: &tauri::AppHandle) -> Result<String, String> {
    let output = app
        .shell()
        .sidecar("binaries/yt-dlp")
        .map_err(|e| format!("Failed to create yt-dlp sidecar: {}", e))?
        .args(["--version"])
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp --version: {}", e))?;

    let version = String::from_utf8_lossy(&output.stdout)
        .trim()
        .to_string();

    if version.is_empty() {
        return Err("yt-dlp returned empty version string".into());
    }

    Ok(version)
}

async fn get_latest_version() -> Result<String, String> {
    let client = reqwest::Client::new();
    let response: serde_json::Value = client
        .get("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")
        .header("User-Agent", "youtube-dl-app")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch GitHub releases: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub releases response: {}", e))?;

    let tag = response["tag_name"]
        .as_str()
        .ok_or_else(|| "GitHub API response missing tag_name field".to_string())?
        .to_string();

    Ok(tag)
}

#[tauri::command]
pub async fn update_ytdlp(app: tauri::AppHandle) -> Result<String, String> {
    // 1. Determine platform-specific asset URL
    let asset_url = if cfg!(target_os = "macos") {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
    } else if cfg!(target_os = "windows") {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    } else {
        // Linux
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
    };

    // 2. Resolve sidecar path using the resource directory
    let sidecar_path = app
        .path()
        .resolve("binaries/yt-dlp", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve yt-dlp sidecar path: {}", e))?;

    let temp_path = {
        let mut p = sidecar_path.clone();
        let filename = p
            .file_name()
            .ok_or("Invalid sidecar path: no filename")?
            .to_string_lossy()
            .into_owned();
        p.set_file_name(format!("{}.new", filename));
        p
    };

    // 3. Download binary to temp path
    let client = reqwest::Client::new();
    let bytes = client
        .get(asset_url)
        .header("User-Agent", "youtube-dl-app")
        .send()
        .await
        .map_err(|e| format!("Failed to download yt-dlp update: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("Failed to read yt-dlp update bytes: {}", e))?;

    std::fs::write(&temp_path, &bytes)
        .map_err(|e| format!("Failed to write yt-dlp update to temp file: {}", e))?;

    // 4. Set executable permissions on Unix (macOS/Linux)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&temp_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Failed to set executable permissions: {}", e))?;
    }

    // 5. Atomic replace: rename temp file over the sidecar
    std::fs::rename(&temp_path, &sidecar_path)
        .map_err(|e| format!("Failed to replace yt-dlp binary: {}", e))?;

    // 6. Verify new version
    let new_version = get_current_version(&app).await?;

    Ok(new_version)
}
