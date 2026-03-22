# Roadmap: YouTube Music Downloader

## Overview

Four phases, each delivering a coherent vertical slice. Phase 1 builds the engine that everything else runs on — no UI feature work until sidecar binaries resolve correctly on all platforms. Phase 2 builds the core user loop: search, preview, queue. Phase 3 adds power-user features on top of the proven queue abstraction. Phase 4 makes the app distributable on all three platforms with code signing, notarization, and an auto-updater.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Download Engine** - Sidecar infrastructure + single-URL MP3 download working cross-platform (completed 2026-03-21)
- [x] **Phase 2: Core UX** - Search, audio preview, cart-style queue — the full core loop (gap closure in progress) (completed 2026-03-21)
- [x] **Phase 3: Power Features** - Playlist support, filename templates, metadata editing, history (completed 2026-03-21)
- [ ] **Phase 4: Distribution** - Code signing, notarization, CI/CD build matrix, auto-updater

## Phase Details

### Phase 1: Download Engine
**Goal**: A user can paste a YouTube URL, pick a save folder, and receive a correctly tagged, cleaned-up MP3 — on macOS, Windows, and Linux — with real-time progress feedback.
**Depends on**: Nothing (first phase)
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06, ENG-07, ENG-08, ENG-09, UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. User pastes a YouTube URL, clicks Download, and a correctly named MP3 appears in the chosen folder on macOS, Windows, and Linux.
  2. A progress bar updates in real time during download and conversion — it never freezes or shows stale data.
  3. The saved MP3 has clean title (no `[Official MV]`, `(Lyrics)` etc.) and basic ID3 tags (title, artist, year).
  4. The app shows a specific, human-readable error message for each common failure: rate limit (429), geo-blocked (403), video unavailable, and missing ffmpeg.
  5. An in-app "Check for yt-dlp update" button fetches the latest version from GitHub and replaces the bundled binary without requiring an app reinstall.

**Risks:**
- SPIKE REQUIRED: Sidecar binary naming (Tauri v2 target triple format) must be verified on a clean machine per platform before Phase 1 is done. Wrong name = silent failure in production.
- SPIKE REQUIRED: ffmpeg is invisible to macOS `.app` bundles (no shell PATH). Must pass `--ffmpeg-location` to every yt-dlp invocation via resolved sidecar path.
- Verify current yt-dlp bot detection mitigations (PO token state) against GitHub issues before implementation.
- Decision needed: yt-dlp update UX — auto-check on launch vs. user-triggered only.

**Plans**: 3 plans

Plans:
- [x] 01-01: Tauri v2 project scaffold + sidecar setup (yt-dlp + ffmpeg binary naming, platform matrix, build script, capability config)
- [x] 01-02: Download engine (single-URL MP3 download, ffmpeg path resolution, `--progress-template` stdout parser, IPC progress events, save-folder dialog, yt-dlp update mechanism, error handling, cleanup-on-quit)
- [x] 01-03: Y2K UI shell + title cleanup (app window, color palette, typography, retro layout, title cleanup pipeline, basic ID3 tag embed, ENG-05/ENG-06 wired to UI)

---

### Phase 2: Core UX
**Goal**: A user can search YouTube by keyword, preview a track in-app, add tracks to a queue, and download all of them as MP3s with per-item progress and rate-limit protection.
**Depends on**: Phase 1
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, PREV-01, PREV-02, PREV-03, QUEUE-01, QUEUE-02, QUEUE-03, QUEUE-04, QUEUE-05, QUEUE-06
**Success Criteria** (what must be TRUE):
  1. User types a keyword, sees a result list with thumbnail, title, channel, and duration within a few seconds.
  2. User clicks a result and hears up to 60 seconds of audio playing inside the app, with play/pause and a progress indicator.
  3. User adds multiple tracks to the queue, clicks "Download All," and each item shows its own progress through Pending → Downloading % → Converting → Done.
  4. The app never fires more than 2 concurrent downloads, enforces a 2-second delay between requests, and shows a retry button (not a crash) when YouTube returns a 429.
  5. User can cancel an individual queued download at any point and the partial file is cleaned up.

