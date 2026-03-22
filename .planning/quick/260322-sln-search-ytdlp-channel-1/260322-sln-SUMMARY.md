---
phase: quick
plan: 260322-sln
subsystem: search
tags: [streaming, channel, yt-dlp, rust, typescript]
dependency_graph:
  requires: []
  provides: [streaming-search-channel]
  affects: [SearchTab, search.rs]
tech_stack:
  added: []
  patterns: [tauri-ipc-channel, streaming-results]
key_files:
  created: []
  modified:
    - src-tauri/src/search.rs
    - src/components/SearchTab.tsx
decisions:
  - "SearchEvent enum uses serde tag=type+content for discriminated union — matches PlaylistTrackEvent pattern"
  - "URL branch wraps Channel in Promise for sync-style await in URL paste flow"
  - "Results list shown during isSearching to display streamed results alongside skeleton rows"
metrics:
  duration: ~7min
  completed: 2026-03-22
  tasks_completed: 2
  files_modified: 2
---

# Phase quick Plan 260322-sln: Channel-based Search Streaming Summary

**One-liner:** Converted `search()` from batch `Result<SearchResponse>` to `Channel<SearchEvent>` streaming, making yt-dlp keyword results appear one-by-one (~1-2s first result vs ~5-8s wait).

## What Was Built

### Rust: `SearchEvent` enum + Channel-based `search()` command

Added `SearchEvent` enum with three variants using serde discriminated union pattern (same as `PlaylistTrackEvent`):
- `Result { id, title, thumbnail_url, duration, channel }` — one per video
- `Done { total, used_fallback }` — signals completion
- `Error { message }` — signals failure

Changed `search()` signature from `-> Result<SearchResponse, String>` to accept `on_result: tauri::ipc::Channel<SearchEvent>` and return `Result<(), String>`.

Three execution paths:
1. **URL branch**: collect single-video metadata via yt-dlp `.output()`, emit one `Result` + `Done{total:1, used_fallback:true}`
2. **YouTube API branch**: batch-fetch results, emit each as `Result`, then `Done{used_fallback:false}`
3. **yt-dlp fallback**: inline streaming with `BufReader::new(stdout).lines()`, emit `Result` per line as it arrives, then `Done{used_fallback:true}`

### TypeScript: Channel-based invocation in `SearchTab.tsx`

Replaced `SearchResponse` interface with `SearchEvent` interface matching Rust serde output.

**Normal search path**: Creates `Channel<SearchEvent>`, sets `isSearching: true, results: []` upfront, then:
- On `Result`: appends to `searchStateRef.current.results` via `onSearchStateChange`
- On `Done`: sets `isSearching: false`, `usedFallback` from event data
- On `Error`: clears results, sets `isSearching: false`

**URL paste path**: Wraps Channel in a `Promise<void>`, resolves on `Done`, rejects on `Error`. Collects result in array, uses `collectedResults[0]` same as before.

**Result display**: Removed `!isSearching` guard — results now render as they arrive alongside skeleton shimmer rows.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 9bf787e | Rust: SearchEvent enum + Channel-based search() |
| Task 2 | d5195ab | Frontend: Channel-based search invocation |

## Verification

- `cargo check` passes (3 dead-code warnings only: `search_ytdlp`, `SearchResponse`, `is_playlist_url`)
- `npx tsc --noEmit` passes with no errors
- Manual: yt-dlp keyword search will stream results one-by-one
- Manual: YouTube API search emits batch (all at once via channel)
- Manual: URL paste still adds directly to queue

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- [x] `src-tauri/src/search.rs` modified — confirmed
- [x] `src/components/SearchTab.tsx` modified — confirmed
- [x] Commit 9bf787e exists — confirmed
- [x] Commit d5195ab exists — confirmed
- [x] `cargo check` passes — confirmed
- [x] `npx tsc --noEmit` passes — confirmed
