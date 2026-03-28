---
phase: 05-test-infrastructure
plan: 02
subsystem: ci
tags: [ci, github-actions, cargo-test, sidecar-verification, release-workflow]
dependency_graph:
  requires: ["05-01"]
  provides: ["CI cargo test gate", "CI sidecar existence gate"]
  affects: [".github/workflows/release.yml"]
tech_stack:
  added: []
  patterns: ["cargo test in CI per platform job", "pwsh Test-Path for Windows CI checks"]
key_files:
  modified:
    - path: .github/workflows/release.yml
      role: "Release workflow with cargo test + sidecar verification steps in all 3 platform jobs"
decisions:
  - "Windows sidecar check uses pwsh shell with Test-Path per research D-13 and pitfall 5 — avoids bash test -f cross-platform issues on Windows CI runner"
  - "--test-threads=1 used for cargo test to avoid env var race conditions identified in research"
  - "New steps inserted between sidecar download and tauri-action — catches failures fast before the slow Tauri build"
metrics:
  duration: "70s"
  completed: "2026-03-29"
  tasks_completed: 1
  files_modified: 1
---

# Phase 05 Plan 02: CI Cargo Test + Sidecar Verification Summary

**One-liner:** Added `cargo test --test-threads=1` and platform-specific sidecar file existence checks to all three CI platform jobs (macOS/Windows/Linux) inserted before the tauri-action build step.

## What Was Built

Inserted two new steps into each of the three platform jobs in `.github/workflows/release.yml`:

1. **Run Rust unit tests** — `cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1` — runs the unit tests written in Phase 05-01 before attempting the slow Tauri cross-platform build. Fails fast if tests break.

2. **Verify sidecar files exist** — checks that `download-sidecars-ci.sh` / `download-sidecars.sh` actually placed the expected binaries before `tauri-action` tries to bundle them:
   - macOS: `yt-dlp-aarch64-apple-darwin`, `yt-dlp-x86_64-apple-darwin`, `ffmpeg-aarch64-apple-darwin`, `ffmpeg-x86_64-apple-darwin`
   - Windows: `yt-dlp-x86_64-pc-windows-msvc.exe`, `ffmpeg-x86_64-pc-windows-msvc.exe` (PowerShell `Test-Path`)
   - Linux: `yt-dlp-x86_64-unknown-linux-gnu`, `ffmpeg-x86_64-unknown-linux-gnu`

Step ordering per job: Download sidecars → Run Rust unit tests → Verify sidecar files exist → tauri-action.

CI trigger (`on: push: tags: v*`) unchanged.

## Decisions Made

- **Windows uses `shell: pwsh` with `Test-Path`:** bash `test -f` can behave unexpectedly on Windows CI runners with Git Bash path resolution; PowerShell's `Test-Path` is the idiomatic and reliable approach for Windows GitHub Actions.
- **`--test-threads=1` for cargo test:** Research (D-13 / pitfall notes) identified env var race conditions when tests run in parallel on CI — single-threaded prevents flaky failures.
- **Fail-fast placement:** Both new steps go before `tauri-action` so that test and sidecar failures are caught in ~seconds rather than after 5-10 minutes of Tauri compilation.

## Verification

All acceptance criteria passed:
- `grep -c "Run Rust unit tests" release.yml` → 3
- `grep -c "Verify sidecar files exist" release.yml` → 3
- cargo test command with `--test-threads=1` present
- macOS, Windows, Linux sidecar filenames all present
- `shell: pwsh` present for Windows step
- `tags:` trigger unchanged
- YAML valid (python3 pyyaml parse: OK)

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add cargo test + sidecar verification to CI | 419adeb | .github/workflows/release.yml |

## Self-Check: PASSED

- FOUND: .github/workflows/release.yml
- FOUND: commit 419adeb
