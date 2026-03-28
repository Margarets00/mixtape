---
phase: 03-power-features
plan: 03
subsystem: ui
tags: [tauri, tauri-plugin-notification, tauri-plugin-opener, react, typescript, history, metadata]

# Dependency graph
requires:
  - phase: 03-power-features-02
    provides: queue_download command with filename_pattern + embed_thumbnail params, playlist loading
  - phase: 03-power-features-01
    provides: SearchTab + SearchResultRow + PlaylistTrackRow components
provides:
  - HISTORY tab with download entries loaded from plugin-store
  - Inline metadata editor on pending queue items (title/artist/album)
  - Show in Finder button on completed queue items
  - System notification on download completion
  - DOWNLOADED badge on search results for previously downloaded tracks
  - download-history.json store (500-entry cap, videoId dedup)
  - MetadataOverride struct + metadata_overrides param in queue_download Rust command
affects: [phase-04, verifier]

# Tech tracking
tech-stack:
  added:
    - tauri-plugin-notification (Rust crate + JS @tauri-apps/plugin-notification)
    - tauri-plugin-opener (Rust crate, JS @tauri-apps/plugin-opener already present)
  patterns:
    - History stored in plugin-store as JSON array, prepend+dedup+cap pattern
    - Metadata overrides passed as Option<MetadataOverride> to Rust command, injected as yt-dlp --parse-metadata flags
    - Notification permission requested inline with isPermissionGranted/requestPermission guard
    - Item data snapshot before channel callback to avoid stale closure

key-files:
  created:
    - src/components/HistoryTab.tsx
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/lib.rs
    - src-tauri/capabilities/default.json
    - src-tauri/src/queue.rs
    - src/App.tsx
    - src/components/TabBar.tsx
    - src/components/QueueItem.tsx
    - src/components/QueueTab.tsx
    - src/components/SearchTab.tsx
    - src/components/SearchResultRow.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "History write uses snapshot of item data before channel callback — avoids stale closure from React state"
  - "Metadata overrides use yt-dlp --parse-metadata flag with :(?P<meta_title>...) syntax"
  - "Notification permission guard: isPermissionGranted check before requestPermission — avoids repeated prompts"
  - "DOWNLOADED badge shown pink (var(--color-pink-dark)) to distinguish from IN QUEUE badge (blue)"

patterns-established:
  - "Plugin registration: add to Cargo.toml + lib.rs builder + capabilities/default.json"
  - "History cap at 500 entries via .slice(0, 500) after prepend"

requirements-completed: [META-01, HIST-01, QOL-01, QOL-02]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 3 Plan 3: Power Features QoL — History, Metadata Editor, Finder + Notifications Summary

**Tauri notification/opener plugins integrated; HISTORY tab with download entries, inline metadata editor for pre-download tag overrides, Show in Finder button on completed items, and system notification on download complete**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T18:28:56Z
- **Completed:** 2026-03-21T18:33:56Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Plugin infrastructure: tauri-plugin-notification and tauri-plugin-opener registered in Rust and capabilities JSON
- HISTORY tab (4th tab per D-14): loads from download-history.json store, shows entries with thumbnail/title/channel/date, most recent first
- Inline metadata editor: Edit button on pending queue items expands title/artist/album form; saved overrides passed to yt-dlp as --parse-metadata flags (META-01)
- Show in Finder button on done queue items using revealItemInDir (QOL-01)
- System notification fires on download completion with track title (QOL-02)
- DOWNLOADED badge on search results for tracks already in download history (HIST-01)
- History write: prepend + deduplicate by videoId + cap at 500 entries, persisted via plugin-store

## Task Commits

Each task was committed atomically:

1. **Task 1: Plugin infrastructure + Tab extension + History tab** - `4c46747` (feat)
2. **Task 2: Inline metadata editor on QueueItem** - `8814572` (feat)
3. **Task 3: History write + system notification on download complete** - `ff5e5bc` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/components/HistoryTab.tsx` — History list UI loading from download-history.json store
- `src/App.tsx` — Tab type extended to include 'history'; HistoryEntry type exported; downloadedIds state + refresh callback; history/QueueTab/SearchTab render wired
- `src/components/TabBar.tsx` — HISTORY tab added as 3rd item (before SETTINGS)
- `src/components/QueueItem.tsx` — metadataExpanded state, inline editor form, Edit button (pending only), Show in Finder button (done only), onSetMetadata prop
- `src/components/QueueTab.tsx` — addToHistory function, notifyDownloadComplete function, Done handler wired, onHistoryUpdate prop
- `src/components/SearchTab.tsx` — downloadedIds? prop accepted, passed to SearchResultRow and PlaylistTrackRow
- `src/components/SearchResultRow.tsx` — isDownloaded? prop, DOWNLOADED badge (pink)
- `src-tauri/Cargo.toml` — tauri-plugin-notification and tauri-plugin-opener dependencies
- `src-tauri/src/lib.rs` — plugin registration for notification and opener
- `src-tauri/capabilities/default.json` — notification:default and opener:default permissions
- `src-tauri/src/queue.rs` — MetadataOverride struct, metadata_overrides parameter, --parse-metadata flag injection
- `package.json` / `package-lock.json` — @tauri-apps/plugin-notification installed

## Decisions Made

- **Item snapshot before channel callback:** React state accessed inside async channel callbacks may be stale. Snapshots `itemData = { ...item }` and `itemTitle = item.title` before invoking to avoid closure issues.
- **Notification permission guard:** Calls `isPermissionGranted()` before `requestPermission()` to avoid re-prompting users who already granted permission.
- **DOWNLOADED badge color:** Pink (var(--color-pink-dark)) to visually distinguish from IN QUEUE (blue) badge.
- **Metadata via --parse-metadata:** yt-dlp `--parse-metadata :(?P<meta_title>...)` syntax injects overrides into ID3 tags without re-encoding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added onHistoryUpdate prop stub to QueueTabProps before full Task 3 implementation**
- **Found during:** Task 1 (TypeScript check after App.tsx update)
- **Issue:** App.tsx passed `onHistoryUpdate` to QueueTab, but QueueTabProps in QueueTab.tsx didn't declare it yet, causing TS2322 error
- **Fix:** Added `onHistoryUpdate?: () => void` to QueueTabProps; used `_onHistoryUpdate` prefix to suppress TS6133 (unused variable) until Task 3 wired the full implementation
- **Files modified:** src/components/QueueTab.tsx
- **Verification:** TypeScript check passed
- **Committed in:** 4c46747 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking)
**Impact on plan:** Necessary forward-declaration to satisfy TypeScript across task boundaries. Task 3 completed the full wiring. No scope creep.

## Issues Encountered

None — plan executed cleanly. The only deviation was a Task 1/3 ordering issue resolved by prop stub.

## User Setup Required

None - no external service configuration required. Notification permission is requested inline by the app on first download completion.

## Next Phase Readiness

- All Phase 3 requirements complete (META-01, HIST-01, QOL-01, QOL-02 from plan 03-03; earlier plans covered the rest)
- Phase 3 is now fully executable
- Phase 4 (distribution/packaging) can proceed: all features implemented

---
*Phase: 03-power-features*
*Completed: 2026-03-21*

## Self-Check: PASSED

- FOUND: src/components/HistoryTab.tsx
- FOUND: src/App.tsx (with HistoryEntry, downloadedIds, 'history' tab)
- FOUND: src-tauri/src/queue.rs (with MetadataOverride)
- FOUND: commit 4c46747 (Task 1)
- FOUND: commit 8814572 (Task 2)
- FOUND: commit ff5e5bc (Task 3)
