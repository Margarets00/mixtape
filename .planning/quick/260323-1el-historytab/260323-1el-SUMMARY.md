---
phase: quick
plan: 260323-1el
subsystem: ui
tags: [react, typescript, tauri, queue, history]

requires:
  - phase: 03-power-features
    provides: HistoryEntry type and download history store

provides:
  - Re-queue button on each HistoryTab entry
  - HistoryTab accepts dispatch and queue props

affects: [HistoryTab, App]

tech-stack:
  added: []
  patterns: [Pass dispatch and queue from App to child tabs for queue interaction]

key-files:
  created: []
  modified:
    - src/components/HistoryTab.tsx
    - src/App.tsx

key-decisions:
  - "Button disabled when item is in queue with non-done status (pending/starting/downloading/converting/retrying)"
  - "duration: '' used as fallback since HistoryEntry has no duration field"

requirements-completed: [QUICK-historytab-requeue]

duration: 3min
completed: 2026-03-23
---

# Quick Task 260323-1el: History Tab Re-Queue Button Summary

**+ QUEUE button added to each HistoryTab entry, dispatching ADD_ITEM to queue reducer with disabled state when item is already active in queue**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-23T00:00:00Z
- **Completed:** 2026-03-23T00:03:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- HistoryTab now accepts `dispatch` and `queue` props from App.tsx
- Each history entry shows a "+ QUEUE" button with retro theme styling
- Button is disabled (opacity 0.4, cursor not-allowed) when item is already in queue with non-done status
- App.tsx passes `dispatch` and `queue` to `<HistoryTab />`
- TypeScript compiles without errors

## Task Commits

1. **Task 1: Add dispatch/queue props to HistoryTab and render + QUEUE button** - `35ef5c5` (feat)

## Files Created/Modified

- `src/components/HistoryTab.tsx` - Added HistoryTabProps interface, dispatch/queue props, + QUEUE button per entry
- `src/App.tsx` - Changed `<HistoryTab />` to `<HistoryTab dispatch={dispatch} queue={queue} />`

## Decisions Made

- Used `duration: ''` as fallback since `HistoryEntry` has no duration field but `QueueItem` requires it
- Disabled condition: `queue.some(i => i.id === entry.videoId && i.status.type !== 'done')` — item active in queue (not yet finished)
- Inline style spread used for conditional disabled style to keep existing style object pattern consistent

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

- src/components/HistoryTab.tsx: FOUND
- src/App.tsx: FOUND
- Commit 35ef5c5: FOUND

---
*Phase: quick*
*Completed: 2026-03-23*
