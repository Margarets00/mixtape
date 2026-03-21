# Phase 2: Core UX - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can search YouTube by keyword, preview a track in-app, add tracks to a queue, and download all of them as MP3s with per-item progress and rate-limit protection.

Covers: SRCH-01–05, PREV-01–03, QUEUE-01–06.
Does NOT cover: PLAY-01–03 (playlists), TITLE-01–02 (custom filename patterns).

</domain>

<decisions>
## Implementation Decisions

### App Layout — Tab Navigation

- **D-01:** Three tabs: `[SEARCH]` | `[QUEUE (N)]` | `[SETTINGS]`
- **D-02:** Persistent player bar at the bottom across all tabs (always present when a preview is active; idle behavior at Claude's discretion — match the retro theme)
- **D-03:** Queue tab shows a numeric badge with item count; exact trigger logic (total vs. pending-only) at Claude's discretion
- **D-04:** Phase 1's `DownloadForm` URL-input component is **removed**. The queue system replaces all download UX — no direct-URL mode in Phase 2

### Search Results Display

- **D-05:** Vertical list layout — each row: small thumbnail (left) + title, channel name, duration (right)
- **D-06:** Each row has two action buttons: `[▶ Preview]` and `[+ Queue]`
- **D-07:** When a row's track is previewing: results list stays visible unchanged; the bottom player bar activates and shows the now-playing state
- **D-08:** When a row's track is already in the queue: show an "IN QUEUE" badge on the row; both `[▶ Preview]` and `[+ Queue]` buttons remain clickable
- **D-09:** Before the first search (idle state): show a friendly retro text/illustration like `~ search for tunes ~`; Claude picks the exact copy and styling to match the Y2K theme

### Queue Panel

- **D-10:** Queue item during download: progress bar fills the row with percentage and speed text overlay (e.g., `[=======>    ] 72% 1.2MB/s`)
- **D-11:** Queue item states: Pending → Downloading % → Converting → Done ✓ / Error
- **D-12:** Completed items stay in the queue marked `Done ✓`; a "Clear Done" button at the top lets users bulk-remove completed items
- **D-13:** 429 rate-limit: item shows error state with the error message + a `[RETRY]` button; **no auto-retry**, user decides when to retry
- **D-14:** "Download All" button skips Done items and starts only Pending/Errored items
- **D-15:** Current download folder is shown at the top of the Queue tab: `Saving to: ~/Music  [change]` — clicking `[change]` navigates to the Settings tab

### Settings Panel

- **D-16:** YouTube API key: password-style input masked by default, eye icon to show/hide, Save button alongside, shows `Saved ✓` confirmation on success
- **D-17:** Download folder picker moved from Phase 1's `DownloadForm` to the Settings tab
- **D-18:** When no API key is configured and yt-dlp fallback is active: show a banner above search results — `~ using yt-dlp fallback (no API key) ~` — tappable to navigate to Settings tab

### Claude's Discretion

- Exact player bar idle state (hidden vs. always-visible with dim message)
- Queue badge count logic (total vs. pending-only)
- Retro text/illustration copy for search idle state
- Exact spacing, animation, and color choices within the established Y2K theme variables

</decisions>

<specifics>
## Specific Ideas

- The retro theme variables from Phase 1 (`--color-pink`, `--color-blue`, `--font-display`, `--border-style`, `--shadow-retro`) must be used consistently — no new colors introduced in Phase 2
- `locate_sidecar()` from `download.rs` is the established sidecar path resolution pattern — any new Rust commands that invoke yt-dlp/ffmpeg must reuse it
- The existing `DownloadEvent` enum in `download.rs` defines the IPC event shape — queue progress events should extend or reuse this pattern
- Audio preview must be tested in a **packaged build** (not `cargo tauri dev`) — it will silently fail otherwise (from STATE.md risk note)

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 foundation
- `src/App.tsx` — Current app shell; Phase 2 replaces `DownloadForm` with tab layout
- `src/styles/theme.css` — CSS variable definitions (colors, fonts, borders, shadows) — Phase 2 UI must use these
- `src/styles/global.css` — Global base styles
- `src-tauri/src/lib.rs` — Tauri command registration, plugin setup, exit handler pattern
- `src-tauri/src/download.rs` — `locate_sidecar()` reuse, `DownloadEvent` enum pattern, streaming stdout/stderr pattern
- `src-tauri/src/state.rs` — `AppState` struct; Phase 2 extends with queue state and preview PID tracking

### Requirements
- `.planning/REQUIREMENTS.md` — SRCH-01–05, PREV-01–03, QUEUE-01–06 are the phase scope
- `.planning/ROADMAP.md` — Phase 2 plan breakdown (02-01: Search+Settings, 02-02: Preview+Queue)

### Prior research notes (in STATE.md)
- `.planning/STATE.md` §Decisions — Dual-mode search architecture, audio preview temp-file approach, and sidecar patterns are already locked decisions from Phase 1 research

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `locate_sidecar(name)` in `download.rs`: reuse for any new yt-dlp invocations (search, preview download)
- `DownloadEvent` enum: extend with `QueueEvent` variant or create parallel enum for queue IPC
- `tauri_plugin_store`: already initialized in `lib.rs` — use for API key storage (SRCH-05)
- `tauri_plugin_dialog`: already initialized — use for folder picker in Settings
- `ProgressBar.tsx`, `ErrorBanner.tsx`: existing components with retro styling; reuse in queue item rows

### Established Patterns
- Two-step yt-dlp for single videos: `--print title` first, then download (already in `download.rs:122`)
- Both stdout and stderr must be read concurrently (from STATE.md — progress on stderr since ~2022)
- PID stored in `AppState.active_pid` for cleanup; Phase 2 needs a list of PIDs (one per queue slot)
- `plugin-store` requires `defaults: {}` in `StoreOptions` (not `autoSave: true`)

### Integration Points
- `lib.rs`: new Tauri commands (search, preview_start, queue_download, cancel_download) must be registered in `invoke_handler!`
- App exit handler in `lib.rs`: must be extended to kill all active queue PIDs, not just one
- Frontend state management: no state library currently (plain React); Phase 2 will need queue state — use `useState`/`useReducer` or introduce Zustand if complexity warrants

</code_context>

<deferred>
## Deferred Ideas

- Playlist URL input (PLAY-01–03) — Phase 3
- Custom filename pattern (TITLE-01–02) — Phase 3
- "Open in Finder/Explorer" after download (QOL-01) — v2 backlog
- Auto-retry on 429 with countdown (user chose manual retry; auto-retry is a potential v2 enhancement)

</deferred>

---

*Phase: 02-core-ux*
*Context gathered: 2026-03-22*
