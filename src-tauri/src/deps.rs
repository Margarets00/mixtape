/// Dependency management for the no-preinstall build variant.
/// Also used in the full (bundled) build — locate_sidecar handles both transparently.

#[derive(serde::Serialize)]
pub struct DepStatus {
    pub found: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

/// Check whether yt-dlp and ffmpeg are locatable and return their versions.
#[tauri::command]
pub async fn check_deps() -> Result<serde_json::Value, String> {
    let ytdlp = probe_dep("yt-dlp").await;
    let ffmpeg = probe_dep("ffmpeg").await;
    Ok(serde_json::json!({
        "ytdlp": ytdlp,
        "ffmpeg": ffmpeg,
    }))
}

async fn probe_dep(name: &str) -> DepStatus {
    match crate::download::locate_sidecar(name) {
        Err(_) => DepStatus { found: false, path: None, version: None },
        Ok(path) => {
            let version = get_version(&path, name).await;
            DepStatus {
                found: true,
                path: Some(path.to_string_lossy().into_owned()),
                version,
            }
        }
    }
}

async fn get_version(path: &std::path::Path, name: &str) -> Option<String> {
    let arg = if name == "ffmpeg" { "-version" } else { "--version" };
    let out = tokio::process::Command::new(path)
        .arg(arg)
        .output()
        .await
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    // First line, trimmed
    text.lines().next().map(|l| l.trim().to_string())
}

/// Persist a custom binary path to app-settings.json so locate_sidecar picks it up.
/// key: "ytdlp" | "ffmpeg"
#[tauri::command]
pub async fn set_dep_path(key: String, path: String) -> Result<(), String> {
    let settings_key = match key.as_str() {
        "ytdlp" => "dep_path_ytdlp",
        "ffmpeg" => "dep_path_ffmpeg",
        _ => return Err(format!("unknown dep key: {}", key)),
    };

    // Validate the path exists
    if !path.is_empty() && !std::path::Path::new(&path).exists() {
        return Err(format!("path does not exist: {}", path));
    }

    // Read existing settings, patch, write back
    let config_dir = dirs_next::config_dir()
        .ok_or("cannot determine config directory")?;
    let settings_path = config_dir.join("mixtape").join("app-settings.json");

    let mut json: serde_json::Value = if settings_path.exists() {
        let contents = std::fs::read_to_string(&settings_path)
            .map_err(|e| format!("read settings: {}", e))?;
        serde_json::from_str(&contents).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    if path.is_empty() {
        json.as_object_mut().map(|o| o.remove(settings_key));
    } else {
        json[settings_key] = serde_json::Value::String(path);
    }

    std::fs::create_dir_all(settings_path.parent().unwrap())
        .map_err(|e| format!("create config dir: {}", e))?;
    std::fs::write(&settings_path, serde_json::to_string_pretty(&json).unwrap())
        .map_err(|e| format!("write settings: {}", e))?;

    Ok(())
}
