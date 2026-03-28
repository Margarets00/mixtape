---
phase: 05-test-infrastructure
plan: 01
subsystem: backend/rust-tests
tags: [testing, rust, tdd, unit-tests, sidecar]
dependency_graph:
  requires: []
  provides: [rust-unit-tests, ytdlp-path-override]
  affects: [src-tauri/src/download.rs, src-tauri/src/errors.rs, src-tauri/Cargo.toml]
tech_stack:
  added: [tempfile = "3" (dev-dependency)]
  patterns: ["#[cfg(test)] mod tests", "YTDLP_PATH env var override for test isolation"]
key_files:
  created: []
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/download.rs
    - src-tauri/src/errors.rs
decisions:
  - "YTDLP_PATH env var inserted as first check in locate_sidecar — zero cost in prod, enables RAII temp dir injection in tests (D-06)"
  - "Debug derive added to DownloadEvent to support panic! formatting in pattern match arms"
  - "CI-gated missing binary test uses std::env::var(CI) guard — avoids flakiness on dev machines where real yt-dlp may exist"
metrics:
  duration: ~2min
  completed: 2026-03-29
  tasks_completed: 2
  files_modified: 3
---

# Phase 05 Plan 01: Rust Unit Tests for parse_yt_dlp_line, parse_ytdlp_error, locate_sidecar Summary

Rust unit test suite established for critical parsing and sidecar lookup paths, using YTDLP_PATH env var override and tempfile RAII for hermetic test isolation.

## What Was Built

- **tempfile dev-dependency** added to Cargo.toml for RAII temp directory cleanup in locate_sidecar tests
- **YTDLP_PATH env var override** inserted as first check in `locate_sidecar` — allows test to inject a fake binary path without touching the filesystem in dev or prod paths
- **Debug derive** added to `DownloadEvent` enum for pattern match panic! formatting in tests
- **4 unit tests in download.rs:**
  - `test_parse_progress_line` — verifies PROGRESS line parsing to percent/speed/eta fields
  - `test_parse_error_keyword_video_unavailable` — verifies ERROR line delegates to parse_ytdlp_error and contains "unavailable"
  - `test_locate_sidecar_via_env_override` — creates tempdir fake binary, sets YTDLP_PATH, confirms Ok return
  - `test_locate_sidecar_missing_returns_err_in_ci` — CI-only guard confirms Err on nonexistent binary
- **2 unit tests in errors.rs:**
  - `test_429_rate_limit` — confirms "rate limit" in returned message for HTTP Error 429 input
  - `test_video_unavailable` — confirms "unavailable" in returned message for Video unavailable input

## Verification

```
running 11 tests
test download::tests::test_locate_sidecar_missing_returns_err_in_ci ... ok
test download::tests::test_locate_sidecar_via_env_override ... ok
test download::tests::test_parse_error_keyword_video_unavailable ... ok
test download::tests::test_parse_progress_line ... ok
test errors::tests::test_429_rate_limit ... ok
test errors::tests::test_video_unavailable ... ok
test title::tests::test_clean_audio ... ok
test title::tests::test_clean_lyrics ... ok
test title::tests::test_clean_official_mv ... ok
test title::tests::test_clean_official_video ... ok
test title::tests::test_sanitize_filename ... ok

test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all test assertions verify real production logic paths. No placeholder or hardcoded values.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | 4b002d1 | feat(05-01): add tempfile dev-dep + YTDLP_PATH override + download.rs unit tests |
| Task 2 | f6a6436 | test(05-01): add unit tests for parse_ytdlp_error in errors.rs |

## Self-Check: PASSED
