---
phase: 01-download-engine
plan: "01"
subsystem: infra
tags: [tauri, rust, react, vite, yt-dlp, ffmpeg, sidecar, tauri-plugin-shell, tauri-plugin-dialog, tauri-plugin-store]

# Dependency graph
requires: []
provides:
  - "Tauri v2 + React + Vite project scaffold"
  - "tauri-plugin-shell, tauri-plugin-dialog, tauri-plugin-store registered in Rust and installed in npm"
  - "externalBin entries in tauri.conf.json for yt-dlp and ffmpeg sidecars"
  - "capabilities/default.json with shell:allow-execute sidecar permissions"
  - "scripts/download-sidecars.sh for downloading platform-specific binaries with correct target-triple naming"
  - "src-tauri/binaries/ with yt-dlp and ffmpeg for aarch64-apple-darwin (dev machine)"
affects: [01-02, 01-03, all-download-engine-plans]

# Tech tracking
tech-stack:
  added:
    - "tauri v2 (Rust desktop runtime)"
    - "tauri-plugin-shell v2 (sidecar process spawning)"
    - "tauri-plugin-dialog v2 (native folder picker)"
    - "tauri-plugin-store v2 (persistent key-value store)"
    - "@tauri-apps/plugin-shell, @tauri-apps/plugin-dialog, @tauri-apps/plugin-store (npm)"
    - "reqwest v0.12 (HTTP client for yt-dlp updates)"
    - "regex v1 (title cleanup patterns)"
    - "React 19 + Vite 7 + TypeScript 5.8"
  patterns:
    - "Sidecar binaries named <name>-<target-triple>[.exe] in src-tauri/binaries/"
    - "externalBin in tauri.conf.json references binaries without target triple suffix (Tauri appends it)"
    - "Capabilities file (default.json) uses shell:allow-execute with sidecar:true for explicit sidecar allowlist"
    - "Download script detects triple via rustc --print host-tuple (Rust 1.84+) with fallback"

key-files:
  created:
    - "src-tauri/Cargo.toml - Rust crate with all plugin dependencies"
    - "src-tauri/tauri.conf.json - App config with externalBin, identifier, title, window size"
    - "src-tauri/src/lib.rs - Tauri builder with all three plugins registered"
    - "src-tauri/src/main.rs - Standard Tauri entry point"
    - "src-tauri/capabilities/default.json - Shell/dialog/store permissions with sidecar allowlist"
    - "scripts/download-sidecars.sh - Cross-platform sidecar binary downloader"
    - "package.json - Frontend deps including all three @tauri-apps plugins"
    - "src/App.tsx - Minimal placeholder showing YouTube Music Downloader"
  modified:
    - ".gitignore - Added src-tauri/binaries/ exclusion"

key-decisions:
  - "Used universal macOS yt-dlp binary (yt-dlp_macos) named with aarch64-apple-darwin triple - works on both ARM and Intel"
  - "capabilities/default.json written directly instead of using scaffolded opener:default (plugin not needed)"
  - "Placeholder binaries created before real download to allow cargo check during scaffolding"

patterns-established:
  - "Pattern: Sidecar triple naming - binaries/<name>-<triple>[.exe], tauri.conf.json uses binaries/<name>"
  - "Pattern: Capabilities - shell:allow-execute with allow array for each sidecar binary"
  - "Pattern: Download script uses set -euo pipefail, temp dir cleanup on exit, and prints summary"

requirements-completed: [ENG-02, UI-03]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 1 Plan 01: Scaffold Summary

**Tauri v2 + React desktop app scaffold with yt-dlp and ffmpeg bundled as sidecar binaries, shell/dialog/store plugins registered, and download script for cross-platform binary management**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T13:20:17Z
- **Completed:** 2026-03-21T13:25:00Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments
- Scaffolded Tauri v2 + React + Vite project with correct app identifier (com.youtube-dl.app), title (YouTube Music Downloader), and window size (900x700)
- Registered tauri-plugin-shell, tauri-plugin-dialog, tauri-plugin-store in Rust lib.rs and installed npm equivalents
- Configured externalBin in tauri.conf.json and shell:allow-execute sidecar permissions in capabilities/default.json
- Created cross-platform download script that resolves Rust target triple, downloads yt-dlp and ffmpeg, and names binaries correctly
- Downloaded yt-dlp (37MB, universal macOS) and ffmpeg (80MB) for aarch64-apple-darwin dev machine

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Tauri v2 + React project and install all dependencies** - `b006119` (feat)
2. **Task 2: Create sidecar download script and capabilities config** - `16c33c1` (feat)