**Risks:**
- PACKAGED BUILD REQUIRED: Audio preview via `asset://` or local file protocol must be tested in a built `.app`/`.exe` — it behaves differently from `cargo tauri dev` and will silently fail if only tested in dev mode.
- Search fallback (yt-dlp `ytsearch5:`) must be tested for rate-limit behavior with rapid sequential searches.
- Dual-mode search must be built from the start — API v3 primary, yt-dlp fallback — not added later.
- Decision needed before implementation: confirm YouTube Data API v3 current quota (10,000 units/day) against Google Cloud Console.

**Plans**: 3 plans

Plans:
- [x] 02-01: Search + settings panel (dual-mode search, API key secure storage, result list UI with thumbnail/title/channel/duration, URL direct-load, yt-dlp fallback warning)
- [x] 02-02: Audio preview + download queue (temp-file preview pipeline, play/pause/progress controls, cart-style queue UI, bounded concurrency semaphore, per-item state machine, 429 backoff + retry, cancel with cleanup)
- [x] 02-03: Gap closure — exponential backoff on 429 (30s/60s/120s retry loop in queue.rs, RetryWait event, countdown UI in QueueItem)

---

### Phase 3: Power Features
**Goal**: A user can load a full playlist and select tracks to download, define a custom filename pattern, edit track metadata before saving, and see their download history with dedup protection.
**Depends on**: Phase 2
**Requirements**: PLAY-01, PLAY-02, PLAY-03, TITLE-01, TITLE-02, META-01, META-02, HIST-01, QOL-01, QOL-02
**Success Criteria** (what must be TRUE):
  1. User pastes a playlist URL, sees the full track list with checkboxes, selects a subset, and only the selected tracks are downloaded.
  2. User sets a filename pattern like `{artist} - {title}` and sees a live preview update before downloading.
  3. App correctly handles playlists with 50+ tracks without freezing (async metadata fetch with loading skeleton).
  4. User can edit title, artist, album on pending queue items before downloading.
  5. Downloaded MP3s have embedded thumbnails by default (toggleable in Settings).
  6. HISTORY tab shows previously downloaded tracks; search results show DOWNLOADED badge for already-downloaded items.
  7. Completed downloads trigger a system notification and show a "Show in Finder" button.

**Risks:**
- Playlist metadata fetch for 100+ track playlists can be slow — skeleton loading UI required, not a blocking wait.
- `--parse-metadata` literal override syntax requires special character escaping — test with edge-case titles.

**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Playlist support (streaming track fetch via yt-dlp --flat-playlist, checkbox UI, select/deselect all, add selected to queue)
- [x] 03-02-PLAN.md — Filename templates + thumbnail embed (custom pattern in Settings with live preview, --embed-thumbnail toggle, queue_download pipeline extension)
- [x] 03-03-PLAN.md — Metadata editor + History + QoL (inline metadata editor on queue items, HISTORY tab with dedup badges, notification + opener plugins, Show in Finder button)

---

### Phase 4: Distribution
**Goal**: The app can be downloaded and run by any user on macOS (ARM + Intel), Windows (x64), and Linux (x64) without Gatekeeper, SmartScreen, or AV warnings. A CI/CD pipeline produces signed artifacts automatically, and users receive app updates in-app.
**Depends on**: Phase 3
**Requirements**: (No dedicated distribution requirements in REQUIREMENTS.md — this phase satisfies the cross-platform promise of UI-03 and enables delivery of all v1 requirements to end users)
**Success Criteria** (what must be TRUE):
  1. A macOS user on a clean machine can open the downloaded `.dmg`, drag the app to Applications, and launch it without any Gatekeeper warning.
  2. A Windows user on a clean machine can run the installer without SmartScreen blocking it (or the workaround is documented and tested).
  3. A Linux user can install via AppImage or `.deb` and launch the app.
  4. A GitHub Actions CI matrix produces signed artifacts for all three platforms automatically on each release tag.
  5. An existing user receives an in-app prompt when a new app version is available and can update without visiting a website.

