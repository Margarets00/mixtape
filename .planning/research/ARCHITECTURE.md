# Architecture Research

**Domain:** Tauri v2 desktop app — yt-dlp subprocess orchestration, audio streaming preview, concurrent download queue
**Researched:** 2026-03-21
**Confidence:** MEDIUM (Tauri v2 stable, released Oct 2024; training data covers to Aug 2025; web verification unavailable during this session)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (WebView / React)                    │
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │  Search UI  │  │  Queue Panel │  │  Audio Player (Web API) │  │
│  └─────┬──────┘  └──────┬───────┘  └────────────┬────────────┘  │
│        │                │                        │               │
│  ┌─────▼────────────────▼────────────────────────▼────────────┐  │
│  │               Zustand / Jotai State Store                   │  │
│  │  searchResults | downloadQueue | playerState | settings     │  │
│  └────────────────────────┬────────────────────────────────────┘  │
│                           │ invoke() / listen()                   │
└───────────────────────────┼───────────────────────────────────────┘
                            │ Tauri IPC Bridge
┌───────────────────────────┼───────────────────────────────────────┐
│                    RUST BACKEND (Tauri Core)                      │
│                                                                   │
│  ┌────────────────────────▼────────────────────────────────────┐  │
│  │                   Command Handlers                           │  │
│  │  search_youtube | start_download | cancel_download          │  │
│  │  get_audio_stream_url | set_save_path | get_queue_status    │  │
│  └───────┬──────────────────┬─────────────────┬───────────────┘  │
│          │                  │                 │                   │
│  ┌───────▼──────┐  ┌────────▼───────┐  ┌─────▼─────────────────┐ │
│  │  yt-dlp      │  │  Download Queue │  │  Binary Discovery /   │ │
│  │  Subprocess  │  │  (Tokio async,  │  │  Sidecar Resolver     │ │
│  │  Manager     │  │   max N jobs)   │  │  (yt-dlp + ffmpeg)    │ │
│  └───────┬──────┘  └────────┬───────┘  └───────────────────────┘ │
│          │                  │                                      │
│  ┌───────▼──────────────────▼──────────────────────────────────┐  │
│  │              Managed State (Arc<Mutex<AppState>>)            │  │
│  │  queue: Vec<DownloadJob> | active: HashMap<JobId, Child>    │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
       yt-dlp binary    ffmpeg binary   Filesystem
       (sidecar or      (sidecar or     (~/Music or
        system)          system)         user-chosen)
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Frontend State Store | Single source of truth for UI state | Zustand (React) — flat atoms per feature domain |
| Command Handlers | Tauri `#[tauri::command]` functions exposed to frontend | Rust async functions, thin orchestration layer |
| yt-dlp Subprocess Manager | Spawn, monitor, kill yt-dlp processes | `std::process::Command` or `tokio::process::Command` |
| Download Queue | Bounded concurrency, job lifecycle, cancel support | Tokio tasks + `Arc<Mutex<>>` or `tokio::sync::Semaphore` |
| Binary Discovery | Locate or unpack yt-dlp + ffmpeg at startup | Tauri sidecar API or PATH search with fallback |
| Audio Player | In-app preview playback, no local file | Browser Web Audio API / HTMLAudioElement pointing at YouTube stream URL |
| Progress IPC | Push download progress to frontend | Tauri `app_handle.emit()` events, frontend `listen()` |

---

## Recommended Project Structure

