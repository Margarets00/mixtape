---
phase: 01-download-engine
plan: "03"
subsystem: ui
tags: [react, tauri, yt-dlp, css, y2k, progress, channel, rust, regex, id3, tokio]

# Dependency graph
requires:
  - phase: 01-download-engine-01
    provides: Tauri v2 project scaffold with React+Vite, sidecar infra, plugin registration
  - phase: 01-download-engine-02
    provides: download Rust command with DownloadEvent/Channel, updater commands, error parsing

provides:
  - Y2K-themed React UI with pastel pink/blue/green palette and pixel fonts
  - DownloadForm component invoking Rust download command via Channel<DownloadEvent>
  - FolderPicker with plugin-dialog + plugin-store lastSaveDir persistence
  - ProgressBar with real-time percent/speed/ETA display
  - ErrorBanner for dismissible error messages
  - UpdateButton for check_ytdlp_version and update_ytdlp
  - Title cleanup pipeline (title.rs) stripping 14 YouTube noise patterns
  - Deterministic MP3 output path via cleaned+sanitized title
  - ID3 tags via --embed-metadata (yt-dlp native)
  - locate_sidecar() helper resolving binaries relative to current_exe() (dev + prod)
  - Playlist detection skipping blocking title-fetch for playlist URLs

affects: [phase-02-search-preview, any future UI phases]

# Tech tracking
tech-stack:
  added:
    - "@tauri-apps/plugin-dialog (already installed, now used in FolderPicker)"
    - "@tauri-apps/plugin-store (already installed, now used in FolderPicker)"
    - "Google Fonts: Press Start 2P + VT323 (via index.html link)"
    - "regex crate (already in Cargo.toml, now used in title.rs)"
    - "tokio (process + io-util features) for spawning yt-dlp/ffmpeg directly"
    - "libc crate for SIGTERM on Unix during app exit cleanup"
  patterns:
    - "CSS custom properties for design tokens in theme.css"
    - "Channel<DownloadEvent> onmessage dispatch pattern for real-time progress"
    - "Two-step yt-dlp: --print title first (single video only), then download with clean filename"
    - "Deterministic output path construction (not parsed from yt-dlp output)"
    - "plugin-store with defaults:{} for persistent settings"
    - "locate_sidecar(): resolve sidecar binaries via current_exe().parent() for dev+prod compat"
    - "Playlist URL detection: skip title-fetch, use %(playlist_index)02d - %(title)s template"

key-files:
  created:
    - src/styles/theme.css
    - src/styles/global.css
    - src/components/DownloadForm.tsx
    - src/components/ProgressBar.tsx
    - src/components/FolderPicker.tsx
    - src/components/ErrorBanner.tsx
    - src/components/UpdateButton.tsx
    - src-tauri/src/title.rs
  modified:
    - src/App.tsx
    - index.html
    - src-tauri/src/download.rs
    - src-tauri/src/updater.rs
    - src-tauri/src/state.rs
    - src-tauri/src/lib.rs
    - src-tauri/Cargo.toml
    - scripts/download-sidecars.sh

key-decisions:
  - "StoreOptions requires `defaults` field (not autoSave standalone) in plugin-store 2.4.2"
  - "load() with defaults:{} used instead of autoSave:true for plugin-store compatibility"
  - "Two-step yt-dlp title fetch: --print title before download for deterministic filename (single video only)"
  - "Done path constructed as format!(\"{}/{}.mp3\", save_dir, safe_title) - not parsed from yt-dlp output"
  - "locate_sidecar() uses current_exe().parent() — Tauri's dev-mode path resolution looks for binaries/yt-dlp-{triple} in target/debug/ which doesn't exist; this approach works in both modes"
  - "ffmpeg bundled via download-sidecars.sh now prefers system ffmpeg on macOS to avoid x86_64/arm64 mismatch"
  - "Playlist URLs detected by list= or /playlist in URL; skip blocking title fetch and use playlist-aware output template"
  - "AppState stores active_pid (u32) instead of CommandChild to avoid tauri_plugin_shell type dependency in cleanup path"

patterns-established:
  - "Pattern: Channel<T> onmessage switch dispatch for multi-event Rust->TS IPC"
  - "Pattern: CSS :root custom properties for design tokens (--color-*, --font-*, --border-*, --shadow-*)"
  - "Pattern: FolderPicker loads store on mount to restore last path"
  - "Pattern: locate_sidecar() for all sidecar resolution (used in download.rs and updater.rs)"

requirements-completed: [ENG-05, ENG-06, UI-01, UI-02]

