use tokio::process::Command;

use crate::download::locate_sidecar;

#[derive(serde::Serialize)]
pub struct VersionInfo {
    pub current: String,
    pub latest: String,
    pub update_available: bool,
}

#[tauri::command]
pub async fn check_ytdlp_version() -> Result<VersionInfo, String> {
    let current = get_current_version().await?;
    let latest = get_latest_version().await?;
    let update_available = latest != current;
    Ok(VersionInfo {
        current,
        latest,
        update_available,
    })
}

async fn get_current_version() -> Result<String, String> {
    let ytdlp_path = locate_sidecar("yt-dlp")?;
    let output = Command::new(&ytdlp_path)
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
pub async fn update_ytdlp() -> Result<String, String> {
    let asset_url = if cfg!(target_os = "macos") {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
    } else if cfg!(target_os = "windows") {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    } else {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
    };

    let sidecar_path = locate_sidecar("yt-dlp")?;

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

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&temp_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Failed to set executable permissions: {}", e))?;
    }

    std::fs::rename(&temp_path, &sidecar_path)
        .map_err(|e| format!("Failed to replace yt-dlp binary: {}", e))?;

    let new_version = get_current_version().await?;
    Ok(new_version)
}
