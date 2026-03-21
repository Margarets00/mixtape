---
phase: 01-download-engine
plan: 02
subsystem: api
tags: [rust, tauri, yt-dlp, ffmpeg, sidecar, ipc, channel, reqwest]

# Dependency graph
requires:
  - phase: 01-download-engine-01
    provides: Tauri v2 scaffold with sidecar infrastructure, shell/dialog/store plugins, capabilities config

provides:
  - download Tauri command spawning yt-dlp sidecar with Channel<DownloadEvent> progress streaming
  - DownloadEvent enum (Progress, Postprocessing, Done, Error) for frontend IPC
  - Error parser for 7 yt-dlp stderr patterns mapped to human-readable messages
  - AppState with Mutex<Option<CommandChild>> for child process lifecycle tracking
  - RunEvent::Exit hook kills active child process on app quit
  - check_ytdlp_version Tauri command querying GitHub releases API
  - update_ytdlp Tauri command downloading platform binary with atomic temp-file replace

affects:
  - 01-download-engine-03 (frontend will invoke download command via Channel)
  - phase-02 (search and preview depends on download engine being wired)

# Tech tracking
tech-stack:
  added: [reqwest 0.12 (HTTP client for GitHub API), tauri::Manager trait usage]
  patterns:
    - Channel<DownloadEvent> for high-frequency IPC progress streaming
    - Mutex<Option<CommandChild>> pattern for child process state management
    - Temp-file + fs::rename pattern for atomic binary replacement
    - cfg!(target_os) for platform-specific binary download URLs

key-files:
  created:
    - src-tauri/src/state.rs
    - src-tauri/src/errors.rs
    - src-tauri/src/download.rs
    - src-tauri/src/updater.rs
  modified:
    - src-tauri/src/lib.rs

key-decisions:
  - "Folder persistence (ENG-04) is frontend-only via plugin-dialog + plugin-store; no Rust command needed for save_dir"
  - "yt-dlp update uses temp-file (.new) + fs::rename for atomic replace; never overwrites running binary directly"
  - "Read both CommandEvent::Stdout and CommandEvent::Stderr since yt-dlp moved progress to stderr (~2022)"
  - "use tauri::Manager trait must be explicitly imported for app.path() and app.state() to work"

patterns-established:
  - "Pattern: always import `use tauri::Manager;` when using app.path() or app.state() in Tauri commands"
  - "Pattern: yt-dlp sidecar name is 'binaries/yt-dlp' (matching tauri.conf.json externalBin path)"
  - "Pattern: RunEvent::Exit for guaranteed process cleanup (more reliable than CloseRequested)"

requirements-completed: [ENG-01, ENG-03, ENG-04, ENG-07, ENG-08, ENG-09]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 01 Plan 02: Download Engine — Rust Backend Summary

**Tauri command download engine with yt-dlp sidecar spawn, Channel<DownloadEvent> progress streaming, 7-pattern error parser, AppState child process tracking, and yt-dlp GitHub release updater**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T13:27:57Z
- **Completed:** 2026-03-21T13:30:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Complete Rust download backend: yt-dlp sidecar spawned with -x, --audio-format mp3, --embed-metadata, --ffmpeg-location, --progress-template PROGRESS prefix, and --newline flags
- Real-time progress streaming via Channel<DownloadEvent> with Progress/Postprocessing/Done/Error variants
- 7-pattern error parser covering rate limit (429), geo-block (403), unavailable, private, ffmpeg missing, network error, invalid URL
- AppState tracks active child process; RunEvent::Exit kills it on app quit
- yt-dlp version check and updater: GitHub releases API query, platform-specific binary download, atomic temp-file rename, Unix chmod +x

## Task Commits

Each task was committed atomically:

1. **Task 1: AppState, error parser, and download command** - `8292d44` (feat)
2. **Task 2: yt-dlp version check and update command** - `d0b5c29` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src-tauri/src/state.rs` - AppState struct with Mutex<Option<CommandChild>> for process lifecycle
- `src-tauri/src/errors.rs` - parse_ytdlp_error function with 7 yt-dlp stderr error patterns
- `src-tauri/src/download.rs` - DownloadEvent enum + download Tauri command + parse_yt_dlp_line
- `src-tauri/src/updater.rs` - VersionInfo struct + check_ytdlp_version + update_ytdlp commands
- `src-tauri/src/lib.rs` - Registers all modules, AppState, invoke_handler, RunEvent::Exit cleanup

## Decisions Made

- Folder persistence is frontend-only (plugin-dialog + plugin-store); the Rust download command simply receives save_dir as a string argument. No Rust-side folder command needed.
- yt-dlp binary update uses write-to-.new-then-rename pattern for atomicity; never writes over the running binary.
- Both stdout and stderr streams are read from yt-dlp because yt-dlp moved progress output to stderr in ~2022.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing `use tauri::Manager` import**
- **Found during:** Task 1 (download command implementation)
- **Issue:** Rust compiler error E0599 — `state()` and `path()` methods on AppHandle require the Manager trait to be in scope
- **Fix:** Added `use tauri::Manager;` to both download.rs and lib.rs
- **Files modified:** src-tauri/src/download.rs, src-tauri/src/lib.rs
- **Verification:** cargo check passes
- **Committed in:** 8292d44

**2. [Rule 3 - Blocking] Fixed lifetime error in RunEvent::Exit handler**
- **Found during:** Task 1 (lib.rs update)
- **Issue:** Rust compiler E0597 — State borrow did not live long enough due to temporary drop ordering
- **Fix:** Restructured block to use separate variable `child_opt` with explicit semicolon to drop temporary before end of block
- **Files modified:** src-tauri/src/lib.rs
- **Verification:** cargo check passes
- **Committed in:** 8292d44

**3. [Rule 3 - Blocking] Replaced `tokio::fs::write` with `std::fs::write`**
- **Found during:** Task 2 (updater.rs)
- **Issue:** tokio is not a direct Cargo.toml dependency (it's bundled by Tauri); direct tokio:: invocation fails
- **Fix:** Used std::fs::write instead (synchronous write in an async fn is acceptable for one-time binary write)
- **Files modified:** src-tauri/src/updater.rs
- **Verification:** cargo check passes
- **Committed in:** d0b5c29

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug, 2 Rule 3 blocking)
**Impact on plan:** All auto-fixes required for compilation. No scope creep. Plan logic unchanged.

## Issues Encountered

- Rust requires explicit trait import (`use tauri::Manager`) even when the trait impl exists — compiler error is clear but worth noting for future Tauri command files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Tauri commands compiled and registered: `download`, `check_ytdlp_version`, `update_ytdlp`
- Plan 01-03 (frontend) can now invoke these commands via `invoke()` from React
- The `Done { path }` variant in DownloadEvent is ready for frontend to display success and the output file path
- Known: cargo warning for `Done` variant being unused — will be resolved when frontend uses it in 01-03

---
*Phase: 01-download-engine*
*Completed: 2026-03-21*
