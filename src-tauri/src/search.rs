use regex::Regex;
use std::collections::HashMap;
use tokio::process::Command;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub thumbnail_url: String,
    pub duration: String,
    pub channel: String,
}

#[derive(serde::Serialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub used_fallback: bool,
}

/// Parse ISO 8601 duration string (e.g. PT4M13S) into display format (e.g. "4:13")
fn parse_iso_duration(iso: &str) -> String {
    let re = Regex::new(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?").unwrap();
    if let Some(caps) = re.captures(iso) {
        let hours: u32 = caps.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
        let minutes: u32 = caps.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
        let seconds: u32 = caps.get(3).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);

        if hours > 0 {
            format!("{}:{:02}:{:02}", hours, minutes, seconds)
        } else {
            format!("{}:{:02}", minutes, seconds)
        }
    } else {
        "?".to_string()
    }
}

/// Search YouTube using the Data API v3.
/// Makes two requests: search (snippet) + videos (contentDetails for duration).
#[tauri::command]
pub async fn search_youtube_api(
    query: String,
    api_key: String,
) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::new();

    // Step 1: Search for videos
    let search_resp = client
        .get("https://www.googleapis.com/youtube/v3/search")
        .query(&[
            ("part", "snippet"),
            ("q", &query),
            ("type", "video"),
            ("maxResults", "10"),
            ("key", &api_key),
        ])
        .send()
        .await
        .map_err(|e| format!("YouTube API search request failed: {}", e))?;

    let search_json: serde_json::Value = search_resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse YouTube API search response: {}", e))?;

    // Check for API error
    if let Some(error) = search_json.get("error") {
        let msg = error
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("unknown API error");
        return Err(format!("YouTube API error: {}", msg));
    }

    let items = search_json
        .get("items")
        .and_then(|i| i.as_array())
        .ok_or("No items in YouTube API search response")?;

    // Collect video IDs and snippet data
    let mut id_to_snippet: HashMap<String, (String, String, String)> = HashMap::new();
    let mut video_ids: Vec<String> = Vec::new();

    for item in items {
        let video_id = item
            .pointer("/id/videoId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if video_id.is_empty() {
            continue;
        }

        let title = item
            .pointer("/snippet/title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let channel = item
            .pointer("/snippet/channelTitle")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let thumbnail = item
            .pointer("/snippet/thumbnails/medium/url")
            .or_else(|| item.pointer("/snippet/thumbnails/default/url"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        id_to_snippet.insert(video_id.clone(), (title, channel, thumbnail));
        video_ids.push(video_id);
    }

    if video_ids.is_empty() {
        return Ok(vec![]);
    }

    // Step 2: Get content details (duration) for all video IDs
    let ids_param = video_ids.join(",");
    let details_resp = client
        .get("https://www.googleapis.com/youtube/v3/videos")
        .query(&[
            ("part", "contentDetails"),
            ("id", &ids_param),
            ("key", &api_key),
        ])
        .send()
        .await
        .map_err(|e| format!("YouTube API details request failed: {}", e))?;

    let details_json: serde_json::Value = details_resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse YouTube API details response: {}", e))?;

    let detail_items = details_json
        .get("items")
        .and_then(|i| i.as_array())
        .cloned()
        .unwrap_or_default();

    // Build a map of video ID → duration string
    let mut id_to_duration: HashMap<String, String> = HashMap::new();
    for item in &detail_items {
        let video_id = item
            .pointer("/id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let iso_duration = item
            .pointer("/contentDetails/duration")
            .and_then(|v| v.as_str())
            .unwrap_or("PT0S")
            .to_string();

        id_to_duration.insert(video_id, parse_iso_duration(&iso_duration));
    }

    // Merge results in original order
    let results = video_ids
        .into_iter()
        .filter_map(|id| {
            let (title, channel, thumbnail) = id_to_snippet.remove(&id)?;
            let duration = id_to_duration.get(&id).cloned().unwrap_or_else(|| "?".to_string());
            Some(SearchResult {
                id,
                title,
                thumbnail_url: thumbnail,
                duration,
                channel,
            })
        })
        .collect();

    Ok(results)
}

/// Search YouTube using yt-dlp's built-in search (ytsearch5:).
/// Collects all stdout at once — do NOT stream line-by-line.
#[tauri::command]
pub async fn search_ytdlp(query: String) -> Result<Vec<SearchResult>, String> {
    let ytdlp_path = crate::download::locate_sidecar("yt-dlp")?;

    let search_arg = format!("ytsearch5:{}", query);

    let output = Command::new(&ytdlp_path)
        .args([
            "--print",
            "%(id)s\t%(title)s\t%(thumbnail)s\t%(duration_string)s\t%(channel)s",
            "--flat-playlist",
            "--no-warnings",
            &search_arg,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to spawn yt-dlp for search: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    let results = stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(5, '\t').collect();
            if parts.len() < 5 {
                return None;
            }
            Some(SearchResult {
                id: parts[0].to_string(),
                title: parts[1].to_string(),
                thumbnail_url: parts[2].to_string(),
                duration: parts[3].to_string(),
                channel: parts[4].to_string(),
            })
        })
        .collect();

    Ok(results)
}

/// Unified search entry point.
/// - If query is a URL: use yt-dlp to fetch single-video metadata.
/// - If query is a keyword: try YouTube API first (if api_key provided), fall back to yt-dlp.
#[tauri::command]
pub async fn search(query: String, api_key: Option<String>) -> Result<SearchResponse, String> {
    let is_url = query.starts_with("http://")
        || query.starts_with("https://")
        || query.starts_with("youtu.be");

    if is_url {
        // Single-video metadata via yt-dlp
        let ytdlp_path = crate::download::locate_sidecar("yt-dlp")?;

        let output = Command::new(&ytdlp_path)
            .args([
                "--print",
                "%(id)s\t%(title)s\t%(thumbnail)s\t%(duration_string)s\t%(channel)s",
                "--no-warnings",
                "--no-playlist",
                &query,
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to spawn yt-dlp for URL lookup: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let line = stdout.trim();

        if line.is_empty() {
            return Ok(SearchResponse {
                results: vec![],
                used_fallback: true,
            });
        }

        let parts: Vec<&str> = line.splitn(5, '\t').collect();
        if parts.len() < 5 {
            return Err(format!("Unexpected yt-dlp output format for URL: {}", line));
        }

        return Ok(SearchResponse {
            results: vec![SearchResult {
                id: parts[0].to_string(),
                title: parts[1].to_string(),
                thumbnail_url: parts[2].to_string(),
                duration: parts[3].to_string(),
                channel: parts[4].to_string(),
            }],
            used_fallback: true,
        });
    }

    // Keyword search
    let key = api_key.filter(|k| !k.trim().is_empty());

    if let Some(key) = key {
        // Try YouTube API first
        match search_youtube_api(query.clone(), key).await {
            Ok(results) => {
                return Ok(SearchResponse {
                    results,
                    used_fallback: false,
                });
            }
            Err(e) => {
                eprintln!("YouTube API search failed (falling back to yt-dlp): {}", e);
            }
        }
    }

    // Fallback to yt-dlp
    let results = search_ytdlp(query).await?;
    Ok(SearchResponse {
        results,
        used_fallback: true,
    })
}
