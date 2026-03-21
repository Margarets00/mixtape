# Phase 1: Download Engine - Research

**Researched:** 2026-03-21
**Domain:** Tauri v2 sidecar infrastructure, yt-dlp CLI integration, IPC progress streaming, ID3 tagging, title cleanup
**Confidence:** HIGH (core sidecar/IPC patterns from official docs); MEDIUM (yt-dlp bot detection, progress parsing); HIGH (plugin choices)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENG-01 | URL input downloads a single YouTube video as MP3 | yt-dlp CLI args `-x --audio-format mp3`, sidecar spawn from Rust |
| ENG-02 | yt-dlp + ffmpeg bundled as sidecars (macOS/Windows/Linux) | Tauri v2 `externalBin`, target-triple naming convention |
| ENG-03 | Real-time download progress sent Rust → frontend via IPC | `Channel<T>` in Tauri command is the correct primitive; `app.emit()` also works |
| ENG-04 | Save-folder dialog, last path persisted | `tauri-plugin-dialog` + `tauri-plugin-store` |
| ENG-05 | Title auto-cleanup (strip YouTube noise brackets) | Regex pipeline; patterns documented in Architecture section |
| ENG-06 | Basic ID3 tags (title, artist, year) via yt-dlp | `--embed-metadata` flag; yt-dlp writes from video metadata |
| ENG-07 | In-app yt-dlp update button (fetch from GitHub releases) | GitHub releases API `https://github.com/yt-dlp/yt-dlp/releases/latest` → download binary → replace sidecar |
| ENG-08 | Human-readable error messages for 429/403/unavailable/missing ffmpeg | Parse yt-dlp stderr; specific string patterns documented |
| ENG-09 | Cleanup child processes and temp files on quit | Tauri `RunEvent::Exit` hook + `Mutex<Option<Child>>` state pattern |
| UI-01 | Y2K / PPG / Hello Kitty / retro internet UI | CSS custom properties, pixel fonts from Google Fonts, pastel palette constants |
| UI-02 | Pastel palette (pink, blue, green), pixel/retro fonts | Palette documented in Architecture section |
| UI-03 | Cross-platform operation (macOS/Windows/Linux) | Sidecar target-triple matrix covers all three; no platform-specific UI code needed in Phase 1 |
</phase_requirements>

---

## Summary

Phase 1 builds the foundation: a Tauri v2 desktop app that bundles yt-dlp and ffmpeg as sidecar binaries, spawns them from Rust, streams live progress to the frontend over IPC, and delivers a tagged MP3 in a user-chosen folder. Every later phase depends on this infrastructure working correctly on all three platforms.

The single highest-risk item is sidecar binary naming. Tauri requires each binary file to be named `<name>-<target-triple>[.exe]` — and the exact triple differs between macOS ARM, macOS Intel, Windows, and Linux. Getting this wrong produces silent failures in packaged builds. The verified approach is to use `rustc --print host-tuple` (Rust 1.84+) or `rustc -Vv | grep host` on each build machine to obtain the correct triple at build time.

yt-dlp bot detection via PO tokens is an active area as of early 2026. For Phase 1 (single-URL download from a desktop IP), standard yt-dlp without PO token plugins usually works for public videos, but 403 errors caused by bot detection should be surfaced as a specific error message. The PO token provider ecosystem (`bgutil-ytdlp-pot-provider`) is available but adds complexity; defer to Phase 3 or as a hotfix if block rates increase.

