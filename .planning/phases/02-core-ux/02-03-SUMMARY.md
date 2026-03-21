---
phase: 02-core-ux
plan: "03"
subsystem: ui
tags: [tauri, rust, react, typescript, yt-dlp, rate-limit, retry, exponential-backoff]

# Dependency graph
requires:
  - phase: 02-core-ux-02
    provides: queue download infrastructure with semaphore, cancel support, and error state UI

provides:
  - Automatic exponential backoff (30s/60s/120s) for 429 rate-limit errors in queue downloads
  - RetryWait event variant in DownloadEvent enum for frontend countdown updates
  - retrying status variant in QueueItemStatus with per-second countdown display

affects:
  - 02-core-ux verification (QUEUE-05 closes)
  - Any future plans touching queue.rs download loop or DownloadEvent enum

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Arc<Mutex<Vec<String>>> stderr collection for post-process error inspection in retry loops
    - Per-second countdown event emission during backoff sleep
    - Permit held across all retry attempts (semaphore slot not released between retries)

key-files:
  created: []
  modified:
    - src-tauri/src/download.rs
    - src-tauri/src/queue.rs
    - src/App.tsx
    - src/components/QueueTab.tsx
    - src/components/QueueItem.tsx

key-decisions:
  - "Stderr collected into Arc<Mutex<Vec<String>>> during download instead of emitting errors immediately — allows retry loop to inspect lines after process exits and decide whether to retry"
  - "Countdown emits one RetryWait event per second for smooth UI update; cancel check happens at top of each countdown iteration"
  - "Permit held for all 3 retry attempts + backoff sleeps — semaphore slot reserved for the full retry lifecycle, not just active download time"
  - "Non-429 errors skip retry and emit immediately — only rate-limit errors warrant automatic backoff"

patterns-established:
  - "Retry pattern: collect stderr to Vec, inspect after wait(), branch on error type before emitting to frontend"
  - "Countdown pattern: for remaining in (0..wait_secs).rev() { check cancel; sleep 1s; send remaining }"

requirements-completed: [QUEUE-05]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 02 Plan 03: 429 Exponential Backoff Retry Summary

**Exponential backoff retry loop (30s/60s/120s, max 3 attempts) for yt-dlp 429 rate-limit errors with per-second countdown UI in the queue item row**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T16:57:56Z
- **Completed:** 2026-03-21T17:00:11Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `RetryWait { attempt, wait_secs, remaining_secs }` variant to `DownloadEvent` enum
- Refactored `queue_download` in `queue.rs` with a retry loop: stderr collected via `Arc<Mutex<Vec<String>>>`, 429 detection triggers up to 3 retries with 30s/60s/120s backoff and per-second countdown events
- Added `retrying` status variant to `QueueItemStatus` and wired `RetryWait` event through `QueueTab.tsx` to a light-blue countdown UI in `QueueItem.tsx`; CANCEL button visible during backoff

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RetryWait event variant and backoff loop in Rust backend** - `b8eec77` (feat)
2. **Task 2: Add retrying state to frontend types and update QueueItem UI with countdown** - `cf8e723` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `src-tauri/src/download.rs` - Added `RetryWait { attempt: u32, wait_secs: u64, remaining_secs: u64 }` variant to `DownloadEvent` enum
- `src-tauri/src/queue.rs` - Full rewrite of download task: `BACKOFF_SECS = [30, 60, 120]`, `is_rate_limit_error` helper, retry loop with stderr collection, countdown emission, PID re-registration per attempt
- `src/App.tsx` - Added `retrying` union member to `QueueItemStatus` type
- `src/components/QueueTab.tsx` - Added `RetryWait` to `DownloadEvent` interface; added `case 'RetryWait':` in `onmessage` switch dispatching `retrying` status
- `src/components/QueueItem.tsx` - Added `retrying` background color, render branch ("Retrying in Xs... (attempt N/3)"), and CANCEL button visibility for retrying state

## Decisions Made

- Stderr collected into `Arc<Mutex<Vec<String>>>` during download instead of being emitted immediately — allows the retry loop to inspect lines after process exits and decide whether to retry or emit error.
- Countdown emits one `RetryWait` event per second for smooth UI update; cancel check (queue_pids key presence) happens at the top of each countdown iteration.
- Semaphore permit held for all 3 retry attempts and backoff sleeps combined — the slot is reserved for the full retry lifecycle.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- QUEUE-05 is fully implemented and verifiable
- Both `cargo check` and `npx tsc --noEmit` pass cleanly
- No blockers for phase 02 verification or subsequent phases

---
*Phase: 02-core-ux*
*Completed: 2026-03-21*
