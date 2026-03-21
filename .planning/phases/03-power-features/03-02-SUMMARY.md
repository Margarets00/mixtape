---
phase: 03-power-features
plan: 02
subsystem: download-pipeline + settings-ui
tags: [filename-pattern, thumbnail-embed, yt-dlp, settings, queue]
dependency_graph:
  requires: []
  provides: [filename-pattern-mapping, thumbnail-embed-flag, settings-ui-pattern-preview]
  affects: [queue_download, SettingsTab, QueueTab]
tech_stack:
  added: []
  patterns:
    - map_filename_pattern() helper converts user token syntax to yt-dlp template variables
    - embed_thumbnail defaults to true via Option<bool>.unwrap_or(true)
    - Live preview function with hardcoded example values (Queen / Bohemian Rhapsody)
key_files:
  created: []
  modified:
    - src-tauri/src/queue.rs
    - src/components/SettingsTab.tsx
    - src/components/QueueTab.tsx
decisions:
  - "map_filename_pattern returns None for empty string, caller falls back to safe_title (no behavior change for existing users)"
  - "embed_thumbnail defaults to true in Rust via unwrap_or(true) — new users get thumbnail embedding without explicit setting"
  - "output_path for Done event always uses safe_title since yt-dlp template resolves at runtime and exact filename is unpredictable"
  - "extra_args built per-attempt inside the retry loop so thumbnail flags are always re-applied on retry"
metrics:
  duration: 2min
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_modified: 3
---

# Phase 03 Plan 02: Custom Filename Pattern + Thumbnail Embed Summary

Custom filename pattern support with live preview in Settings, and thumbnail embedding toggle. Users can enter `{artist} - {title}` pattern tokens that map to yt-dlp output template variables, plus toggle MP3 thumbnail embedding (defaults ON).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Filename pattern mapping + thumbnail flag in queue_download | ba9683e | src-tauri/src/queue.rs |
| 2 | Settings UI -- filename pattern input with live preview + thumbnail toggle | 2814671 | src/components/SettingsTab.tsx, src/components/QueueTab.tsx |

## What Was Built

**Task 1 — queue.rs changes:**
- Added `map_filename_pattern()` function that converts `{title}`, `{artist}`, `{channel}`, `{year}`, `{track_num}` tokens to yt-dlp `%(title)s`, `%(artist)s`, `%(uploader)s`, `%(upload_date>%Y)s`, `%(playlist_index)s` variables
- Extended `queue_download` with `filename_pattern: Option<String>` and `embed_thumbnail: Option<bool>` parameters
- Output template uses mapped pattern when provided, otherwise falls back to `safe_title` (no regression)
- Added `--embed-thumbnail --convert-thumbnails jpg` flags when `embed_thumbnail` is true (default)

**Task 2 — UI changes:**
- `SettingsTab.tsx`: Added `filenamePattern` state (persisted to `filename_pattern` key), `embedThumbnail` state (persisted to `embed_thumbnail` key, default true)
- Added `previewFilename()` function with hardcoded Queen / Bohemian Rhapsody example values
- Rendered filename pattern input with help text showing available tokens and live preview below the save folder section
- Rendered thumbnail embed checkbox toggle defaulting to checked
- `QueueTab.tsx`: Loads both settings from store before each download, passes `filenamePattern` and `embedThumbnail` to `invoke('queue_download', ...)`

## Verification

- `cargo check` passes (1 pre-existing warning about unused `is_playlist_url`, not related to this plan)
- `npx tsc --noEmit` passes (no output = no errors)
- All acceptance criteria grep checks pass

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. The filename pattern and thumbnail toggle are fully wired:
- Pattern input -> store -> QueueTab loads -> passed to queue_download -> mapped to yt-dlp -o template
- Thumbnail toggle -> store -> QueueTab loads -> passed to queue_download -> --embed-thumbnail flags

## Self-Check: PASSED
