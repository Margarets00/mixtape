---
phase: quick
plan: 260322-mr7
subsystem: ui
tags: [react, state-lifting, always-mount, search, tabs]

requires: []
provides:
  - SearchTab state persistence across tab navigation via App-level state ownership
  - Always-mount pattern (display:none) for SearchTab
  - searchStateRef pattern for safe async callbacks with lifted state
affects: [SearchTab, App]

tech-stack:
  added: []
  patterns:
    - "State lifting: searchState owned by App, passed down as props + callback"
    - "Always-mount tab: display:none instead of conditional unmount to preserve component state"
    - "searchStateRef + useEffect sync: safe async closure pattern when state is a prop"

key-files:
  created: []
  modified:
    - src/App.tsx
    - src/components/SearchTab.tsx
    - src/hooks/useAutoUpdate.ts

key-decisions:
  - "Always-mount + display:none chosen over sessionStorage/context — simpler, zero serialization cost for in-memory state like Set<string>"
  - "searchStateRef pattern chosen for playlist streaming callbacks to avoid stale closure capturing old prop value"
  - "SearchState exported from App.tsx to keep co-location with other shared types (QueueItem, PreviewTrack)"

patterns-established:
  - "Always-mount tab pattern: wrap in <div style={{display: activeTab === X ? 'block' : 'none'}}> and keep other tabs conditional"
  - "Lifted state + ref sync: useRef(state) + useEffect(() => { ref.current = state }, [state]) for async callbacks"

requirements-completed: []

duration: 8min
completed: 2026-03-22
---

# Quick Task 260322-mr7: SearchTab State Persistence Summary

**SearchTab search results, query, and playlist state now survive tab navigation via state lifting to App level with always-mount display:none pattern**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-22T00:00:00Z
- **Completed:** 2026-03-22T00:08:00Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Extracted all SearchTab internal useState into a `SearchState` interface owned by `App`
- SearchTab now receives state and a setter callback as props, eliminating re-initialization on remount
- Replaced conditional mount (`{activeTab === 'search' && <SearchTab />}`) with always-mount + `display: none/block` to keep React tree alive across tab switches
- Used `searchStateRef` + `useEffect` sync pattern to safely reference latest state inside async `onTrack.onmessage` playlist callbacks

## Task Commits

1. **Task 1: Lift SearchTab state to App level, always-mount with CSS visibility** - `6a6ee8c` (feat)

## Files Created/Modified

- `src/App.tsx` - Added `SearchState` interface + `INITIAL_SEARCH_STATE`, `searchState` useState, always-mount SearchTab wrapper div, `searchState`/`onSearchStateChange` props passed down
- `src/components/SearchTab.tsx` - Removed all internal useState, added `searchState`/`onSearchStateChange` props, `update()` helper, `searchStateRef` for async safety
- `src/hooks/useAutoUpdate.ts` - Fixed pre-existing type bug: added explicit return type so `install: null` is typed as `(() => void) | null` instead of literal `null`

## Decisions Made

- Always-mount + `display:none` pattern preferred over `sessionStorage` serialization — avoids JSON roundtrips, preserves `Set<string>` without custom serializer
- `searchStateRef` kept internal to SearchTab — not exposed to App — since it's an implementation detail of the async callback, not shared state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript error in useAutoUpdate.ts**
- **Found during:** Task 1 verification (npm run build)
- **Issue:** `install: null` was inferred as literal type `null`, making `install?.()` fail with `Type 'never' has no call signatures`
- **Fix:** Added explicit return type annotation to `useAutoUpdate()` with `install: (() => void) | null`
- **Files modified:** `src/hooks/useAutoUpdate.ts`
- **Verification:** `npm run build` succeeds with zero type errors
- **Committed in:** `6a6ee8c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - pre-existing type bug blocking build)
**Impact on plan:** Fix was required to unblock build verification. No scope creep.

## Issues Encountered

None — once the pre-existing type bug was fixed, the state lifting implementation compiled cleanly on the first attempt.

## Known Stubs

None — all state fields are wired and functional.

## Next Phase Readiness

- Tab navigation state persistence complete for SearchTab
- Pattern established (always-mount + state lifting) can be reused for other tabs if needed
- No blockers

---
*Phase: quick*
*Completed: 2026-03-22*
