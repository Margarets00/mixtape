---
phase: 02-core-ux
plan: 02
subsystem: ui
tags: [tauri, rust, react, preview, queue, audio, yt-dlp, semaphore]

# Dependency graph
requires:
  - phase: 02-01
    provides: AppState with preview_pid/queue_pids/download_semaphore, QueueItem/QueueAction/PreviewTrack types, SearchTab, assetProtocol enabled
  - phase: 01-download-engine
    provides: locate_sidecar, DownloadEvent, parse_yt_dlp_line, download command pattern
provides:
  - preview.rs with preview_start (60s temp-file download via yt-dlp --download-sections) and preview_stop commands
  - queue.rs with queue_download (bounded concurrency via Semaphore, 2s delay, progress streaming, PID tracking) and cancel_download commands
  - PlayerBar component with audio playback via asset:// protocol (convertFileSrc), play/pause toggle, progress bar
  - QueueTab component with Download All, Clear Done, SAVING TO header, per-item Channel-based progress dispatch
  - QueueItem component with 5-state visual machine (Pending/Downloading/Converting/Done/Error)
affects: [03-polish, 04-distribution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tauri IPC Channel for streaming DownloadEvent from Rust to frontend per queue item"
    - "Semaphore::acquire_owned() moved into spawned task so permit lifetime equals download duration"
    - "app.state::<T>() called inline on a single line to avoid Rust lifetime issues with bound variables"
    - "preview temp files named preview_{videoId}.mp3 in system temp dir, cleaned on stop and exit"
    - "60s audio preview via yt-dlp --download-sections *0-60 + convertFileSrc for asset:// playback"

key-files:
  created:
    - src-tauri/src/preview.rs
    - src-tauri/src/queue.rs
    - src/components/QueueItem.tsx
  modified:
    - src-tauri/src/download.rs (made parse_yt_dlp_line pub)
    - src-tauri/src/lib.rs (mod preview/queue, invoke_handler, exit cleanup)
    - src/components/PlayerBar.tsx (full replacement from placeholder)
    - src/components/QueueTab.tsx (full replacement from placeholder)
    - src/components/SearchTab.tsx (fixed audioUrl to pass actual YouTube URL)

key-decisions:
  - "app.state::<AppState>() called inline on expression rather than bound to let variable, avoids E0597 borrow lifetime issue in async command functions"
  - "parse_yt_dlp_line made pub so queue.rs can reuse error parsing logic without duplication"
  - "OwnedSemaphorePermit moved into spawned task to hold concurrency slot for full download duration"
  - "cancel_download removes PID from registry but does not clean .part files — yt-dlp .part naming is self-contained and harmless"
  - "SearchTab fixed to construct audioUrl as youtube.com/watch?v={id} instead of empty string"

patterns-established:
  - "Pattern: Tauri Channel per queue item — create Channel, set onmessage, pass as on_event arg to invoke"
  - "Pattern: Rust preview pipeline — delete stale temp, spawn yt-dlp with --download-sections *0-60, wait, return absolute path"
  - "Pattern: Queue state machine — QueueItemStatus union type drives both Rust event -> dispatch mapping and React render branching"

requirements-completed: [PREV-01, PREV-02, PREV-03, QUEUE-01, QUEUE-02, QUEUE-03, QUEUE-04, QUEUE-05, QUEUE-06]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 02 Plan 02: Preview and Queue Summary

**60s audio preview via yt-dlp temp-file download + cart-style download queue with Semaphore-bounded concurrency (max 2), per-item Channel progress streaming, 5-state visual machine, and cancel/retry support**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T16:23:56Z
- **Completed:** 2026-03-21T16:28:04Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Preview pipeline: `preview_start` downloads 60s MP3 to temp file via `yt-dlp --download-sections *0-60`, returns path for `convertFileSrc()` → `asset://` playback in PlayerBar
- Queue download: `queue_download` acquires semaphore (max 2 concurrent), waits 2s, streams progress/error events via Tauri IPC Channel, registers PID for cancel
- Frontend PlayerBar with loading/playing/idle states, play/pause toggle, progress bar fill
- QueueTab with Download All (fires all pending/error items, semaphore handles concurrency), Clear Done, Saving To header with settings link
- QueueItem 5-state machine: Pending (cancel), Downloading (inline fill + %, cancel), Converting (blink), Done (green, opacity), Error (yellow, retry)
- Fixed SearchTab `audioUrl` stub (was empty string) to pass real `youtube.com/watch?v=` URL

## Task Commits

1. **Task 1: Rust preview + queue commands** - `b7256ee` (feat)
2. **Task 2: Player bar, Queue tab, and Queue item components** - `d7cda28` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src-tauri/src/preview.rs` - preview_start (60s temp-file download), preview_stop, preview_stop_internal (also called from exit handler)
- `src-tauri/src/queue.rs` - queue_download (semaphore, 2s delay, Channel streaming, PID registration), cancel_download
- `src-tauri/src/download.rs` - parse_yt_dlp_line made `pub` for queue.rs reuse
- `src-tauri/src/lib.rs` - mod preview/queue, 4 new commands in invoke_handler, preview temp cleanup in exit handler
- `src/components/PlayerBar.tsx` - full implementation: invoke preview_start, convertFileSrc, Audio element, play/pause, progress
- `src/components/QueueTab.tsx` - full implementation: Channel per item, Download All, Clear Done, SAVING TO header, QueueItemRow list
- `src/components/QueueItem.tsx` - new file: 5-state render, inline progress fill, blink animation, cancel/retry buttons
- `src/components/SearchTab.tsx` - fixed audioUrl from empty string to `https://www.youtube.com/watch?v=${result.id}`

## Decisions Made

- `app.state::<AppState>()` called inline (not bound to `let state = ...`) in async command fns to avoid Rust E0597 lifetime error — the `State<'_>` borrow must not outlive its containing expression
- `OwnedSemaphorePermit` moved into the final `tauri::async_runtime::spawn` block so it holds the semaphore slot for the full download duration, not just until `queue_download` returns
- `parse_yt_dlp_line` changed from `fn` to `pub fn` — queue.rs reuses the same yt-dlp line parser rather than duplicating

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `use tauri::Manager;` to preview.rs and queue.rs**
- **Found during:** Task 1 (after cargo check)
- **Issue:** `app.state::<AppState>()` requires `tauri::Manager` trait in scope; plan code did not import it
- **Fix:** Added `use tauri::Manager;` at top of both files
- **Files modified:** src-tauri/src/preview.rs, src-tauri/src/queue.rs
- **Verification:** `cargo check` passes
- **Committed in:** b7256ee (Task 1 commit)

**2. [Rule 1 - Bug] Restructured state borrows to fix Rust E0597**
- **Found during:** Task 1 (cargo check revealed 4 lifetime errors)
- **Issue:** `let state = app.state::<AppState>(); if let Ok(mut g) = state.xxx.lock()` pattern creates a `State<'_>` that the borrow checker sees as not living long enough when bound to a variable
- **Fix:** Changed all state accesses to inline form `app.state::<AppState>().xxx.lock()` — no binding, expression drops immediately
- **Files modified:** src-tauri/src/preview.rs, src-tauri/src/queue.rs
- **Verification:** `cargo check` succeeds with 0 errors
- **Committed in:** b7256ee (Task 1 commit)

**3. [Rule 1 - Bug] Fixed SearchTab audioUrl stub**
- **Found during:** Task 2 review (plan explicitly calls this out as a stub to fix)
- **Issue:** SearchTab `onPreview` was passing `audioUrl: ''` — preview_start would receive a blank URL and fail
- **Fix:** Changed to `audioUrl: \`https://www.youtube.com/watch?v=\${result.id}\``
- **Files modified:** src/components/SearchTab.tsx
- **Verification:** `npm run build` succeeds
- **Committed in:** d7cda28 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 Rust compilation bugs, 1 Rule 1 stub bug)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered

- Rust E0597 lifetime error when binding `app.state::<AppState>()` to a variable in async fns — resolved by inlining the state access on a single expression so the temporary drops before the next statement

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full core UX loop is complete: search -> preview -> queue -> download
- Audio preview requires packaged build test (known blocker from STATE.md — `cargo tauri dev` WebView does not serve asset:// from temp dir reliably)
- Phase 03 can begin: polish, error states, settings refinements

---
*Phase: 02-core-ux*
*Completed: 2026-03-21*
