---
phase: 260322-otd
plan: "01"
subsystem: frontend/search
tags: [ux, url-handling, queue, radio-mix]
key-files:
  modified:
    - src/components/SearchTab.tsx
    - src/App.tsx
decisions:
  - "isPlaylistUrl() already matched list=RD so YouTube URL branch must run before playlist branch — plan insertion point adjusted to be AFTER playlist check"
  - "toast shown even when onNavigateQueue is provided (user sees confirmation before tab switches)"
metrics:
  duration: ~8min
  completed: "2026-03-22T08:55:07Z"
  tasks: 2
  files: 2
---

# Quick Task 260322-otd: URL Radio Mix Strip Summary

**One-liner:** YouTube single-video URL detection + radio param strip + direct queue dispatch with inline toast feedback, bypassing search results UI.

## What Was Implemented

### Task 1: URL helpers + direct-to-queue branch (SearchTab.tsx)

Two helper functions added above `isPlaylistUrl()`:

- `isYoutubeUrl(input)` — checks for `https://www.youtube.com/`, `https://youtu.be/`, and http variants
- `stripRadioParams(url)` — uses `URL` API to delete `start_radio` and `list` params; safe because only called when `!isPlaylistUrl()` guards against real playlists

`SearchTabProps` extended with optional `onNavigateQueue?: () => void`.

Inside `handleSearch()`, after the playlist branch and before the normal search branch, a new YouTube single-video URL branch:
1. Strips radio params via `stripRadioParams()`
2. Extracts video ID (`watch?v=` or `youtu.be/` format)
3. Guards against missing ID → toast
4. Guards against duplicate queue entry → toast (in addition to queueReducer's silent dedup)
5. Fetches metadata via existing `invoke('search', { query: cleanUrl, ... })`
6. Dispatches `ADD_ITEM` with `results[0]` data
7. Resets query state, shows success toast, calls `onNavigateQueue?.()` for tab navigation

Toast UI added at top of return JSX (above the search input row) using project CSS variables (`--color-pink`, `--font-body`, `--color-blue-dark`, `--border-style`). Auto-dismisses after 3000ms.

### Task 2: onNavigateQueue prop wired in App.tsx

`onNavigateQueue={() => setActiveTab('queue')}` added to the `<SearchTab>` render call. After successful URL-to-queue add, the app automatically navigates to the queue tab.

## Key Decisions

1. **Branch insertion point:** The YouTube URL branch was inserted AFTER the `isPlaylistUrl` check (not before). This is correct because `isPlaylistUrl` already catches `list=RD` Radio Mix URLs — if `isPlaylistUrl` returns false, `stripRadioParams` deleting `list` is safe.

2. **Toast + tab navigation together:** Both the toast message and `onNavigateQueue?.()` are called on success. The toast is brief (3s) and the tab switch is immediate, so the user gets both the confirmation text and the visual context shift.

3. **No new state in SearchState:** Toast state is local to `SearchTab` via `useState` — it doesn't need to survive tab switches, so it wasn't added to the lifted `SearchState` object.

## Files Modified

| File | Change |
|------|--------|
| `src/components/SearchTab.tsx` | +114 lines: helpers, prop, toast state, URL branch, toast JSX |
| `src/App.tsx` | +1 line: `onNavigateQueue` prop on `<SearchTab>` |

## Commits

| Hash | Message |
|------|---------|
| edd6c43 | feat(260322-otd-01): URL direct-to-queue with radio param stripping |
| f2055a0 | feat(260322-otd-01): pass onNavigateQueue to SearchTab in App.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/components/SearchTab.tsx` exists and contains `isYoutubeUrl`, `stripRadioParams`, `onNavigateQueue`, `showToast`
- `src/App.tsx` contains `onNavigateQueue={() => setActiveTab('queue')}`
- Commits edd6c43 and f2055a0 exist
- `npm run build` passes with no TypeScript errors
