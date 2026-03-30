use tauri::Manager;

/// macOS 시스템 기본 브라우저를 감지하고 지원 브라우저이면 반환.
/// 폴백 순서: 기본 브라우저 → Chrome → Safari → Firefox
/// 반환값: "chrome" | "safari" | "firefox" | "chromium" | "brave" | "edge" | None
#[tauri::command]
pub async fn detect_cookie_browser(app: tauri::AppHandle) -> Result<Option<String>, String> {
    // macOS: defaults read 로 기본 브라우저 번들 ID 파악
    #[cfg(target_os = "macos")]
    {
        let detected = detect_macos_default_browser().await;
        if let Some(browser) = detected {
            let state = app.state::<crate::state::AppState>();
            if let Ok(mut guard) = state.cookie_browser.lock() {
                *guard = Some(browser.clone());
            }
            return Ok(Some(browser));
        }
    }

    // 폴백: Chrome → Safari → Firefox 순으로 시도
    for browser in &["chrome", "safari", "firefox"] {
        if browser_cookie_accessible(browser).await {
            let state = app.state::<crate::state::AppState>();
            if let Ok(mut guard) = state.cookie_browser.lock() {
                *guard = Some(browser.to_string());
            }
            return Ok(Some(browser.to_string()));
        }
    }

    Ok(None)
}

/// 저장된 브라우저로 AppState 업데이트 (설정 화면에서 수동 선택 시 호출)
#[tauri::command]
pub async fn set_cookie_browser(
    app: tauri::AppHandle,
    browser: Option<String>,
) -> Result<(), String> {
    let state = app.state::<crate::state::AppState>();
    if let Ok(mut guard) = state.cookie_browser.lock() {
        *guard = browser;
    }
    Ok(())
}

/// 저장된 브라우저 쿠키를 temp 파일로 내보내고 경로를 AppState에 저장.
/// 프론트엔드가 앱 시작 시 저장된 브라우저가 있을 때만 호출.
/// 실패해도 에러를 무시하고 계속 동작 (쿠키 없이 진행).
#[tauri::command]
pub async fn extract_saved_cookies(app: tauri::AppHandle) -> Result<(), String> {
    extract_cookies_to_tempfile(app).await
}

pub async fn extract_cookies_to_tempfile(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<crate::state::AppState>();
    let browser_opt = state.cookie_browser.lock().ok().and_then(|g| g.clone());
    let browser = match browser_opt {
        Some(b) => b,
        None => return Ok(()),
    };

    let pid = std::process::id();
    let tmp_path = format!("/tmp/yt-cookies-{}.txt", pid);

    let ytdlp_path = match crate::download::locate_sidecar("yt-dlp") {
        Ok(p) => p,
        Err(_) => return Ok(()),
    };

    let result = tokio::process::Command::new(&ytdlp_path)
        .args([
            "--cookies-from-browser",
            &browser,
            "--cookies",
            &tmp_path,
            "--skip-download",
            "--no-warnings",
            "https://www.youtube.com",
        ])
        .output()
        .await;

    if result.is_ok() && std::path::Path::new(&tmp_path).exists() {
        if let Ok(mut guard) = state.cookie_file_path.lock() {
            *guard = Some(tmp_path);
        }
    }

    Ok(())
}

/// yt-dlp Command에 추가할 쿠키 인자 반환.
/// cookie_file_path가 Some(path)이면 vec!["--cookies", path]
/// None이면 빈 Vec
pub fn cookie_file_args(state: &crate::state::AppState) -> Vec<String> {
    if let Ok(guard) = state.cookie_file_path.lock() {
        if let Some(ref path) = *guard {
            return vec!["--cookies".to_string(), path.clone()];
        }
    }
    vec![]
}

#[cfg(target_os = "macos")]
async fn detect_macos_default_browser() -> Option<String> {
    // LSCopyDefaultHandlerForURLScheme 대신 defaults read 사용
    // com.apple.LaunchServices plist에서 https 핸들러 번들 ID 읽기
    let output = tokio::process::Command::new("defaults")
        .args([
            "read",
            "/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure",
            "LSHandlers",
        ])
        .output()
        .await
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    bundle_id_to_browser(&stdout)
}

fn bundle_id_to_browser(plist_output: &str) -> Option<String> {
    // LSHandlers 배열에서 LSHandlerURLScheme = https 인 항목의 LSHandlerRoleAll 값 파악
    // plist 텍스트 출력 형식: 연속 행으로 key/value가 나옴
    let lines: Vec<&str> = plist_output.lines().collect();
    let mut i = 0;
    while i < lines.len() {
        // https 스킴 핸들러 블록 탐색
        if lines[i].contains("LSHandlerURLScheme") {
            // 다음 행이 "https" 값인지 확인
            let scheme_line = lines.get(i + 1).unwrap_or(&"");
            if scheme_line.contains("\"https\"") || scheme_line.contains("https") {
                // 이 블록에서 LSHandlerRoleAll 찾기 (앞뒤 3줄 이내)
                for j in i.saturating_sub(3)..=(i + 3).min(lines.len().saturating_sub(1)) {
                    if lines[j].contains("LSHandlerRoleAll") {
                        let bundle_line = lines.get(j + 1).unwrap_or(&"");
                        return parse_bundle_to_browser(bundle_line);
                    }
                }
            }
        }
        i += 1;
    }
    None
}

fn parse_bundle_to_browser(bundle_line: &str) -> Option<String> {
    let lower = bundle_line.to_lowercase();
    if lower.contains("chrome") {
        Some("chrome".to_string())
    } else if lower.contains("firefox") {
        Some("firefox".to_string())
    } else if lower.contains("safari") {
        Some("safari".to_string())
    } else if lower.contains("chromium") {
        Some("chromium".to_string())
    } else if lower.contains("brave") {
        Some("brave".to_string())
    } else if lower.contains("microsoft.edgemac") || lower.contains("edge") {
        Some("edge".to_string())
    } else {
        None
    }
}

async fn browser_cookie_accessible(browser: &str) -> bool {
    // yt-dlp --cookies-from-browser <browser> --skip-download을 빈 URL로 실행해서
    // 에러가 쿠키 접근 불가 에러인지 확인하는 대신,
    // 간단히 브라우저 프로파일 경로 존재 여부로 판단
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        let exists = match browser {
            "chrome" => std::path::Path::new(&format!(
                "{}/Library/Application Support/Google/Chrome/Default/Cookies", home
            )).exists(),
            "safari" => std::path::Path::new(&format!(
                "{}/Library/Safari/Cookies/Cookies.binarycookies", home
            )).exists(),
            "firefox" => std::path::Path::new(&format!(
                "{}/Library/Application Support/Firefox/Profiles", home
            )).exists(),
            "brave" => std::path::Path::new(&format!(
                "{}/Library/Application Support/BraveSoftware/Brave-Browser/Default/Cookies", home
            )).exists(),
            "chromium" => std::path::Path::new(&format!(
                "{}/Library/Application Support/Chromium/Default/Cookies", home
            )).exists(),
            "edge" => std::path::Path::new(&format!(
                "{}/Library/Application Support/Microsoft Edge/Default/Cookies", home
            )).exists(),
            _ => false,
        };
        return exists;
    }
    #[cfg(not(target_os = "macos"))]
    false
}