**Primary recommendation:** Scaffold with `npm create tauri-app@latest`, use React + Vite for the frontend (team familiarity), bundle yt-dlp and ffmpeg as sidecars, use `Channel<T>` for IPC progress streaming, `tauri-plugin-store` for path persistence, and `tauri-plugin-dialog` for the folder picker.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tauri` (Rust crate) | 2.10.3 | Desktop app runtime, IPC, window management | Current stable; all Phase 1 APIs are stable |
| `tauri-plugin-shell` | 2.x | Spawn sidecar processes, read stdout/stderr | Required for `Command::sidecar()` and `spawn()` |
| `tauri-plugin-dialog` | 2.x | Native folder picker dialog | Official plugin; no DIY needed |
| `tauri-plugin-store` | 2.x | Persist last-used save path across restarts | Official key-value store; replaces manual JSON file writing |
| `@tauri-apps/api` | 2.x (match minor to crate) | Frontend JS bindings | Must match minor version of Rust crate |
| `@tauri-apps/plugin-dialog` | 2.x | JS binding for dialog | Must match plugin crate version |
| `@tauri-apps/plugin-store` | 2.x | JS binding for store | Must match plugin crate version |
| yt-dlp | 2025.12.08 (stable) or nightly | Download engine | Bundled as sidecar binary |
| ffmpeg | 7.x static build | Audio conversion (MP3) | Bundled as sidecar binary; static = no dylib deps |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `serde` + `serde_json` | latest | Serialize IPC event payloads | Any structured Rust → frontend message |
| `tokio` | 1.x | Async runtime for spawning and awaiting sidecar output | Already bundled by Tauri |

### Frontend Framework

Use **React + Vite**. Both React and Svelte work equally well with Tauri v2; React is chosen here for broad ecosystem familiarity. The retro Y2K UI is pure CSS — no animation library, no component library. Raw CSS custom properties + pixel font + pastel palette.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React | Svelte | Svelte is smaller and popular in Tauri community; React wins on ecosystem |
| `tauri-plugin-store` | Manual JSON file in AppData | Plugin handles path resolution cross-platform; don't hand-roll |
| `Channel<T>` for progress | `app.emit()` global events | Channels are ordered and faster; use for high-frequency progress; `emit()` is fine for one-off status events |
| Static ffmpeg build | System ffmpeg | System ffmpeg is invisible to `.app` bundle — never assume PATH |

### Installation

```bash
npm create tauri-app@latest youtube-dl-app -- --template react-ts
cd youtube-dl-app
npm install
# Add Tauri plugins
npm install @tauri-apps/plugin-dialog @tauri-apps/plugin-store
cargo add tauri-plugin-shell tauri-plugin-dialog tauri-plugin-store
```

---

## Architecture Patterns

### Recommended Project Structure

```
src-tauri/
├── binaries/                   # Sidecar binaries (git-ignored, populated by build script)
│   ├── yt-dlp-aarch64-apple-darwin
│   ├── yt-dlp-x86_64-apple-darwin
│   ├── yt-dlp-x86_64-unknown-linux-gnu
│   ├── yt-dlp-x86_64-pc-windows-msvc.exe
│   ├── ffmpeg-aarch64-apple-darwin
│   ├── ffmpeg-x86_64-apple-darwin
│   ├── ffmpeg-x86_64-unknown-linux-gnu
│   └── ffmpeg-x86_64-pc-windows-msvc.exe
├── capabilities/
│   └── default.json            # Shell permissions for sidecars
├── src/
│   ├── main.rs
│   ├── lib.rs
│   ├── download.rs             # Download command, progress streaming, error handling
│   ├── updater.rs              # yt-dlp GitHub release fetch + binary replace
│   └── state.rs                # AppState struct (active children, temp files)
└── tauri.conf.json

src/                            # React frontend
├── components/
│   ├── DownloadForm.tsx        # URL input + Download button
│   ├── ProgressBar.tsx         # Real-time progress bar
│   ├── FolderPicker.tsx        # Save path selector
│   └── ErrorBanner.tsx         # Human-readable error display
├── styles/
│   ├── theme.css               # Y2K palette + font variables
│   └── global.css
└── App.tsx
```

### Pattern 1: Sidecar Binary Naming

**What:** Each bundled binary must have the exact Rust target triple as a filename suffix. Wrong name = binary not found at runtime.

**How to get the triple on each build machine:**
```bash
# Rust 1.84+
rustc --print host-tuple