# Metrics
duration: ~30min (including verification and bug fixes)
completed: 2026-03-21
---

# Phase 01 Plan 03: Y2K UI + Title Cleanup Summary

**Y2K-styled React UI (pastel palette + Press Start 2P/VT323 fonts) wired to Rust download engine with real-time Channel progress, folder persistence via plugin-store, title cleanup pipeline stripping 14 YouTube noise patterns, and end-to-end verification confirming single and playlist downloads work on Apple Silicon**

## Performance

- **Duration:** ~30 min (including human verification and post-plan bug fixes)
- **Started:** 2026-03-21T13:32:48Z
- **Completed:** 2026-03-21T13:37:50Z (checkpoint) + verification session
- **Tasks:** 3 of 3 (Task 3 human-verify: approved)
- **Files modified:** 16

## Accomplishments

- Complete Y2K retro UI with CSS custom properties, pixel fonts, and pastel palette
- End-to-end download flow: URL input -> FolderPicker -> Download button -> real-time ProgressBar -> ErrorBanner
- Title cleanup pipeline in Rust: clean_title() strips 14 noise patterns (Official Video/MV, Lyrics, Audio, HD, 4K, MV, Visualizer), sanitize_filename() removes filesystem-unsafe chars
- Deterministic MP3 output path built from cleaned title (not parsed from yt-dlp output)
- FolderPicker persists last-used folder across app restarts via plugin-store
- Human verification passed: app launched, real YouTube URL downloaded to clean-titled MP3 with ID3 tags

## Task Commits

Each task was committed atomically:

1. **Task 1: Y2K UI shell wired to Rust download engine** - `9bdd189` (feat)
2. **Task 2: Title cleanup pipeline and deterministic output path** - `0615075` (feat)
3. **Task 3: Verify end-to-end download flow** - approved by human (checkpoint, no code commit)

**Post-plan bug fix commits:**
- `c3cb852` - fix: replace Tauri shell sidecar with tokio::process + locate_sidecar (includes playlist hang fix)
- `9e41c14` - fix: prefer system ffmpeg on macOS to avoid architecture mismatch

**Plan metadata:** `ef5c480` (docs: complete Y2K UI + title cleanup plan — pre-verification) + updated below

## Files Created/Modified

- `src/styles/theme.css` - Y2K CSS custom properties (--color-pink, --color-blue, --color-green, --font-display, --font-body, --shadow-retro)
- `src/styles/global.css` - Base styles for body, buttons, inputs with retro aesthetic
- `src/components/DownloadForm.tsx` - URL input + FolderPicker + Download button + Channel<DownloadEvent> dispatch
- `src/components/ProgressBar.tsx` - Gradient progress bar with speed/ETA/status text
- `src/components/FolderPicker.tsx` - Native folder dialog + plugin-store persistence under key 'lastSaveDir'
- `src/components/ErrorBanner.tsx` - Dismissible error banner with yellow background
- `src/components/UpdateButton.tsx` - yt-dlp version check and update trigger
- `src/App.tsx` - Layout with header, main, footer; imports theme.css + global.css
- `index.html` - Added Press Start 2P + VT323 Google Fonts link
- `src-tauri/src/title.rs` - clean_title() with 14 NOISE_PATTERNS, sanitize_filename()
- `src-tauri/src/download.rs` - Two-step download (single video) + playlist detection + locate_sidecar + tokio streaming
- `src-tauri/src/updater.rs` - Migrated to tokio::process + locate_sidecar
- `src-tauri/src/state.rs` - Changed active_child (CommandChild) to active_pid (u32)
- `src-tauri/src/lib.rs` - Exit cleanup now sends SIGTERM to PID via libc; added mod title
- `src-tauri/Cargo.toml` - Added tokio (process + io-util) and libc dependencies
- `scripts/download-sidecars.sh` - Prefer system ffmpeg on macOS; warn + fallback to evermeet.cx

## Decisions Made

- Used `load('app-settings.json', { defaults: {} })` for plugin-store — the `StoreOptions` type in v2.4.2 requires the `defaults` field; `autoSave: true` standalone is not valid.
- Two-step yt-dlp approach (single video only): first `--print title` to get raw title, then clean and sanitize, then download. Avoids post-processing path parsing.
- Done event path is built deterministically as `format!("{}/{}.mp3", save_dir, safe_title)` since we control the `-o` template.
- locate_sidecar() resolves via current_exe().parent() — Tauri's dev-mode resolution looked for `binaries/yt-dlp-{triple}` in `target/debug/` which does not exist in that location.
- AppState now stores `active_pid: Mutex<Option<u32>>` instead of `CommandChild` to decouple cleanup from the shell plugin type system.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed StoreOptions API mismatch**
- **Found during:** Task 1 (FolderPicker build)
- **Issue:** `load('app-settings.json', { autoSave: true })` fails TypeScript compile — StoreOptions in plugin-store 2.4.2 requires `defaults` field
- **Fix:** Changed to `load('app-settings.json', { defaults: {} })`
- **Files modified:** src/components/FolderPicker.tsx
- **Verification:** `npm run build` passes (Vite + TypeScript)
- **Committed in:** 9bdd189 (Task 1 commit)

