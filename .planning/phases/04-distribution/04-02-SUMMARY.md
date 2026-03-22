---
phase: 04-distribution
plan: 02
subsystem: infra
tags: [github-actions, tauri-action, ci-cd, release-workflow, macos, windows, linux]

# Dependency graph
requires:
  - phase: 04-01
    provides: download-sidecars-ci.sh for universal macOS sidecar build, tauri.conf.json signing config scaffolding
provides:
  - GitHub Actions release workflow (.github/workflows/release.yml) triggering on v* tags
  - Three parallel CI jobs: build-macos (universal ARM+Intel), build-windows, build-linux (AppImage)
  - Draft GitHub Release with all platform artifacts created automatically on tag push
affects: []

# Tech tracking
tech-stack:
  added:
    - tauri-apps/tauri-action@v0 (GitHub Actions action for Tauri builds)
    - dtolnay/rust-toolchain@stable (Rust toolchain installation)
    - swatinem/rust-cache@v2 (Rust build caching)
  patterns:
    - Three-job parallel CI (no matrix, no needs: dependencies) for independent platform builds
    - Draft release pattern — CI creates draft, human publishes after artifact review
    - Unsigned build pattern — GITHUB_TOKEN only, no signing env vars in secrets

key-files:
  created:
    - .github/workflows/release.yml
  modified: []

key-decisions:
  - "Unsigned builds chosen: no Apple Developer ID signing, no Windows EV cert, no notarization — user decision to ship without code signing for initial release"
  - "Auto-updater disabled: tauri-plugin-updater removed from release workflow env vars; users update by downloading new release manually"
  - "Draft release pattern retained: releaseDraft: true so human can verify artifacts before publishing"
  - "ubuntu-22.04 pinned (not ubuntu-latest) for glibc compatibility with AppImage"
  - "macOS universal binary via --target universal-apple-darwin with both aarch64 and x86_64 Rust targets installed"

patterns-established:
  - "Parallel CI jobs (not matrix): each platform is a named job running independently — one failure doesn't cancel others"
  - "Sidecar download separated by platform: macOS uses download-sidecars-ci.sh with universal-apple-darwin, Windows/Linux use download-sidecars.sh"

requirements-completed: [UI-03]

# Metrics
duration: ~30min (including checkpoint/decision)
completed: 2026-03-22
---

# Phase 4 Plan 02: GitHub Actions Release Workflow Summary

**Three-job parallel CI pipeline (macOS universal + Windows + Linux AppImage) triggering on v* tags, producing draft GitHub Releases with unsigned builds by user decision**

## Performance

- **Duration:** ~30 min (including checkpoint for signing decision)
- **Completed:** 2026-03-22
- **Tasks:** 1 automated + 1 checkpoint (human decision)
- **Files modified:** 1

## Accomplishments

- Created `.github/workflows/release.yml` with three independent parallel jobs: `build-macos`, `build-windows`, `build-linux`
- macOS job builds universal binary (ARM + Intel) via `--target universal-apple-darwin`, calls `download-sidecars-ci.sh`
- Linux job pinned to `ubuntu-22.04` with all required webkit/gtk/libfuse2 dependencies for AppImage
- All jobs use `swatinem/rust-cache@v2` for Rust build caching and create draft releases via `releaseDraft: true`
- Checkpoint resolution: user requested simplified unsigned workflow — removed all signing env vars (APPLE_CERTIFICATE, CERT_THUMBPRINT, TAURI_SIGNING_PRIVATE_KEY, etc.) and disabled auto-updater integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub Actions release workflow with three platform jobs** - `237fb86` (feat)
2. **Checkpoint resolution: simplify to unsigned builds, no auto-updater** - `4e8b6f9` (feat)

## Files Created/Modified

- `.github/workflows/release.yml` — Three-job CI pipeline: build-macos (universal), build-windows, build-linux; triggers on `push: tags: ['v*']`; all jobs produce draft GitHub Release

## Decisions Made

**Unsigned builds (user decision at checkpoint):**
- No Apple Developer ID signing or notarization — macOS users will need to right-click > Open on first launch, or Gatekeeper can be bypassed via System Preferences
- No Windows EV certificate / signCommand — SmartScreen will warn on first run; users must acknowledge
- Rationale: avoids Apple/Windows certificate costs and complexity for initial release; can be added later

**Auto-updater disabled (follows from unsigned decision):**
- tauri-plugin-updater requires signed artifacts to generate valid `latest.json` — signing removed, so updater env vars also removed
- Users update by downloading new release from GitHub Releases page manually

**Draft release retained:**
- `releaseDraft: true` kept in all three jobs — human publishes after verifying artifacts are correct

## Deviations from Plan

### Checkpoint-Driven Scope Change

**[Checkpoint:decision] Simplified from signed+notarized to unsigned builds**
- **Found during:** Task 2 checkpoint (human verification)
- **Issue:** User requested removal of all code signing and auto-updater from the workflow
- **Fix:** Removed APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY, APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID, CERT_THUMBPRINT, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD from all job env sections; kept only GITHUB_TOKEN
- **Files modified:** .github/workflows/release.yml
- **Committed in:** 4e8b6f9

---

**Total deviations:** 1 checkpoint-driven scope reduction (signing + updater removed per user decision)
**Impact on plan:** Original plan's `must_haves.truths` (signed macOS .dmg, EV-signed Windows .exe, latest.json for updater) were explicitly superseded by user decision. Core CI pipeline structure (three parallel jobs, draft release, ubuntu-22.04 pin, universal macOS binary) all delivered as planned.

## Issues Encountered

None beyond the checkpoint decision — plan executed cleanly once scope was clarified.

## User Setup Required

To trigger a release:

1. Push a version tag: `git tag v1.0.0 && git push origin v1.0.0`
2. GitHub Actions runs three parallel jobs
3. Draft release appears in GitHub Releases with macOS `.dmg`, Windows `.exe` (NSIS), and Linux `.AppImage`
4. Review artifacts, then manually publish the draft release

**macOS unsigned warning:** Users on macOS will see a Gatekeeper quarantine warning. Workaround: right-click the `.app` inside the `.dmg` and choose Open, or run `xattr -dr com.apple.quarantine /Applications/YourApp.app`.

**Windows SmartScreen warning:** First-run SmartScreen warning expected. Users click "More info" > "Run anyway".

## Next Phase Readiness

Phase 4 is complete. All v1 requirements are implemented:

- Engine (Phase 1): sidecar binaries, download pipeline, progress events
- Core UX (Phase 2): search, audio preview, download queue
- Power Features (Phase 3): playlists, filename templates, metadata editor, history
- Distribution (Phase 4): signing config scaffolding (04-01), CI release pipeline (04-02)

**If signing is added later:** Re-add the env var blocks to each job from the original plan spec and fill in GitHub Secrets. The `tauri.conf.json` signing placeholders from 04-01 are already in place.

---
*Phase: 04-distribution*
*Completed: 2026-03-22*