```
src-tauri/
├── src/
│   ├── main.rs                  # Tauri builder, plugin registration, state init
│   ├── commands/
│   │   ├── mod.rs               # Re-exports all command modules
│   │   ├── search.rs            # search_youtube command
│   │   ├── download.rs          # start_download, cancel_download, get_queue
│   │   ├── preview.rs           # get_stream_url command
│   │   └── settings.rs          # get/set save_path, filename_pattern
│   ├── queue/
│   │   ├── mod.rs               # Queue types, DownloadJob, JobStatus
│   │   ├── manager.rs           # Spawn tasks, semaphore, cancellation tokens
│   │   └── progress.rs          # stdout parser, yt-dlp progress line -> ProgressEvent
│   ├── ytdlp/
│   │   ├── mod.rs               # yt-dlp invocation helpers
│   │   ├── sidecar.rs           # Resolve binary path (sidecar vs system)
│   │   └── args.rs              # Build yt-dlp CLI argument lists
│   └── state.rs                 # AppState struct, Tauri managed state
├── binaries/                    # Sidecar binaries (yt-dlp, ffmpeg per platform)
│   ├── yt-dlp-x86_64-apple-darwin
│   ├── yt-dlp-x86_64-pc-windows-msvc.exe
│   ├── yt-dlp-x86_64-unknown-linux-gnu
│   ├── ffmpeg-x86_64-apple-darwin
│   └── ...
├── icons/
├── tauri.conf.json              # sidecar allowlist, window config
└── Cargo.toml

src/                             # Frontend (React + TypeScript)
├── main.tsx
├── App.tsx
├── store/
│   ├── searchStore.ts           # Zustand slice: search results, loading state
│   ├── queueStore.ts            # Zustand slice: download jobs, progress
│   └── playerStore.ts          # Zustand slice: current track, playback state
├── components/
│   ├── SearchBar/
│   ├── ResultList/
│   ├── DownloadQueue/
│   ├── AudioPlayer/
│   └── Settings/
├── hooks/
│   ├── useDownloadProgress.ts   # listen() to progress events, update queueStore
│   ├── useSearch.ts             # invoke search_youtube
│   └── usePlayer.ts             # HTMLAudioElement control
└── lib/
    └── tauri.ts                 # Typed wrappers around invoke/listen
```

### Structure Rationale

