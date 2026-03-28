---
phase: 02-core-ux
plan: 01
subsystem: ui
tags: [tauri, rust, react, typescript, youtube-api, yt-dlp, search, tabs]

# Dependency graph
requires:
  - phase: 01-download-engine
    provides: locate_sidecar(), download.rs patterns, yt-dlp/ffmpeg sidecar setup, AppState

provides:
  - Rust dual-mode search backend (YouTube API v3 + yt-dlp ytsearch5: fallback)
  - Three-tab navigation shell (SEARCH / QUEUE / SETTINGS)
  - Search results UI with thumbnails, title, channel, duration
  - Settings panel with API key persistence and folder picker
  - QueueItem and PreviewTrack type system shared across components
  - Placeholder QueueTab and PlayerBar for plan 02-02

affects: [02-02-queue-preview, future-phases]

# Tech tracking
tech-stack:
  added: [reqwest (already in Cargo.toml), tokio sync+time features, tauri protocol-asset feature]
  patterns: [dual-mode search with API-first + yt-dlp fallback, tab-based layout with useReducer queue state, ISO 8601 duration parsing via regex]

key-files:
  created:
    - src-tauri/src/search.rs
    - src/components/TabBar.tsx
    - src/components/SearchTab.tsx
    - src/components/SearchResultRow.tsx
    - src/components/SettingsTab.tsx
    - src/components/QueueTab.tsx
    - src/components/PlayerBar.tsx
  modified:
    - src-tauri/src/state.rs
    - src-tauri/src/lib.rs
    - src-tauri/tauri.conf.json
    - src-tauri/capabilities/default.json
    - src-tauri/Cargo.toml
    - src/App.tsx
    - src/styles/global.css

key-decisions:
  - "http:default and http:allow-fetch are not valid permissions in this Tauri v2 setup — reqwest handles HTTP from Rust natively, no http plugin needed"
  - "StoreOptions in plugin-store 2.4.2 requires defaults field; used defaults:{} instead of autoSave:false (consistent with Phase 1 decision)"
  - "tauri protocol-asset Cargo feature required when assetProtocol.enable=true in tauri.conf.json"
  - "API key is passed from frontend to Rust search command as Option<String> parameter, since plugin-store Rust API access requires additional setup"

patterns-established:
  - "Search: invoke('search', { query, apiKey }) — api_key passed from frontend where store is already loaded"
  - "All new components use var(--font-display)/var(--font-body) CSS variables with no new colors"
  - "QueueReducer in App.tsx owns queue state; dispatch propagated via props to child tabs"

requirements-completed: [SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05]

# Metrics
duration: 4min
completed: 2026-03-22
---

# Phase 02 Plan 01: Search Backend + Tab Shell Summary

**Dual-mode YouTube search (YouTube API v3 + yt-dlp fallback) with three-tab shell, search results UI, and Settings panel with persistent API key and folder storage**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-22T10:35:51Z
- **Completed:** 2026-03-22T10:39:51Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Rust search backend with `search_youtube_api` (ISO 8601 duration parsing), `search_ytdlp` (ytsearch5: flat-playlist), and unified `search` command (URL detection, API-first fallback logic)
- Extended AppState with preview_pid, queue_pids, HashMap, and Semaphore for plan 02-02
- Tab navigation shell with SEARCH/QUEUE/SETTINGS tabs, queue count badge, instant tab switching
- Search results UI with 48x48 thumbnails, title, channel/duration line, PREVIEW and +QUEUE buttons, IN QUEUE badge, fallback warning banner
- Settings panel with password/text toggle API key input, KEY SAVED confirmation, persistent folder picker

## Task Commits

1. **Task 1: Rust search backend + config changes** - `5a9c164` (feat)
2. **Task 2: Tab shell, Search UI, Settings panel** - `a6f4b89` (feat)

**Plan metadata:** (upcoming docs commit)

## Files Created/Modified

- `src-tauri/src/search.rs` - Three Tauri commands: search_youtube_api, search_ytdlp, search
- `src-tauri/src/state.rs` - Extended AppState: preview_pid, queue_pids, download_semaphore
- `src-tauri/src/lib.rs` - Added mod search, registered search::search, extended exit handler
- `src-tauri/Cargo.toml` - Added tokio sync+time, tauri protocol-asset features
- `src-tauri/tauri.conf.json` - Added CSP with media-src/img-src and assetProtocol scope
- `src-tauri/capabilities/default.json` - Kept existing permissions (http plugin not needed)
- `src/App.tsx` - Complete rewrite: tab layout, queueReducer, PreviewTrack state
- `src/components/TabBar.tsx` - SEARCH/QUEUE/SETTINGS tabs with queue badge
- `src/components/SearchTab.tsx` - Search input, results list, idle/loading/empty states
- `src/components/SearchResultRow.tsx` - Thumbnail, title, channel, duration, PREVIEW/+QUEUE buttons
- `src/components/SettingsTab.tsx` - API key input with show/hide, folder picker, store persistence
- `src/components/QueueTab.tsx` - Placeholder queue list (completed in plan 02-02)
- `src/components/PlayerBar.tsx` - Placeholder idle player bar (completed in plan 02-02)
- `src/styles/global.css` - Added input[type=password] rules, @keyframes blink