# Older Rust
rustc -Vv | grep host | cut -f2 -d' '

# Windows PowerShell
rustc -Vv | Select-String "host:" | ForEach-Object {$_.Line.split(" ")[1]}
```

**Platform matrix:**

| Platform | Target Triple | Binary Filename |
|----------|--------------|-----------------|
| macOS Apple Silicon | `aarch64-apple-darwin` | `yt-dlp-aarch64-apple-darwin` |
| macOS Intel | `x86_64-apple-darwin` | `yt-dlp-x86_64-apple-darwin` |
| Windows x64 | `x86_64-pc-windows-msvc` | `yt-dlp-x86_64-pc-windows-msvc.exe` |
| Linux x64 | `x86_64-unknown-linux-gnu` | `yt-dlp-x86_64-unknown-linux-gnu` |

**tauri.conf.json configuration:**
```json
{
  "bundle": {
    "externalBin": [
      "binaries/yt-dlp",
      "binaries/ffmpeg"
    ]
  }
}
```

Tauri appends the host triple automatically at bundle time. The file just needs to exist with the triple suffix.

Source: [Tauri v2 Embedding External Binaries](https://v2.tauri.app/develop/sidecar/)

### Pattern 2: Sidecar Spawn with Progress Streaming

**What:** Spawn yt-dlp from Rust, stream its stdout line-by-line, parse progress, emit to frontend via Channel.

```rust
// Source: https://v2.tauri.app/develop/sidecar/ + https://v2.tauri.app/develop/calling-frontend/
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use tauri::ipc::Channel;

#[derive(serde::Serialize, Clone)]
#[serde(tag = "type", content = "data")]
enum DownloadEvent {
    Progress { percent: f32, speed: String, eta: String },
    Postprocessing,
    Done { path: String },
    Error { message: String },
}

#[tauri::command]
async fn download(
    app: tauri::AppHandle,
    url: String,
    save_dir: String,
    on_event: Channel<DownloadEvent>,
) -> Result<(), String> {
    let ffmpeg_path = resolve_sidecar_path(&app, "ffmpeg")?;

    let (mut rx, child) = app
        .shell()
        .sidecar("yt-dlp")
        .unwrap()
        .args([
            "-x",
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "--embed-metadata",
            "--ffmpeg-location", &ffmpeg_path,
            "--progress-template",
            "download:PROGRESS %(progress._percent)f %(progress._speed_str)s %(progress._eta_str)s",
            "--newline",
            "-o", &format!("{}/%(title)s.%(ext)s", save_dir),
            &url,
        ])
        .spawn()
        .map_err(|e| e.to_string())?;

    // Store child for cleanup
    // ...

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                    let line = String::from_utf8_lossy(&line);
                    if let Some(evt) = parse_yt_dlp_line(&line) {
                        let _ = on_event.send(evt);
                    }
                }
                CommandEvent::Terminated(_) => break,
                _ => {}
            }
        }
    });

    Ok(())
}
```

**CRITICAL:** yt-dlp moved `[download]` progress output to **stderr** (not stdout) in a version from ~2022. Read BOTH `CommandEvent::Stdout` and `CommandEvent::Stderr`.

Source: [yt-dlp GitHub issue #3844](https://github.com/yt-dlp/yt-dlp/issues/3844)

### Pattern 3: ffmpeg Path Resolution

**What:** Resolve the sidecar binary path from inside a Tauri command to pass as `--ffmpeg-location`.

```rust
fn resolve_sidecar_path(app: &tauri::AppHandle, name: &str) -> Result<String, String> {
    app.path()
        .resolve(
            format!("binaries/{}", name),
            tauri::path::BaseDirectory::Resource,
        )
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}
```

In dev mode the path resolves to `src-tauri/binaries/`. In release mode it resolves inside the app bundle. Never hardcode `/usr/local/bin/ffmpeg` — it will not exist inside a macOS `.app` bundle.

### Pattern 4: IPC Channel vs. emit()

| Use Case | Primitive | Reason |
|----------|-----------|--------|
| Download progress (high frequency, per-line) | `Channel<T>` in command | Ordered, fast, no JS eval overhead |
| One-off status events (download started, error) | `app.emit("event", payload)` | Simple, global broadcast |

Source: [Tauri v2 Calling the Frontend](https://v2.tauri.app/develop/calling-frontend/)

### Pattern 5: yt-dlp stdout Progress Parsing

yt-dlp's progress output (with `--progress-template` and `--newline`) on stderr:

```
PROGRESS 45.3 1.2MiB/s 00:23
```

Use a custom prefix like `PROGRESS` to distinguish progress lines from other output:

```rust
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
    // Error detection (see Error Handling section)
    None
}
```

**Progress template args to pass to yt-dlp:**
```
--progress-template "download:PROGRESS %(progress._percent)f %(progress._speed_str)s %(progress._eta_str)s"
--newline
```

`%(progress._percent)f` gives a raw float (e.g., `45.3`), not the padded string — easier to parse.

### Pattern 6: Child Process Cleanup on Quit

```rust
// state.rs
use std::sync::Mutex;
use tauri_plugin_shell::process::CommandChild;