**Risks:**
- RESEARCH NEEDED before planning: macOS notarization of sidecar binaries (yt-dlp + ffmpeg) is non-standard Tauri behavior — may require custom build scripts. Verify against current Tauri v2 signing guide and community issues before starting this phase.
- EV code signing certificate for Windows has 1-2 week acquisition lead time — purchase/apply during Phase 3 to avoid blocking.
- macOS App Store distribution is explicitly out of scope (sidecar incompatible with App Store sandbox).
- VirusTotal pre-release scan for yt-dlp sidecar recommended — AV false positives are common and documented.

**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Signing config + updater plugin + CI sidecar script (tauri.conf.json signing/notarization config, Entitlements.plist, tauri-plugin-updater registration, CI sidecar download script for universal macOS, auto-update toast UI)
- [ ] 04-02-PLAN.md — GitHub Actions release workflow (three-job CI pipeline: macOS universal .dmg + notarize, Windows NSIS + EV sign, Linux AppImage; pre-release checklist checkpoint)

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Download Engine | 3/3 | Complete   | 2026-03-21 |
| 2. Core UX | 3/3 | Complete    | 2026-03-21 |
| 3. Power Features | 3/3 | Complete   | 2026-03-21 |
| 4. Distribution | 0/2 | Not started | - |

---

## Coverage

| Requirement | Phase | Notes |
|-------------|-------|-------|
| ENG-01 | Phase 1 | Single-URL download |
| ENG-02 | Phase 1 | Sidecar setup |
| ENG-03 | Phase 1 | IPC progress events |
| ENG-04 | Phase 1 | Save-folder dialog |
| ENG-05 | Phase 1 | Title cleanup pipeline |
| ENG-06 | Phase 1 | Basic ID3 tags |
| ENG-07 | Phase 1 | yt-dlp in-app update |
| ENG-08 | Phase 1 | Error messaging |
| ENG-09 | Phase 1 | Cleanup on quit |
| SRCH-01 | Phase 2 | Search results UI |
| SRCH-02 | Phase 2 | YouTube Data API v3 |
| SRCH-03 | Phase 2 | yt-dlp fallback |
| SRCH-04 | Phase 2 | URL direct-load |
| SRCH-05 | Phase 2 | API key secure storage |
| PREV-01 | Phase 2 | In-app audio preview |
| PREV-02 | Phase 2 | Temp-file approach |
| PREV-03 | Phase 2 | Play/pause/progress controls |
| QUEUE-01 | Phase 2 | Add to queue |
| QUEUE-02 | Phase 2 | Download All |
| QUEUE-03 | Phase 2 | Per-item state |
| QUEUE-04 | Phase 2 | Bounded concurrency |
| QUEUE-05 | Phase 2 | 429 backoff + retry (gap closure: 02-03) |
| QUEUE-06 | Phase 2 | Cancel per item |
| PLAY-01 | Phase 3 | Playlist track list (03-01) |
| PLAY-02 | Phase 3 | Selective download (03-01) |
| PLAY-03 | Phase 3 | Playlist download all (03-01) |
| TITLE-01 | Phase 3 | Custom filename pattern (03-02) |
| TITLE-02 | Phase 3 | Live pattern preview (03-02) |
| META-01 | Phase 3 | Metadata editor (03-03, promoted from v2) |
| META-02 | Phase 3 | Thumbnail embed (03-02, promoted from v2) |
| HIST-01 | Phase 3 | Download history + dedup (03-03, promoted from v2) |
| QOL-01 | Phase 3 | Show in Finder (03-03, promoted from v2) |
| QOL-02 | Phase 3 | System notification (03-03, promoted from v2) |
| UI-01 | Phase 1 | Y2K/retro UI established; applied throughout |
| UI-02 | Phase 1 | Palette + fonts established; applied throughout |
| UI-03 | Phase 4 | Cross-platform delivery |

**v1 coverage: 35/35 requirements mapped (5 promoted from v2). No orphans.**

---

*Roadmap created: 2026-03-21*
*Last updated: 2026-03-22 — Phase 4 plans finalized*
*Granularity: Coarse (4 phases, 11 plans total)*