**2. [Rule 1 - Bug] Replaced Tauri shell sidecar with tokio::process + locate_sidecar()**
- **Found during:** Task 3 verification (app launch / first download attempt)
- **Issue:** Tauri's `app.shell().sidecar("binaries/yt-dlp")` in dev mode looks for `binaries/yt-dlp-{triple}` inside `target/debug/` — that path does not exist. The binary lives at `target/debug/yt-dlp` without the triple suffix. Every invoke immediately returned "sidecar not found".
- **Fix:** Replaced shell plugin sidecar() calls with `locate_sidecar(name)` which walks `current_exe().parent()` trying the plain name first, then `name-{triple}`. Switched subprocess management to `tokio::process::Command` with piped stdout/stderr. Added `tokio` and `libc` to Cargo.toml.
- **Files modified:** src-tauri/src/download.rs, src-tauri/src/updater.rs, src-tauri/src/state.rs, src-tauri/src/lib.rs, src-tauri/Cargo.toml
- **Committed in:** c3cb852

**3. [Rule 1 - Bug] Fixed ffmpeg architecture mismatch on Apple Silicon**
- **Found during:** Task 3 verification (MP3 conversion step failed silently)
- **Issue:** `download-sidecars.sh` downloaded ffmpeg from evermeet.cx, which provides only x86_64 builds. On an Apple Silicon Mac the bundled binary was the wrong architecture and ffmpeg failed at runtime with "bad CPU type in executable".
- **Fix:** `download-sidecars.sh` now checks `command -v ffmpeg` on macOS first; if the system has ffmpeg (e.g., via Homebrew), it copies that binary instead. Falls back to evermeet.cx with a warning directing Apple Silicon users to `brew install ffmpeg`.
- **Files modified:** scripts/download-sidecars.sh
- **Committed in:** 9e41c14

**4. [Rule 1 - Bug] Fixed playlist URL hang (blocking --print title call)**
- **Found during:** Task 3 verification (pasting a playlist URL caused the UI to freeze)
- **Issue:** Pasting a playlist URL caused `yt-dlp --print title <url>` to block indefinitely (or return multiple lines) before the download started.
- **Fix:** Added playlist detection (`url.contains("list=") || url.contains("/playlist")`). For playlist URLs, skip the title-fetch step and use `%(playlist_index)02d - %(title)s.%(ext)s` as the output template. Done event reports the folder path instead of a single file path.
- **Files modified:** src-tauri/src/download.rs (part of c3cb852 commit)
- **Committed in:** c3cb852

---

**Total deviations:** 4 auto-fixed (1 blocking API mismatch, 3 bugs found during verification)
**Impact on plan:** All fixes were required for the app to function at all on Apple Silicon in dev mode. No scope creep.

## Issues Encountered

- plugin-store v2.4.2 StoreOptions type requires `defaults` field — resolved immediately.
- Tauri shell sidecar path resolution is incompatible with dev-mode binary layout — full migration to tokio::process required.
- ffmpeg from evermeet.cx is x86_64-only — system ffmpeg preferred on macOS going forward.
- Playlist URLs block the title-fetch step — playlist detection added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 complete: end-to-end URL -> MP3 download flow verified by human on Apple Silicon
- locate_sidecar() pattern is established and reusable in Phase 2 for any new sidecar invocations
- Phase 2 (search/preview) can build on FolderPicker, ProgressBar, and ErrorBanner components
- Title cleanup and deterministic path patterns are reusable for batch download in Phase 2
- Note: playlist download reports folder path in Done event, not individual file path — Phase 2 batch flow should follow the same pattern

## Self-Check: PASSED

- All created files exist on disk
- Task commits verified: 9bdd189, 0615075
- Bug fix commits verified: c3cb852, 9e41c14
- SUMMARY.md created at .planning/phases/01-download-engine/01-03-SUMMARY.md
- Human verification: approved

---
*Phase: 01-download-engine*
*Completed: 2026-03-21*
