---
phase: 04-distribution
plan: 01
subsystem: infra
tags: [tauri, tauri-plugin-updater, tauri-plugin-process, codesigning, notarization, github-releases, lipo, entitlements]

# Dependency graph
requires:
  - phase: 03-power-features
    provides: completed Tauri app with plugin infrastructure and notification system

provides:
  - macOS code signing + hardened runtime entitlements config in tauri.conf.json
  - Windows EV signCommand placeholder in tauri.conf.json
  - tauri-plugin-updater registered in Rust (via .setup()) and JS
  - Auto-update silent check on launch with non-blocking Y2K toast notification
  - CI sidecar script with universal macOS lipo-merge for ffmpeg

affects:
  - 04-02 (GitHub Actions release workflow — depends on this signing config and CI script)

# Tech tracking
tech-stack:
  added:
    - tauri-plugin-updater = "2" (Rust crate)
    - tauri-plugin-process = "2" (Rust crate, enables relaunch after update)
    - "@tauri-apps/plugin-updater": "^2" (JS bindings)
    - "@tauri-apps/plugin-process": "^2" (JS bindings)
  patterns:
    - tauri-plugin-updater registered via .setup() closure with #[cfg(desktop)] guard (not via .plugin() directly — requires app handle)
    - Silent update check: useEffect with empty dep array, catches all errors silently
    - State-managed update toast: dismissed flag prevents re-showing after user clicks Later

key-files:
  created:
    - src-tauri/Entitlements.plist — hardened runtime entitlements (JIT, unsigned-exec-mem, disable-lib-validation)
    - scripts/download-sidecars-ci.sh — CI universal macOS sidecar download with lipo ffmpeg merge
    - src/hooks/useAutoUpdate.ts — silent update check hook returning updateAvailable/version/install/dismiss
  modified:
    - src-tauri/Cargo.toml — added tauri-plugin-updater and tauri-plugin-process
    - src-tauri/tauri.conf.json — added createUpdaterArtifacts, macOS signing/notarization, Windows signCommand, plugins.updater config
    - src-tauri/capabilities/default.json — added updater:default permission
    - src-tauri/src/lib.rs — registered tauri_plugin_process and tauri_plugin_updater via .setup()
    - package.json — added @tauri-apps/plugin-updater and @tauri-apps/plugin-process
    - src/App.tsx — wired useAutoUpdate hook, added fixed-position update toast

key-decisions:
  - "tauri-plugin-updater registered via .setup() not .plugin() — plugin requires app handle at registration time"
  - "UPDATER_PUBKEY_PLACEHOLDER and OWNER/REPO are intentional greppable placeholders — must be filled before first release via: npm run tauri signer generate"
  - "signingIdentity uses IDENTITY_PLACEHOLDER (TEAM_PLACEHOLDER) — must be replaced with actual Developer ID Application identity"
  - "CI sidecar script delegates Windows/Linux to existing download-sidecars.sh via exec — only macOS universal case needs lipo"
  - "Update toast positioned at bottom: 80px to clear the PlayerBar height"

patterns-established:
  - "Pattern: Auto-update via silent check on mount — never throws to user, catches all network/manifest errors"
  - "Pattern: Update toast uses existing CSS variables (--color-green, --color-pink, --font-display, --border-style) for retro theme consistency"
  - "Pattern: CI sidecar script accepts target triple argument, enabling platform-specific behavior in GitHub Actions matrix"

requirements-completed:
  - UI-03

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 04 Plan 01: Signing, Notarization, and Auto-Updater Infrastructure Summary

**tauri-plugin-updater wired in Rust + JS with silent launch check and Y2K toast, plus macOS entitlements, signing config, and universal CI sidecar script with lipo ffmpeg merge**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T06:52:59Z
- **Completed:** 2026-03-22T06:55:01Z
- **Tasks:** 2
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- Added tauri-plugin-updater and tauri-plugin-process to both Rust (Cargo.toml) and JS (package.json), with proper registration in lib.rs via `.setup()` closure
- Configured tauri.conf.json with macOS signing identity + hardened runtime + entitlements path, Windows signCommand placeholder, createUpdaterArtifacts flag, and updater plugin endpoint pointing to GitHub Releases
- Created Entitlements.plist with all three required hardened runtime keys, CI sidecar script with universal macOS lipo ffmpeg merge, and useAutoUpdate hook with silent check and session-dismissible toast UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Add updater plugin + signing config + entitlements + CI sidecar script** - `492f41f` (feat)
2. **Task 2: Wire auto-update check on app launch with toast notification UI** - `e46662a` (feat)

**Plan metadata:** (committed with SUMMARY.md, STATE.md, ROADMAP.md)

## Files Created/Modified

- `src-tauri/Cargo.toml` - Added tauri-plugin-updater and tauri-plugin-process dependencies
- `src-tauri/tauri.conf.json` - Added signing config, notarization, updater plugin endpoint with greppable placeholders
- `src-tauri/Entitlements.plist` - New: hardened runtime entitlements for macOS notarization
- `src-tauri/capabilities/default.json` - Added updater:default permission
- `src-tauri/src/lib.rs` - Registered process plugin via .plugin(), updater via .setup() with #[cfg(desktop)] guard
- `scripts/download-sidecars-ci.sh` - New: CI-specific sidecar download with lipo-merge for universal macOS ffmpeg
- `src/hooks/useAutoUpdate.ts` - New: silent update check hook, session-dismissible
- `src/App.tsx` - Imported useAutoUpdate, added fixed-position Y2K-styled toast with Update Now / Later buttons
- `package.json` - Added @tauri-apps/plugin-updater and @tauri-apps/plugin-process

## Decisions Made

- Used `.setup()` for updater plugin registration (not `.plugin()`) — updater requires app handle; `.plugin()` would panic
- Left `UPDATER_PUBKEY_PLACEHOLDER` and `OWNER/REPO` as greppable strings — operator must run `npm run tauri signer generate` before first release
- `signCommand` contains DigiCert signtool pattern per plan spec — must be confirmed against actual EV certificate provider
- CI script uses `exec` to delegate to `download-sidecars.sh` for non-macOS targets — minimal code duplication
- Toast positioned at `bottom: 80px` to sit above the PlayerBar's fixed footer

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled cleanly with no new errors.

## User Setup Required

Before the first release, the following placeholders in `src-tauri/tauri.conf.json` must be filled in:

1. `UPDATER_PUBKEY_PLACEHOLDER` — run `npm run tauri signer generate -- -w ~/.tauri/youtube-dl-app.key`, paste the printed public key here
2. `IDENTITY_PLACEHOLDER (TEAM_PLACEHOLDER)` in `bundle.macOS.signingIdentity` — replace with your actual "Developer ID Application: Name (TEAMID)" identity
3. `OWNER/REPO` in `plugins.updater.endpoints` — replace with your GitHub username and repository name
4. `signCommand` in `bundle.windows` — confirm the exact syntax with your EV certificate provider

## Next Phase Readiness

- All signing, entitlements, and updater infrastructure is in place for Plan 02 (GitHub Actions release workflow)
- CI sidecar script (`download-sidecars-ci.sh`) is ready to be called from GitHub Actions matrix jobs
- Placeholders are clearly named and greppable; blocking concern noted in STATE.md

---
*Phase: 04-distribution*
*Completed: 2026-03-22*