## Decisions Made

- `http:default` / `http:allow-fetch` capability permissions are not valid in this Tauri v2 setup — reqwest makes HTTP calls from Rust natively without the http plugin. Removed from capabilities/default.json.
- `tauri protocol-asset` feature must be added to Cargo.toml when `assetProtocol.enable=true` in tauri.conf.json — Tauri's build script validates this at compile time.
- API key passed as `Option<String>` parameter from frontend to `search` command — frontend loads it from plugin-store before invoking, avoids complexity of Rust-side store access.
- StoreOptions requires `defaults: {}` field in plugin-store 2.4.2 (consistent with Phase 1 pattern).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed invalid http capability permissions**
- **Found during:** Task 1 (Rust backend compilation)
- **Issue:** Plan specified adding `http:default` and `http:allow-fetch` to capabilities/default.json, but these permissions don't exist in this Tauri v2 project (no tauri-plugin-http installed). Build failed with "Permission http:default not found".
- **Fix:** Removed http permissions. reqwest handles YouTube API HTTP calls natively from Rust — no frontend-facing http plugin permissions needed.
- **Files modified:** src-tauri/capabilities/default.json
- **Verification:** `cargo check` passes
- **Committed in:** 5a9c164 (Task 1 commit)

**2. [Rule 3 - Blocking] Added tauri protocol-asset Cargo feature**
- **Found during:** Task 1 (Rust backend compilation)
- **Issue:** tauri.conf.json has `assetProtocol.enable=true` but tauri Cargo dependency didn't include `protocol-asset` feature. Build script validation failed.
- **Fix:** Added `protocol-asset` to tauri features in Cargo.toml.
- **Files modified:** src-tauri/Cargo.toml
- **Verification:** `cargo check` passes
- **Committed in:** 5a9c164 (Task 1 commit)

**3. [Rule 1 - Bug] Changed StoreOptions from autoSave:false to defaults:{}**
- **Found during:** Task 2 (Frontend build)
- **Issue:** Plan specified `{ autoSave: false }` for store load options, but plugin-store 2.4.2 TypeScript types require `defaults` field. TypeScript compilation error.
- **Fix:** Used `{ defaults: {} }` consistent with Phase 1 FolderPicker pattern.
- **Files modified:** src/components/SearchTab.tsx, src/components/SettingsTab.tsx
- **Verification:** `npm run build` passes
- **Committed in:** a6f4b89 (Task 2 commit)

**4. [Rule 1 - Bug] Fixed duplicate fontFamily in SettingsTab**
- **Found during:** Task 2 (Frontend build)
- **Issue:** SettingsTab had two `fontFamily` properties in one style object (TypeScript error TS1117).
- **Fix:** Kept `fontFamily: 'monospace'` for path display, removed redundant `var(--font-body)`.
- **Files modified:** src/components/SettingsTab.tsx
- **Verification:** `npm run build` passes
- **Committed in:** a6f4b89 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bug)
**Impact on plan:** All auto-fixes required for build to succeed. No scope changes.

## Issues Encountered

None beyond the auto-fixed compilation errors above.

## Known Stubs

- `src/components/QueueTab.tsx` — Minimal placeholder, no download logic. Will be fully implemented in plan 02-02.
- `src/components/PlayerBar.tsx` — Idle state only, no audio playback. Will be wired to preview in plan 02-02.
- `SearchTab.tsx` onPreview — Sets `previewTrack` with `audioUrl: ''` (empty). Audio preview download logic implemented in plan 02-02.

These stubs are intentional — plan 02-02 completes queue and preview features.

## Next Phase Readiness

- Plan 02-02 can use `QueueItem`/`QueueAction`/`PreviewTrack` types exported from App.tsx
- AppState already has `preview_pid`, `queue_pids`, `download_semaphore` for plan 02-02's Rust code
- TabBar's queue badge will auto-update as plan 02-02 populates the queue
- `assetProtocol` is configured for plan 02-02's audio preview temp file playback

---
*Phase: 02-core-ux*
*Completed: 2026-03-22*

## Self-Check: PASSED

All created files confirmed to exist. Both task commits (5a9c164, a6f4b89) confirmed in git log.