pub struct AppState {
    pub active_child: Mutex<Option<CommandChild>>,
}

// main.rs — in .setup() or builder:
.on_window_event(|window, event| {
    if let tauri::WindowEvent::Destroyed = event {
        // window close handled
    }
})
.build(tauri::generate_context!())?
.run(|app, event| {
    if let tauri::RunEvent::Exit = event {
        let state = app.state::<AppState>();
        if let Ok(mut child_opt) = state.active_child.lock() {
            if let Some(child) = child_opt.take() {
                let _ = child.kill();
            }
        }
        // Clean up temp files
    }
})
```

Note: `RunEvent::Exit` is more reliable than `CloseRequested` for cleanup — some close methods (Alt+F4, kill from task manager) may not trigger `CloseRequested`.

### Pattern 7: Title Cleanup Pipeline

**What:** Strip YouTube noise from video titles before using as filename and ID3 tag.

**Noise patterns to strip (case-insensitive):**

```rust
// Remove bracketed/parenthetical noise
static BRACKET_NOISE: &[&str] = &[
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
];

fn clean_title(raw: &str) -> String {
    let mut s = raw.to_string();
    for pattern in BRACKET_NOISE {
        let re = regex::Regex::new(pattern).unwrap();
        s = re.replace_all(&s, "").to_string();
    }
    // Normalize: multiple spaces → single, trim
    let re_spaces = regex::Regex::new(r"\s{2,}").unwrap();
    re_spaces.replace_all(s.trim(), " ").to_string()
}
```

Pass the cleaned title to yt-dlp's `-o` template using `%(title)s`. Alternatively, clean the output filename post-download via `fs::rename`. The simplest approach: let yt-dlp write with its default title, then rename using the cleaned title extracted from `--print title` beforehand.

**Best approach:** Use `yt-dlp --print title <url>` (no download) first to get the raw title, clean it in Rust, then pass as the `-o` output template value. This is cleaner than regex on filenames.

### Pattern 8: Persist Last Save Path

```typescript
// Frontend: FolderPicker.tsx
import { open } from '@tauri-apps/plugin-dialog';
import { load } from '@tauri-apps/plugin-store';

const store = await load('app-settings.json', { autoSave: true });

async function pickFolder() {
  const dir = await open({ directory: true, multiple: false });
  if (dir) {
    await store.set('lastSaveDir', dir);
    setSaveDir(dir);
  }
}

