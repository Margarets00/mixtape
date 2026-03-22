---
phase: quick
plan: 260322-n0q
subsystem: yt-dlp cookie integration
tags: [cookies, yt-dlp, browser-detection, sign-in-bypass]
dependency_graph:
  requires: []
  provides: [cookie-browser-injection]
  affects: [download, queue, preview, settings-ui]
tech_stack:
  added: []
  patterns: [cookie_browser_args helper, AppState extension, store-to-AppState sync]
key_files:
  created:
    - src-tauri/src/cookies.rs
  modified:
    - src-tauri/src/state.rs
    - src-tauri/src/lib.rs
    - src-tauri/src/download.rs
    - src-tauri/src/queue.rs
    - src-tauri/src/preview.rs
    - src/components/SettingsTab.tsx
    - src/App.tsx
decisions:
  - search.rs excluded from cookie injection: no AppHandle param in search functions, scope would require frontend invoke changes — download/queue/preview cover the primary bot-detection paths
  - cookie_browser_args extracted before spawned task in queue.rs to avoid Rust lifetime errors
  - store restoration in App.tsx useEffect wins over auto-detect result when user has explicitly saved a preference
metrics:
  duration: "~25min"
  completed_date: "2026-03-22"
  tasks_completed: 2
  tasks_total: 3
  files_created: 1
  files_modified: 7
---

# Quick Task 260322-n0q: yt-dlp Cookie Browser Integration Summary

**One-liner:** macOS browser cookie auto-detection with --cookies-from-browser injection into all yt-dlp calls (download/queue/preview) and SettingsTab manual selection UI with app-settings.json persistence.

## Tasks Completed

### Task 1: Rust — cookies.rs + AppState extension + yt-dlp cookie injection
**Commit:** 7ed7713

- Created `src-tauri/src/cookies.rs` with:
  - `detect_cookie_browser` Tauri command: reads macOS Launch Services plist for default browser, falls back to checking browser profile paths
  - `set_cookie_browser` Tauri command: updates AppState.cookie_browser from frontend
  - `cookie_browser_args` helper: returns `["--cookies-from-browser", "browser"]` or empty vec
- Extended `AppState` with `cookie_browser: Mutex<Option<String>>` field
- Updated `lib.rs`: added `mod cookies`, `.setup()` spawns auto-detection, registered two new invoke handlers
- Updated `download.rs`: extract `cookie_args` before title fetch and download spawn, inject via `.args(&cookie_args)`
- Updated `queue.rs`: extract `cookie_args` before spawned task, clone into task, inject into title fetch and download command
- Updated `preview.rs`: extract `cookie_args`, inject into yt-dlp preview command

**Verification:** `cargo build` — 0 errors, 1 pre-existing dead_code warning in search.rs (unrelated)

### Task 2: Frontend — SettingsTab cookie section + App.tsx startup restore
**Commit:** 907bad7

- Updated `SettingsTab.tsx`:
  - Added `invoke` import from `@tauri-apps/api/core`
  - Added `cookieBrowser` and `cookieStatus` state
  - Load `cookie_browser` from store on mount, set status accordingly
  - `handleSelectBrowser`: toggles browser selection, calls `invoke('set_cookie_browser')`, persists to store
  - Added COOKIE SOURCE section: status text (green when active, pink when none), browser toggle buttons (chrome/safari/firefox/brave/edge), [OFF] button when active
- Updated `App.tsx`:
  - Added `useEffect` to load `cookie_browser` from `app-settings.json` and call `invoke('set_cookie_browser')` on startup, restoring user's explicit choice over auto-detection result

**Verification:** `npm run build` — 0 TypeScript errors, build successful

### Task 3: Human Verification (checkpoint — pending)
Status: Awaiting user verification via `cargo tauri dev`

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written with one intentional scope exclusion documented in plan itself.

### Scope Exclusion (per plan spec)

`search.rs` cookie injection was explicitly excluded in the plan spec (Task 1, item 7). Search commands lack `AppHandle` parameter and adding it would require frontend invoke signature changes outside this task's scope. download/queue/preview cover the bot-detection-critical paths.

## Known Stubs

None — cookie_browser state is fully wired: auto-detection on startup → AppState → UI display; manual selection → AppState + store → restored on restart.

## Self-Check
