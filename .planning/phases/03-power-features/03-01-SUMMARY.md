---
phase: 03-power-features
plan: "01"
subsystem: playlist
tags: [playlist, search, streaming, channel, yt-dlp]
dependency_graph:
  requires: []
  provides: [search_playlist Tauri command, PlaylistTrackRow component, playlist branch in SearchTab]
  affects: [src-tauri/src/search.rs, src-tauri/src/lib.rs, src/components/SearchTab.tsx, src/components/PlaylistTrackRow.tsx]
tech_stack:
  added: []
  patterns: [tauri::ipc::Channel streaming, tokio BufReader line-by-line streaming, serde tag=type enum]
key_files:
  created:
    - src/components/PlaylistTrackRow.tsx
  modified:
    - src-tauri/src/search.rs
    - src-tauri/src/lib.rs
    - src/components/SearchTab.tsx
decisions:
  - "is_playlist_url only matches /playlist?list= — watch?v=X&list=Y still handled as single-video"
  - "PlaylistTrackEvent uses serde tag=type+content for discriminated union compatible with TypeScript Channel typing"
  - "isDownloaded prop stubbed as false — history integration deferred to Plan 03"
  - "Skeleton loading shows 3 shimmer rows while yt-dlp streams; rows appear progressively above skeletons"
metrics:
  duration: "2 minutes"
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_changed: 4
---

# Phase 03 Plan 01: Playlist Support Summary

Playlist URL support via yt-dlp `--flat-playlist --print` streaming — user pastes playlist URL, tracks appear progressively with checkbox selection, batch Add to Queue.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Playlist streaming backend (search_playlist command) | aaf887e | src-tauri/src/search.rs, src-tauri/src/lib.rs |
| 2 | Playlist UI in SearchTab + PlaylistTrackRow component | 12a69f3 | src/components/PlaylistTrackRow.tsx, src/components/SearchTab.tsx |

## What Was Built

### Backend (search.rs + lib.rs)
- `PlaylistTrackEvent` enum with `Track`, `Done`, `Error` variants using serde `tag="type" content="data"` for discriminated union
- `search_playlist` Tauri command that spawns yt-dlp with `--flat-playlist --print "%(id)s\t%(title)s\t%(thumbnail)s\t%(duration_string)s\t%(channel)s"` and streams events via `tauri::ipc::Channel`
- `is_playlist_url` helper that matches only `/playlist?list=` URLs — `watch?v=X&list=Y` URLs continue to single-video lookup
- Fallback thumbnail using `img.youtube.com/vi/{id}/mqdefault.jpg` when yt-dlp returns empty/NA thumbnail
- Registered `search_playlist` in `lib.rs` invoke_handler

### Frontend (PlaylistTrackRow.tsx + SearchTab.tsx)
- `PlaylistTrackRow` component: checkbox | 40x30 thumbnail | title + DOWNLOADED badge + channel | duration
- `isPlaylistUrl` frontend mirror for immediate URL detection before invoking backend
- Playlist branch in `handleSearch`: detects playlist URL, sets `isPlaylist=true`, opens `Channel<PlaylistTrackEvent>`, calls `invoke('search_playlist')`
- Progressive rendering: tracks appended one-by-one as `Track` events arrive
- 3 shimmer skeleton rows (CSS `@keyframes shimmer`) shown while `playlistLoading=true`
- Select All / Deselect All / "ADD TO QUEUE (N)" toolbar buttons
- "< BACK" button to exit playlist mode and return to normal search
- Non-playlist URLs continue to the existing `search` command path — no regression

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `PlaylistTrackRow isDownloaded` prop always receives `false` — download history integration comes in Plan 03.

## Self-Check: PASSED

Files exist:
- FOUND: src/components/PlaylistTrackRow.tsx
- FOUND: src-tauri/src/search.rs (modified)
- FOUND: src/components/SearchTab.tsx (modified)

Commits exist:
- FOUND: aaf887e — feat(03-01): add search_playlist Tauri command with Channel streaming
- FOUND: 12a69f3 — feat(03-01): add playlist UI with PlaylistTrackRow and SearchTab playlist branch