// On mount, restore last path
const saved = await store.get<string>('lastSaveDir');
if (saved) setSaveDir(saved);
```

### Pattern 9: yt-dlp In-App Update

**What:** Fetch latest yt-dlp binary from GitHub releases, replace the sidecar binary at runtime.

```rust
#[tauri::command]
async fn check_ytdlp_update(app: tauri::AppHandle) -> Result<String, String> {
    // 1. Fetch latest release info
    let client = reqwest::Client::new();
    let release: serde_json::Value = client
        .get("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")
        .header("User-Agent", "youtube-dl-app")
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let latest_tag = release["tag_name"].as_str().unwrap_or("").to_string();

    // 2. Compare with bundled version (run yt-dlp --version)
    // 3. If newer: find correct asset for current platform, download, verify, replace
    // 4. Replace sidecar binary at resource path
    Ok(latest_tag)
}
```

**Asset naming convention on yt-dlp GitHub releases:**
- macOS ARM: `yt-dlp_macos` (universal binary) or `yt-dlp_macos_legacy`
- Windows: `yt-dlp.exe`
- Linux: `yt-dlp`

**Critical:** Write the new binary to a temp path first, then `fs::rename` (atomic on same filesystem). Never write directly over the running binary. On macOS/Linux, `chmod +x` the new binary after write.

### Pattern 10: Capabilities Config for Sidecar

`src-tauri/capabilities/default.json` — must explicitly allow sidecar execution:

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-spawn",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        { "name": "binaries/yt-dlp", "sidecar": true },
        { "name": "binaries/ffmpeg", "sidecar": true }
      ]
    },
    "dialog:allow-open",
    "store:allow-load",
    "store:allow-set",
    "store:allow-get",
    "store:allow-save"
  ]
}
```