- **commands/**: Each command module maps 1:1 to a feature domain. Keeps `main.rs` clean.
- **queue/**: Isolates concurrency logic from HTTP/IPC concerns. Easier to test.
- **ytdlp/**: All yt-dlp CLI knowledge lives here — argument construction, binary resolution.
- **binaries/**: Tauri sidecar convention requires platform-suffixed binaries in this folder.
- **store/**: One Zustand slice per UI domain prevents cross-slice coupling and enables selective re-renders.

---

## Architectural Patterns

### Pattern 1: Tauri Sidecar for yt-dlp Binary

**What:** Bundle yt-dlp as a Tauri "sidecar" — a platform-specific binary that ships inside the app package and is accessible via `tauri::api::process::Command`.

**When to use:** When you want zero-dependency UX (user doesn't need to install yt-dlp separately). Required for macOS app store / signed distribution.

**Trade-offs:**
- Pro: Self-contained, always correct version, no PATH issues
- Pro: Works on first launch without setup wizard
- Con: Adds ~15-30 MB to app size per platform (yt-dlp + ffmpeg)
- Con: yt-dlp updates require a new app release (or a separate auto-updater)
- Con: Must maintain binaries for each platform triple

**Configuration (`tauri.conf.json`):**
```json
{
  "tauri": {
    "bundle": {
      "externalBin": [
        "binaries/yt-dlp",
        "binaries/ffmpeg"
      ]
    }
  }
}
```

**Rust invocation:**
```rust
use tauri::api::process::Command;

// Tauri resolves the platform-correct binary automatically
let output = Command::new_sidecar("yt-dlp")
    .expect("yt-dlp sidecar not found")
    .args(["--print", "%(title)s", url])
    .output()?;
```

**Naming convention:** Tauri requires sidecar binaries to be named with the target triple suffix: `yt-dlp-x86_64-apple-darwin`, `yt-dlp-x86_64-pc-windows-msvc.exe`, etc. The `new_sidecar("yt-dlp")` call resolves the correct one at runtime.

**Confidence:** MEDIUM — Tauri v2 changed sidecar API slightly from v1; verify against v2 docs before implementing. The `tauri::api::process` module was reorganized in v2.

---

### Pattern 2: Shell Command Fallback (System yt-dlp Discovery)

**What:** At startup, search PATH for `yt-dlp` and `ffmpeg`. If found, use them directly via `std::process::Command`. Fall back to sidecar if not found.

**When to use:** Development builds, power-user installs, when keeping app size minimal. Useful as a fallback alongside sidecar.

**Trade-offs:**
- Pro: User's yt-dlp version (may be newer than bundled)
- Pro: Much smaller app bundle if sidecar is omitted
- Con: Setup friction — requires user to pre-install yt-dlp
- Con: Version mismatches can cause argument parsing failures

**Rust implementation:**
```rust
fn resolve_ytdlp_binary() -> PathBuf {
    // 1. Try sidecar path (set at compile time by Tauri)
    if let Ok(path) = tauri::api::process::current_binary() {
        let sidecar = path.parent().unwrap().join("yt-dlp");
        if sidecar.exists() { return sidecar; }
    }
    // 2. Fall back to system PATH
    which::which("yt-dlp").unwrap_or_else(|_| PathBuf::from("yt-dlp"))
}
```

**Recommendation:** Ship sidecar as primary; use system binary as opt-in override in Settings. Do not make system binary the default — it creates support nightmares.

---

### Pattern 3: Async Download Queue with Bounded Concurrency

**What:** A Rust-side queue manager using `tokio::sync::Semaphore` to limit concurrent yt-dlp processes. Each job runs in its own `tokio::task`, spawning a `tokio::process::Command` child.

**When to use:** Any multi-download scenario. Always use this — even single downloads benefit from the cancellation and progress machinery.

**Trade-offs:**
- Pro: Prevents system overload from unconstrained parallel downloads
- Pro: Clean cancellation via `tokio_util::sync::CancellationToken`
- Pro: Future-proof: change concurrency limit without rewriting logic
- Con: Slightly more complex than a simple loop
- Con: Shared state requires careful `Arc<Mutex<>>` discipline

**Implementation:**
```rust
use tokio::sync::Semaphore;
use std::sync::Arc;

pub struct QueueManager {
    semaphore: Arc<Semaphore>,  // permits = max concurrent downloads
    jobs: Arc<Mutex<HashMap<JobId, DownloadJob>>>,
}

impl QueueManager {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            jobs: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn enqueue(&self, job: DownloadJob, app_handle: AppHandle) {
        let permit = self.semaphore.clone().acquire_owned().await.unwrap();
        let jobs = self.jobs.clone();
        tokio::spawn(async move {
            run_download(job, app_handle).await;
            drop(permit); // releases slot for next job
        });
    }
}
```

**Recommended concurrency limit:** 2-3 simultaneous downloads. yt-dlp is I/O-bound but ffmpeg encoding is CPU-bound. 3 parallel ffmpeg processes on a 4-core machine leaves room for the UI thread.

---

### Pattern 4: Progress Reporting via Tauri Events (Push Model)

**What:** Rust backend reads yt-dlp's stdout line by line in a spawned task, parses progress lines, and emits Tauri events to the frontend. Frontend subscribes with `listen()`.

**When to use:** Always — polling (`invoke` in a loop) is never the right approach for long-running operations.

**IPC Flow:**
```
yt-dlp stdout (text lines)
    |
    | async read line-by-line
    v
Rust: parse_progress_line(line) -> Option<ProgressEvent>
    |
    | app_handle.emit("download:progress", payload)
    v
Tauri IPC (serialized JSON, async)
    |
    | listen("download:progress", handler)
    v
Frontend: update queueStore[jobId].progress
    |
    v
React re-render: progress bar, percentage, ETA
```

**Rust side:**
```rust
#[derive(Clone, serde::Serialize)]
struct ProgressPayload {
    job_id: String,
    percent: f32,
    speed: String,    // e.g. "1.23 MiB/s"
    eta: String,      // e.g. "00:42"
    status: String,   // "downloading" | "converting" | "done" | "error"
}

// In the download task:
while let Some(line) = reader.next_line().await? {
    if let Some(payload) = parse_ytdlp_progress(&line, &job_id) {
        app_handle.emit("download:progress", payload).ok();
    }
}
```

**yt-dlp progress line format:**
```
[download]  45.3% of 5.23MiB at 1.23MiB/s ETA 00:02
```
Parse with regex or split on whitespace. Use `--newline` flag with yt-dlp to force line-by-line output.

**Frontend side:**
```typescript
// useDownloadProgress.ts
useEffect(() => {
  const unlisten = listen<ProgressPayload>('download:progress', (event) => {
    useQueueStore.getState().updateProgress(event.payload);
  });
  return () => { unlisten.then(f => f()); };
}, []);
```

**Event naming convention:** Use `domain:action` format — `download:progress`, `download:complete`, `download:error`. Avoids collisions in the global event bus.

**Confidence:** HIGH — This is the canonical Tauri v1/v2 pattern for progress reporting.

---

### Pattern 5: Audio Streaming Preview (No Local Download)

**What:** Get the direct audio stream URL from yt-dlp (`--get-url` with audio format selection), then pass it to the frontend. The frontend plays it via `<audio>` element or Web Audio API. No audio file is saved to disk.

**Why this approach over downloading to temp file:** Faster time-to-preview (starts playing in ~1s), no temp file cleanup needed, works for the "30-60 second preview" use case.

**IPC Flow:**
```
User clicks "Preview" on search result
    |
    | invoke("get_stream_url", { url, videoId })
    v
Rust: spawn yt-dlp --get-url -f "bestaudio[ext=m4a]/bestaudio" [url]
    |
    | capture stdout (single line = direct CDN URL)
    v
Return URL string to frontend
    |
    | set audioElement.src = url
    v
Browser fetches audio directly from YouTube CDN
    | (no Rust/Tauri involved in the actual streaming bytes)
    v
Web Audio API plays audio
```

**Rust command:**
```rust
#[tauri::command]
async fn get_stream_url(url: String) -> Result<String, String> {
    let output = tokio::process::Command::new(resolve_ytdlp_binary())
        .args([
            "--get-url",
            "-f", "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
            "--no-playlist",
            &url,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stream_url = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(stream_url)
}
```

**Important caveats:**
- YouTube stream URLs expire (typically after 6 hours). Regenerate on play, not on search.
- CORS: YouTube CDN does NOT set CORS headers allowing browser fetch from non-YouTube origins. Use the `<audio>` element (not `fetch()`) — audio/video elements bypass CORS for media.
- Some formats (Opus in WebM) may not play in WebView on Windows without additional codecs. Prefer `m4a` (AAC) for maximum compatibility across Tauri's WebView implementations (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux).
- Preview limitation: YouTube stream URLs are authenticated (signed). They may stop working after 30-60 minutes if YouTube's CDN rotates the signature. This is acceptable for preview use.

**Confidence:** MEDIUM — Stream URL approach is well-known and documented in yt-dlp community. The CORS behavior and codec compatibility with specific Tauri WebView versions needs validation at implementation time.

---

### Pattern 6: Managed State in Tauri (Arc<Mutex<AppState>>)

**What:** Register a single `AppState` struct with Tauri's state management system. All command handlers receive it via parameter injection.

**Why:** Tauri's managed state is the correct way to share mutable state across command invocations. Avoids global statics, which are problematic with async Rust.

**Implementation:**
```rust
// state.rs
pub struct AppState {
    pub queue_manager: QueueManager,
    pub binary_paths: BinaryPaths,
    pub settings: Mutex<AppSettings>,
}

pub struct BinaryPaths {
    pub ytdlp: PathBuf,
    pub ffmpeg: PathBuf,
}

// main.rs
fn main() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            search_youtube,
            start_download,
            cancel_download,
            get_stream_url,
            get_queue_status,
            set_save_path,
        ])
        .run(tauri::generate_context!())
        .expect("error running app");
}

// In command handlers:
#[tauri::command]
async fn start_download(
    url: String,
    state: tauri::State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<String, String> {
    // state.queue_manager.enqueue(...)
}
```

**Confidence:** HIGH — Standard Tauri pattern, unchanged between v1 and v2.

---

## Data Flow

### Download Flow (End-to-End)

```
User Action: Click "Download" on a track
    |
    | Frontend: invoke("start_download", { url, outputDir, filenamePattern })
    v
Rust Command Handler: start_download()
    | - generates JobId (UUID)
    | - creates DownloadJob { id, url, status: Queued, ... }
    | - inserts into AppState queue
    | - spawns async task (acquires semaphore permit)
    |
    | emit("download:queued", { job_id, title })
    v
Frontend: queueStore.addJob(payload)  →  Queue panel shows new item

    [When semaphore permit acquired:]
    |
    | Rust task: spawn tokio::process::Command(yt-dlp)
    |   args: -x --audio-format mp3 --audio-quality 0
    |          -o "%(title)s.%(ext)s" --newline [url]
    |
    | emit("download:started", { job_id })
    v
Frontend: queueStore.setStatus(job_id, "downloading")

    [For each stdout line from yt-dlp:]
    |
    | Rust: parse_ytdlp_progress(line) -> ProgressPayload
    | emit("download:progress", payload)
    v
Frontend: queueStore.updateProgress(job_id, percent, speed, eta)
    → Progress bar updates

    [On yt-dlp exit code 0:]
    |
    | emit("download:complete", { job_id, file_path })
    v
Frontend: queueStore.setStatus(job_id, "complete")
    → Show checkmark, enable "Show in Finder" button

    [On yt-dlp non-zero exit or spawn error:]
    |
    | emit("download:error", { job_id, message })
    v
Frontend: queueStore.setStatus(job_id, "error")
    → Show error state, retry button
```

### Search Flow

```
User types in SearchBar → debounce 300ms
    |
    | invoke("search_youtube", { query })
    v
Rust: spawn yt-dlp --flat-playlist --dump-json
      "ytsearch10:[query]"
    |
    | capture stdout, parse JSON lines
    v
Return Vec<SearchResult> to frontend (single response, not streaming)
    |
Frontend: searchStore.setResults(results)
    → ResultList renders tracks
```

**Note:** Search results return as a single `invoke` response (not events). This is appropriate because search completes in one shot (~1-3s). No progress events needed.

### Preview Flow

```
User clicks Preview button
    |
    | invoke("get_stream_url", { url })
    v
Rust: spawn yt-dlp --get-url -f bestaudio (fast, ~0.5-2s)
    |
    | return stream URL string
    v
Frontend: audioElement.src = url
Frontend: audioElement.play()
    |
    | Browser fetches audio directly from YouTube CDN
    v
Audio plays in app (no temp files, no Rust involvement in bytes)
```

### State Management (Frontend)

```
Zustand Store Architecture:

searchStore
  { query, results, loading, error }
  Actions: setQuery, setResults, setLoading, setError

queueStore
  { jobs: Map<JobId, DownloadJob> }
  DownloadJob: { id, title, url, status, percent, speed, eta, filePath }
  Actions: addJob, updateProgress, setStatus, removeJob, cancelJob

playerStore
  { currentTrack, streamUrl, isPlaying, volume }
  Actions: setTrack, setStreamUrl, play, pause, setVolume

settingsStore (persisted to localStorage / Tauri store plugin)
  { saveDirectory, filenamePattern, maxConcurrent, theme }
  Actions: setSaveDirectory, setFilenamePattern, setMaxConcurrent
```

---

## yt-dlp / ffmpeg Discovery and Bundling

### Decision: Sidecar as Default

Recommendation: Bundle yt-dlp and ffmpeg as Tauri sidecars for all platforms. This gives users a working app immediately without setup steps.

**Binary sources:**
- yt-dlp: `https://github.com/yt-dlp/yt-dlp/releases` — standalone binaries for macOS, Windows, Linux
- ffmpeg: `https://github.com/eugeneware/ffmpeg-static` (npm package with pre-built binaries) or `https://ffbinaries.com`

**Tauri binary naming requirement:**
Tauri's sidecar system requires binaries named with the Rust target triple:
```
binaries/
├── yt-dlp-x86_64-apple-darwin
├── yt-dlp-aarch64-apple-darwin          # Apple Silicon
├── yt-dlp-x86_64-pc-windows-msvc.exe
├── yt-dlp-x86_64-unknown-linux-gnu
├── ffmpeg-x86_64-apple-darwin
├── ffmpeg-aarch64-apple-darwin
├── ffmpeg-x86_64-pc-windows-msvc.exe
└── ffmpeg-x86_64-unknown-linux-gnu
```

**Startup binary resolution flow:**
```
App launch
    |
    v
resolve_binaries() in main.rs
    |
    ├── Try: tauri sidecar path (bundled binary exists?)
    |     YES → use it, store in AppState.binary_paths
    |     NO  ↓
    └── Try: system PATH (which yt-dlp, which ffmpeg)
          YES → use it, store in AppState.binary_paths
          NO  → emit "setup:missing_binaries" event
                Frontend shows setup guide / download links
```

**Binary freshness:** yt-dlp breaks frequently when YouTube changes its extraction logic. Consider showing the bundled yt-dlp version in Settings and providing a one-click update button that downloads the latest yt-dlp binary to the app data directory (overriding the bundled one).

**Confidence:** MEDIUM — The Tauri sidecar naming convention is well-documented and stable. The auto-update-binary pattern is a community workaround, not an official Tauri feature.

---

## Tauri Command Reference

All commands must be registered in the `invoke_handler` in `main.rs`.

| Command | Args | Returns | Notes |
|---------|------|---------|-------|
| `search_youtube` | `query: String` | `Vec<SearchResult>` | Blocking response, ~1-3s |
| `start_download` | `url, output_dir, filename_pattern` | `String` (job_id) | Async, returns immediately; progress via events |
| `cancel_download` | `job_id: String` | `bool` | Sends SIGTERM to yt-dlp child process |
| `get_stream_url` | `url: String` | `String` | Returns direct audio CDN URL, ~0.5-2s |
| `get_queue_status` | (none) | `Vec<DownloadJob>` | Snapshot of current queue (for page reload recovery) |
| `set_save_directory` | `path: String` | `()` | Persists to settings store |
| `open_file_location` | `path: String` | `()` | Uses Tauri shell plugin to reveal in Finder/Explorer |
| `get_app_version` | (none) | `String` | yt-dlp bundled version, app version |

### Capability Configuration (tauri.conf.json)

Tauri v2 uses a capability-based permission system (changed from v1 allowlist):

```json
{
  "identifier": "default",
  "description": "Default permissions",
  "permissions": [
    "core:default",
    "shell:allow-execute",           // spawn yt-dlp/ffmpeg
    "shell:allow-open",              // open folder in Finder
    "dialog:allow-open",             // folder picker dialog
    "fs:allow-read-all",             // read app data dir
    "fs:allow-write-all",            // write downloads
    "process:allow-exit"
  ]
}
```

**Confidence:** MEDIUM — Tauri v2 capability system is confirmed in v2 docs (released Oct 2024). Exact permission identifiers should be verified against v2 docs during implementation.

---

## Anti-Patterns

### Anti-Pattern 1: Blocking the Main Thread with yt-dlp

**What people do:** Call yt-dlp synchronously inside a `#[tauri::command]` without `async` or inside a Tokio `block_in_place`.

**Why it's wrong:** Blocks the Tauri runtime thread, freezes the UI, prevents other commands from being processed.

**Do this instead:** Mark commands `async`, use `tokio::process::Command` (not `std::process::Command`), and `await` the output. For long-running processes (downloads), spawn a `tokio::task` and return the job ID immediately.

---

### Anti-Pattern 2: Polling `get_queue_status` for Progress

**What people do:** Call `invoke("get_queue_status")` every 500ms from the frontend to get download progress.

**Why it's wrong:** Creates unnecessary IPC round-trips. At 500ms polling with 3 concurrent downloads, that's 6 Tauri serializations/deserializations per second for data that only changes when yt-dlp emits a new line.

**Do this instead:** Use `app_handle.emit()` for progress events. The frontend reacts only when data actually changes. Polling is only appropriate for initial state sync on page load (use `get_queue_status` once on mount).

---

### Anti-Pattern 3: One yt-dlp Process Per Concurrent Download Without a Semaphore

**What people do:** Fire a new tokio task for every download click without limiting parallelism.

**Why it's wrong:** 10 concurrent yt-dlp processes + 10 concurrent ffmpeg processes will saturate CPU and disk I/O, cause all downloads to slow down, and potentially OOM on low-memory machines.

**Do this instead:** `tokio::sync::Semaphore` with 2-3 permits. Queue jobs; they acquire permits when slots are free.

---

### Anti-Pattern 4: Embedding Stream URL as a Persistent Preview URL

**What people do:** Store the stream URL from `get_stream_url` in persistent state (localStorage, database) and reuse it later.

**Why it's wrong:** YouTube stream URLs are signed and expire (typically within a few hours). A stored URL will return 403 when replayed.

**Do this instead:** Fetch a fresh stream URL on each play action. The `get_stream_url` command takes ~0.5-2s — fast enough to call on demand.

---

### Anti-Pattern 5: Using `fetch()` to Play Audio Stream Instead of `<audio>` Element

**What people do:** Use the Fetch API or axios to retrieve audio bytes, then feed them to Web Audio API.

**Why it's wrong:** YouTube CDN does not include CORS headers (`Access-Control-Allow-Origin`). `fetch()` from a non-YouTube origin will be blocked by the browser's CORS policy, even in Tauri's WebView.

**Do this instead:** Set `audioElement.src = streamUrl` and call `audioElement.play()`. Media elements bypass CORS restrictions by design (they use `no-cors` mode internally).

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| YouTube (search) | yt-dlp `ytsearch:` prefix, `--dump-json` | No API key needed; rate-limited by IP |
| YouTube (stream) | yt-dlp `--get-url`, browser `<audio>` | URL expires; regenerate per play |
| YouTube CDN | Direct from browser (no Rust) | CORS bypass via `<audio>` element |
| Filesystem | Tauri `fs` plugin + native dialog | User-chosen output directory |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend ↔ Rust commands | `invoke()` / Promise | Single request-response |
| Rust → Frontend (async updates) | `emit()` / `listen()` | Progress, status, errors |
| Download task → Queue manager | Tokio channel (`mpsc`) or shared `Arc<Mutex<>>` | Job status updates |
| Queue manager → AppState | Direct field access (same struct) | No cross-thread boundary |
| Rust ↔ yt-dlp process | `stdin` (rarely), `stdout`, `stderr`, exit code | Parse stdout for progress |
| Rust ↔ ffmpeg | Invoked by yt-dlp automatically via `--audio-format mp3` | Do not invoke ffmpeg directly |

**Key insight on ffmpeg:** Do not call ffmpeg directly from Rust. Pass `--audio-format mp3 --audio-quality 0` to yt-dlp and let yt-dlp invoke ffmpeg internally. yt-dlp handles codec selection, temp file management, and cleanup. Only the ffmpeg binary path needs to be on PATH or passed via `--ffmpeg-location`.

**Passing ffmpeg location to yt-dlp:**
```rust
.args([
    "--ffmpeg-location", &state.binary_paths.ffmpeg.to_string_lossy(),
    "--audio-format", "mp3",
    "--audio-quality", "0",
    // ... other args
])
```

---

## Scaling Considerations

This is a local desktop app — traditional "scaling" (more users) doesn't apply. The relevant scaling dimension is **concurrent workload per single user session**.

| Scenario | Architecture Consideration |
|----------|---------------------------|
| 1-3 downloads | Default semaphore limit handles fine |
| Large playlist (50+ tracks) | Queue must be persistent — use Tauri store plugin so queue survives app restart |
| Slow network | yt-dlp handles retries internally; expose `--retries` in Settings |
| Very fast SSD | ffmpeg CPU bottleneck before disk bottleneck; keep max_concurrent <= num_cores / 2 |

### Scaling Priorities

1. **First bottleneck:** yt-dlp argument errors silently failing — add stderr capture and surface errors clearly in UI.
2. **Second bottleneck:** Large playlists with no queue persistence — implement `settingsStore` with Tauri store plugin early.

---

## Sources

- Tauri v2 official documentation (v2.tauri.app) — sidecar, commands, events, capabilities [MEDIUM confidence — not directly fetched this session]
- yt-dlp GitHub repository (github.com/yt-dlp/yt-dlp) — CLI flags, output format, progress line format [HIGH confidence — well-known stable API]
- Tauri community patterns for progress reporting — training data to Aug 2025 [MEDIUM confidence]
- YouTube stream URL expiry and CORS behavior — community knowledge, multiple sources [MEDIUM confidence]
- Tokio async patterns for bounded concurrency — official Tokio docs [HIGH confidence]

---
*Architecture research for: Tauri v2 + yt-dlp YouTube music downloader desktop app*
*Researched: 2026-03-21*
