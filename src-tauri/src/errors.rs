pub fn parse_ytdlp_error(line: &str) -> Option<String> {
    // Check patterns in priority order (429 before 403 to handle bot detection)
    if line.contains("HTTP Error 429") {
        return Some("YouTube is rate limiting requests. Wait a few minutes and try again.".into());
    }
    if line.contains("HTTP Error 403") {
        return Some(
            "This video is not available in your region or YouTube is blocking the request.".into(),
        );
    }
    if line.contains("Video unavailable") || line.contains("This video is not available") {
        return Some("This video is unavailable or has been removed.".into());
    }
    if line.contains("Sign in to confirm") || line.contains("Private video") {
        return Some("This video is private and cannot be downloaded.".into());
    }
    if line.contains("ffmpeg not found") || line.contains("ffprobe and ffmpeg not found") {
        return Some("ffmpeg binary is missing. Reinstall the app.".into());
    }
    if line.contains("urlopen error") || line.contains("Unable to connect") {
        return Some("Network error. Check your internet connection.".into());
    }
    if line.contains("is not a valid URL") || line.contains("Unsupported URL") {
        return Some("This URL is not a recognized YouTube link.".into());
    }
    if line.contains("ERROR:") {
        return Some(format!("Download error: {}", line.trim()));
    }
    None
}