Source: [Tauri v2 Sidecar docs](https://v2.tauri.app/develop/sidecar/)

### Pattern 11: Y2K UI Design Tokens

```css
/* src/styles/theme.css */
:root {
  /* Pastel palette */
  --color-pink:      #FFB7D5;
  --color-pink-dark: #FF69B4;
  --color-blue:      #B7DFFF;
  --color-blue-dark: #5BA4D4;
  --color-green:     #B7FFD8;
  --color-yellow:    #FFF5B7;
  --color-white:     #FFFAFA;
  --color-black:     #2D1B1B;

  /* Typography */
  --font-display: 'Press Start 2P', monospace;   /* pixel font */
  --font-body:    'VT323', monospace;             /* retro terminal */

  /* Decorative */
  --border-style: 3px solid var(--color-pink-dark);
  --shadow-retro: 4px 4px 0px var(--color-pink-dark);
}
```

Fonts from Google Fonts: `Press Start 2P` (headers, buttons), `VT323` (body text).

### Anti-Patterns to Avoid

- **Hardcoding `/usr/local/bin/ffmpeg`:** App bundle has no shell PATH. Always pass `--ffmpeg-location` with the resolved sidecar path.
- **Reading only stdout from yt-dlp:** Progress and errors go to stderr. Read both channels.
- **Using `app.emit()` for high-frequency progress:** Use `Channel<T>` inside the command instead; avoids JS eval overhead per tick.
- **Writing new binary directly over running binary:** Use temp file + `fs::rename` for atomicity.
- **Assuming `CloseRequested` fires for all close methods:** Use `RunEvent::Exit` for guaranteed cleanup.
- **Not passing `--newline` to yt-dlp:** Without it, progress lines overwrite in-place with carriage returns and are harder to parse line-by-line from a Rust stream.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Folder picker dialog | Custom HTML file input | `tauri-plugin-dialog` | Native OS dialog, no filesystem scope issues |
| Persistent settings (last save dir, etc.) | Custom JSON file writer | `tauri-plugin-store` | Handles AppData path on all platforms, autoSave, concurrent access |
| Sidecar binary path resolution | String concatenation with `__dirname` | `app.path().resolve()` with `BaseDirectory::Resource` | Correct for both dev and release, cross-platform |
| App update mechanism for the Tauri app itself | Custom HTTP update checker | `tauri-plugin-updater` (Phase 4 concern) | Already exists; don't build a parallel system |

**Key insight:** Tauri's plugin ecosystem covers every OS-specific task in Phase 1. The only custom code needed is yt-dlp process management and progress parsing.

---

## Error Handling Map

Parse yt-dlp stderr to detect and surface specific errors:

| Error Condition | yt-dlp stderr Contains | User Message |
|-----------------|------------------------|--------------|
| Rate limit (429) | `HTTP Error 429` | "YouTube is rate limiting requests. Wait a few minutes and try again." |
| Geo-blocked (403) | `HTTP Error 403` | "This video is not available in your region (geo-blocked)." |
| Video unavailable | `Video unavailable` or `This video is not available` | "This video is unavailable or has been removed." |
| Private video | `Sign in to confirm` or `Private video` | "This video is private and cannot be downloaded." |
| ffmpeg not found | `ffmpeg not found` or `Postprocessing: ffprobe and ffmpeg not found` | "ffmpeg binary is missing. Reinstall the app." |
| Network error | `urlopen error` or `Unable to connect` | "Network error. Check your internet connection." |
| Invalid URL | `is not a valid URL` or `Unsupported URL` | "This URL is not a recognized YouTube link." |

**Implementation note:** YouTube sometimes returns HTTP 403 when the real cause is rate-limiting (bot detection). Check for both in sequence; if the URL is valid, prefer the "rate limit" message.

---

## Common Pitfalls

### Pitfall 1: Wrong Sidecar Binary Name (Silent Failure)

**What goes wrong:** App bundles successfully but silently fails to find yt-dlp at runtime. No error shown; nothing happens on Download click.
**Why it happens:** The binary filename does not exactly match `<name>-<target-triple>` for the build machine's platform.
**How to avoid:** Run `rustc --print host-tuple` on each platform before placing binaries. Automate with a download script in `scripts/download-sidecars.sh` that resolves the triple at script runtime.
**Warning signs:** `tauri dev` works but the packaged build does nothing; Tauri logs show "binary not found."

### Pitfall 2: macOS App Bundle Has No Shell PATH

**What goes wrong:** Works in `cargo tauri dev` (inherits developer shell PATH with ffmpeg), fails in packaged `.app` bundle.
**Why it happens:** `.app` bundles launch with a minimal environment. Homebrew ffmpeg at `/opt/homebrew/bin/ffmpeg` is not in PATH.
**How to avoid:** Always pass `--ffmpeg-location <resolved-sidecar-path>` to every yt-dlp invocation. Test in a packaged build, not just dev mode.
**Warning signs:** Download starts, progress shows ~90%, then fails at "Converting" step.

### Pitfall 3: yt-dlp Progress on stderr, Not stdout

**What goes wrong:** Progress bar never updates; stdout stream appears empty.
**Why it happens:** yt-dlp emits `[download]` progress lines to stderr, not stdout (changed ~2022, issue #3844).
**How to avoid:** Handle both `CommandEvent::Stdout` and `CommandEvent::Stderr` in the event loop.
**Warning signs:** No PROGRESS lines received; stderr stream contains all output.

### Pitfall 4: Carriage-Return Progress Lines Without --newline

**What goes wrong:** Progress lines come through as one long blob with `\r` characters, not parseable line-by-line.
**Why it happens:** yt-dlp default progress uses `\r` to overwrite the current line in a terminal.
**How to avoid:** Always pass `--newline` flag to yt-dlp. Each progress update then arrives as a distinct newline-terminated event.
**Warning signs:** `rx.recv()` delivers infrequent large chunks instead of steady small lines.

### Pitfall 5: Sidecar Permissions Not Configured

**What goes wrong:** `Unhandled Promise Rejection: shell command not allowed` in frontend, or silent failure in Rust.
**Why it happens:** Tauri v2 has strict capability-based permissions. Sidecar execution must be explicitly listed.
**How to avoid:** Add both `"shell:allow-spawn"` and an `"identifier": "shell:allow-execute"` entry with `"sidecar": true` for each binary in `capabilities/default.json`.
**Warning signs:** Errors mention "permission denied" or "not in allowlist."

### Pitfall 6: yt-dlp Bot Detection (PO Token) in 2025-2026

**What goes wrong:** Downloads fail intermittently with HTTP 403 or "Sign in to confirm you're not a bot" — especially from datacenter IPs or with rapid sequential downloads.
**Why it happens:** YouTube's BotGuard system requires PO tokens for some request paths since ~2024. Standard yt-dlp without a PO token provider may be blocked.
**How to avoid:** For Phase 1, surface a clear error message. The `bgutil-ytdlp-pot-provider` plugin can mitigate this but requires Node.js — out of scope for Phase 1. Most home IP downloads of public videos work without PO tokens.
**Warning signs:** `ERROR: [youtube] Sign in to confirm you're not a bot` in stderr.

### Pitfall 7: Writing Updated yt-dlp Binary Over Running Binary

**What goes wrong:** Binary replacement corrupts the file mid-use, or OS returns "file busy" error on Windows.
**Why it happens:** Windows locks executable files that are in use. On all platforms, overwriting a running process is unsafe.
**How to avoid:** Write new binary to `<path>.new`, then `fs::rename`. On Windows, may require the app to quit and relaunch from a stub; document this limitation.
**Warning signs:** Update appears to work but binary is corrupted; Windows `ERROR_SHARING_VIOLATION`.

---

## Code Examples

### Spawn yt-dlp sidecar and stream progress

```rust
// Source: https://v2.tauri.app/develop/sidecar/
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

let (mut rx, child) = app
    .shell()
    .sidecar("yt-dlp")
    .unwrap()
    .args(["-x", "--audio-format", "mp3", "--newline",
           "--progress-template",
           "download:PROGRESS %(progress._percent)f %(progress._speed_str)s %(progress._eta_str)s",
           "--ffmpeg-location", &ffmpeg_path,
           &url])
    .spawn()
    .expect("Failed to spawn yt-dlp");

tauri::async_runtime::spawn(async move {
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                let text = String::from_utf8_lossy(&line);
                // parse and forward via Channel
            }
            CommandEvent::Terminated(status) => {
                // done or error
                break;
            }
            _ => {}
        }
    }
});
```

### Emit from Rust to frontend (one-off events)

```rust
// Source: https://v2.tauri.app/develop/calling-frontend/
use tauri::Emitter;

app.emit("download-error", "HTTP Error 429: rate limited").unwrap();
```

### tauri-plugin-store usage (Frontend)

```typescript
// Source: https://v2.tauri.app/plugin/store/
import { load } from '@tauri-apps/plugin-store';

const store = await load('settings.json', { autoSave: true });
await store.set('lastSaveDir', '/Users/margaret/Music');
const dir = await store.get<string>('lastSaveDir'); // '/Users/margaret/Music'
```

### Open folder dialog (Frontend)

```typescript
// Source: https://v2.tauri.app/plugin/dialog/
import { open } from '@tauri-apps/plugin-dialog';

const dir = await open({
  directory: true,
  multiple: false,
  title: 'Choose save folder',
});
if (dir) { /* use dir as string */ }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| youtube-dl | yt-dlp (fork) | 2020 | yt-dlp has more active maintenance, better bot evasion, more formats |
| Tauri v1 `allowlist` in conf | Tauri v2 `capabilities/*.json` | Oct 2024 (v2 stable) | Capability files are per-window, more granular |
| `app.path_resolver()` | `app.path().resolve()` | Tauri v2 | API rename; old path_resolver() removed |
| yt-dlp progress on stdout | yt-dlp progress on **stderr** | ~2022 | Must read stderr for progress |
| `tauri::command` return `Result<T, String>` | Same (still idiomatic) | — | No change needed |

**Deprecated/outdated:**
- `allowlist` in `tauri.conf.json` (v1): Replaced by capability files in v2. Don't use.
- `tauri::api::path::home_dir()` (v1): Use `app.path().home_dir()` in v2.
- `app.path_resolver()` (v1): Use `app.path()` in v2.

---

## Open Questions

1. **yt-dlp update UX: auto-check on launch vs. user-triggered only**
   - What we know: ENG-07 specifies an in-app "Check for yt-dlp update" button (user-triggered). STATE.md flags this as a decision needed.
   - What's unclear: Should the app also auto-check silently at launch and badge the button?
   - Recommendation: Start with user-triggered only (matches ENG-07 spec exactly). Auto-check can be a one-liner addition later. Avoids network calls on every launch which may be surprising.

2. **macOS universal binary vs. separate ARM/Intel builds for yt-dlp**
   - What we know: yt-dlp ships a `yt-dlp_macos` universal binary on GitHub releases. Tauri's sidecar system expects separate files per target triple (aarch64 vs x86_64).
   - What's unclear: Can a universal binary be named with an aarch64 triple and work on both architectures, or must separate binaries be downloaded?
   - Recommendation: SPIKE required — download the universal binary, name it `yt-dlp-aarch64-apple-darwin`, test on Intel Mac. If it works universally, simplify the matrix. ffmpeg also has universal macOS builds.

3. **Linux target: first-class or best-effort?**
   - What we know: Roadmap says Phase 1 must work on macOS, Windows, and Linux. STATE.md flags this as open.
   - What's unclear: Which Linux distros to test; glibc version compatibility.
   - Recommendation: Use `x86_64-unknown-linux-gnu` (glibc target) for now. Test on Ubuntu 22.04 LTS as the reference. Musl builds add complexity — skip for Phase 1.

4. **ffmpeg static build sourcing**
   - What we know: System ffmpeg is not accessible in macOS `.app` bundles; must bundle.
   - What's unclear: Which static build source to use (evermeet.cx for macOS, BtbN for Windows, johnvansickle for Linux).
   - Recommendation: Use well-known static build sources per platform; document in build script. This is a build-time concern, not a code concern.

---

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Embedding External Binaries](https://v2.tauri.app/develop/sidecar/) — sidecar naming, configuration, permissions, Rust API
- [Tauri v2 Calling the Frontend](https://v2.tauri.app/develop/calling-frontend/) — Channel<T> vs emit(), event system patterns
- [Tauri Store Plugin](https://v2.tauri.app/plugin/store/) — persistent key-value store API
- [Tauri Dialog Plugin](https://v2.tauri.app/plugin/dialog/) — folder picker API
- [yt-dlp PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide) — current bot detection status

### Secondary (MEDIUM confidence)
- [yt-dlp issue #3844 — progress on stderr](https://github.com/yt-dlp/yt-dlp/issues/3844) — verified by multiple community reports
- [Tauri Kill Process on Exit discussion #3273](https://github.com/tauri-apps/tauri/discussions/3273) — RunEvent::Exit pattern
- [yt-dlp issue #12991 — progress stage info](https://github.com/yt-dlp/yt-dlp/issues/12991) — progress template variables
- [bgutil-ytdlp-pot-provider PyPI](https://pypi.org/project/bgutil-ytdlp-pot-provider/) — PO token provider availability

### Tertiary (LOW confidence — verify before use)
- yt-dlp latest stable tag `2025.12.08` — verify against [GitHub releases](https://github.com/yt-dlp/yt-dlp/releases) at build time
- Universal macOS binary usable for aarch64 target — SPIKE REQUIRED, not verified by official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries from official Tauri v2 docs, versions from crates.io/npm
- Architecture patterns: HIGH — sidecar/IPC/Channel patterns from official docs; progress parsing MEDIUM (community-sourced, cross-verified)
- Pitfalls: HIGH — most sourced from official GitHub issues and docs
- Bot detection state: MEDIUM — PO Token wiki is current but situation evolves weekly

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (30 days) for stable Tauri/plugin APIs; 7 days for yt-dlp bot detection state