**Plan metadata:** (see below after creation)

## Files Created/Modified
- `src-tauri/Cargo.toml` - Rust crate with tauri-plugin-shell, dialog, store, reqwest, regex
- `src-tauri/tauri.conf.json` - App config with externalBin for yt-dlp/ffmpeg sidecars
- `src-tauri/src/lib.rs` - Tauri builder registering all three plugins
- `src-tauri/src/main.rs` - Standard Tauri entry point calling youtube_dl_app_lib::run()
- `src-tauri/capabilities/default.json` - Shell sidecar execution + dialog/store permissions
- `scripts/download-sidecars.sh` - Cross-platform sidecar binary download script (executable)
- `package.json` - Frontend with @tauri-apps/plugin-shell, dialog, store
- `src/App.tsx` - Minimal placeholder with "YouTube Music Downloader" heading
- `.gitignore` - Excludes src-tauri/binaries/ (large binaries downloaded at build time)

## Decisions Made
- Used universal macOS yt-dlp binary (`yt-dlp_macos`) named with aarch64-apple-darwin triple. Research noted this is unverified spike but the binary is a Mach-O universal binary (arm64 + x86_64) so it works on both architectures.
- Wrote capabilities/default.json directly rather than keeping scaffolded `opener:default` which was for tauri-plugin-opener (removed from dependencies).
- Created placeholder empty binary files before running download script to allow `cargo check` to succeed (externalBin validation requires files to exist).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced opener:default in capabilities with correct permissions**
- **Found during:** Task 1 (cargo check)
- **Issue:** Scaffolded capabilities/default.json referenced `opener:default` from tauri-plugin-opener which was removed from dependencies. Build failed with "Permission opener:default not found".
- **Fix:** Wrote the correct capabilities/default.json from the plan spec (shell:allow-execute with sidecar entries, dialog:allow-open, store:allow-*) in Task 1 to unblock cargo check.
- **Files modified:** src-tauri/capabilities/default.json
- **Verification:** cargo check passes cleanly
- **Committed in:** b006119 (Task 1 commit)

**2. [Rule 3 - Blocking] Created placeholder binaries to allow cargo check**
- **Found during:** Task 1 (second cargo check attempt)
- **Issue:** Tauri build script validates that externalBin paths exist. Empty binaries directory caused "resource path doesn't exist" error.
- **Fix:** Created empty placeholder files for yt-dlp-aarch64-apple-darwin and ffmpeg-aarch64-apple-darwin before running cargo check. Task 2 download script replaces them with real binaries.
- **Files modified:** src-tauri/binaries/ (placeholder files, git-ignored)
- **Verification:** cargo check passes after placeholder creation
- **Committed in:** b006119 (Task 1 commit; binaries not committed per .gitignore)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking)
**Impact on plan:** Both fixes were necessary for compilation to succeed and are required steps in any Tauri v2 sidecar setup. No scope creep.

## Issues Encountered
- `npm create tauri-app` refused to run in non-empty directory (contains .claude/, .git/, .planning/). Solved by scaffolding in /tmp then copying contents to project root.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Project compiles with `cargo check` and npm dependencies are installed
- Sidecar binaries (yt-dlp and ffmpeg) present in src-tauri/binaries/ for aarch64-apple-darwin
- All three Tauri plugins registered and ready for use in Plan 01-02 (download commands)
- Capabilities configured for sidecar execution, dialog, and store
- Plan 01-02 can immediately add download Rust commands using tauri_plugin_shell::ShellExt

---
*Phase: 01-download-engine*
*Completed: 2026-03-21*
