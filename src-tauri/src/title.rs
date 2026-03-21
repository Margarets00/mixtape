use regex::Regex;

static NOISE_PATTERNS: &[&str] = &[
    r"(?i)\[official\s*(music\s*)?video\]",
    r"(?i)\[official\s*mv\]",
    r"(?i)\(official\s*(music\s*)?video\)",
    r"(?i)\(official\s*mv\)",
    r"(?i)\[lyrics?\]",
    r"(?i)\(lyrics?\)",
    r"(?i)\[audio\]",
    r"(?i)\(audio\)",
    r"(?i)\[hd\]",
    r"(?i)\[4k\]",
    r"(?i)\[mv\]",
    r"(?i)\(mv\)",
    r"(?i)\[visualizer\]",
    r"(?i)\(visualizer\)",
];

pub fn clean_title(raw: &str) -> String {
    let mut s = raw.to_string();
    for pattern in NOISE_PATTERNS {
        let re = Regex::new(pattern).unwrap();
        s = re.replace_all(&s, "").to_string();
    }
    // Normalize whitespace: collapse multiple spaces to one, trim
    let re_spaces = Regex::new(r"\s{2,}").unwrap();
    re_spaces.replace_all(s.trim(), " ").to_string()
}

pub fn sanitize_filename(name: &str) -> String {
    let re = Regex::new(r#"[<>:"/\\|?*]"#).unwrap();
    re.replace_all(name, "").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_official_video() {
        assert_eq!(
            clean_title("Rick Astley - Never Gonna Give You Up [Official Video]"),
            "Rick Astley - Never Gonna Give You Up"
        );
    }

    #[test]
    fn test_clean_official_mv() {
        assert_eq!(
            clean_title("Some Song (Official MV)"),
            "Some Song"
        );
    }

    #[test]
    fn test_clean_lyrics() {
        assert_eq!(
            clean_title("Some Song (Lyrics)"),
            "Some Song"
        );
    }

    #[test]
    fn test_clean_audio() {
        assert_eq!(
            clean_title("Some Song [Audio]"),
            "Some Song"
        );
    }

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(
            sanitize_filename("Song: Artist / Album"),
            "Song Artist  Album"
        );
    }
}
