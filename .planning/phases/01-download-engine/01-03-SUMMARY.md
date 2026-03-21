---
phase: 01-download-engine
plan: "03"
subsystem: ui
tags: [react, tauri, yt-dlp, css, y2k, progress, channel, rust, regex, id3]

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

affects: [phase-02-search-preview, any future UI phases]

# Tech tracking
tech-stack:
  added:
    - "@tauri-apps/plugin-dialog (already installed, now used in FolderPicker)"
    - "@tauri-apps/plugin-store (already installed, now used in FolderPicker)"
    - "Google Fonts: Press Start 2P + VT323 (via index.html link)"
    - "regex crate (already in Cargo.toml, now used in title.rs)"
  patterns:
    - "CSS custom properties for design tokens in theme.css"
    - "Channel<DownloadEvent> onmessage dispatch pattern for real-time progress"
    - "Two-step yt-dlp: --print title first, then download with clean filename"
    - "Deterministic output path construction (not parsed from yt-dlp output)"
    - "plugin-store with defaults:{} for persistent settings"

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
    - src-tauri/src/lib.rs

key-decisions:
  - "StoreOptions requires `defaults` field (not autoSave standalone) in plugin-store 2.4.2"
  - "load() with defaults:{} used instead of autoSave:true for plugin-store compatibility"
  - "Two-step yt-dlp title fetch: --print title before download for deterministic filename"
  - "Done path constructed as format!(\"{}/{}.mp3\", save_dir, safe_title) - not parsed from yt-dlp output"

patterns-established:
  - "Pattern: Channel<T> onmessage switch dispatch for multi-event Rust->TS IPC"
  - "Pattern: CSS :root custom properties for design tokens (--color-*, --font-*, --border-*, --shadow-*)"
  - "Pattern: FolderPicker loads store on mount to restore last path"

requirements-completed: [ENG-05, ENG-06, UI-01, UI-02]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 01 Plan 03: Y2K UI + Title Cleanup Summary

**Y2K-styled React UI (pastel palette + Press Start 2P/VT323 fonts) wired to Rust download engine with real-time Channel progress, folder persistence via plugin-store, and title cleanup pipeline stripping 14 YouTube noise patterns for clean MP3 filenames**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-21T13:32:48Z
- **Completed:** 2026-03-21T13:36:13Z
- **Tasks:** 2 of 3 executed (Task 3 is human-verify checkpoint)
- **Files modified:** 12

## Accomplishments

- Complete Y2K retro UI with CSS custom properties, pixel fonts, and pastel palette
- End-to-end download flow: URL input -> FolderPicker -> Download button -> real-time ProgressBar -> ErrorBanner
- Title cleanup pipeline in Rust: clean_title() strips 14 noise patterns (Official Video/MV, Lyrics, Audio, HD, 4K, MV, Visualizer), sanitize_filename() removes filesystem-unsafe chars
- Deterministic MP3 output path built from cleaned title (not parsed from yt-dlp output)
- FolderPicker persists last-used folder across app restarts via plugin-store

## Task Commits

Each task was committed atomically:

1. **Task 1: Y2K UI shell wired to Rust download engine** - `9bdd189` (feat)
2. **Task 2: Title cleanup pipeline and deterministic output path** - `0615075` (feat)

**Plan metadata:** (pending final commit)

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
- `src-tauri/src/download.rs` - Two-step download: --print title -> clean -> download with safe filename
- `src-tauri/src/lib.rs` - Added mod title

## Decisions Made

- Used `load('app-settings.json', { defaults: {} })` for plugin-store — the `StoreOptions` type in v2.4.2 requires the `defaults` field; `autoSave: true` standalone is not valid.
- Two-step yt-dlp approach: first `--print title` to get raw title, then clean and sanitize, then download. Avoids post-processing path parsing.
- Done event path is built deterministically as `format!("{}/{}.mp3", save_dir, safe_title)` since we control the `-o` template.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed StoreOptions API mismatch**
- **Found during:** Task 1 (FolderPicker build)
- **Issue:** `load('app-settings.json', { autoSave: true })` fails TypeScript compile — StoreOptions in plugin-store 2.4.2 requires `defaults` field
- **Fix:** Changed to `load('app-settings.json', { defaults: {} })`
- **Files modified:** src/components/FolderPicker.tsx
- **Verification:** `npm run build` passes (Vite + TypeScript)
- **Committed in:** 9bdd189 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required API fix. No scope creep.

## Issues Encountered

- plugin-store v2.4.2 StoreOptions type requires `defaults` field — resolved immediately by switching to `{ defaults: {} }`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 complete: end-to-end URL -> MP3 download flow is functional
- Task 3 (human-verify checkpoint) is pending — user must run `cargo tauri dev` and verify the full flow
- Phase 2 (search/preview) can build on FolderPicker, ProgressBar, and ErrorBanner components
- Title cleanup and deterministic path patterns are reusable for batch download in Phase 2

## Self-Check: PASSED

- All created files exist on disk
- Both task commits verified in git log (9bdd189, 0615075)
- SUMMARY.md created at .planning/phases/01-download-engine/01-03-SUMMARY.md
- STATE.md updated with decisions, metrics, session info
- ROADMAP.md updated (Phase 01 Complete, 3/3 summaries)
- Requirements ENG-05, ENG-06, UI-01, UI-02 marked complete

---
*Phase: 01-download-engine*
*Completed: 2026-03-21*
