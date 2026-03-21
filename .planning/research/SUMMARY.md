# Project Research Summary

**Project:** YouTube Music Downloader (yt-dlp + Tauri v2)
**Domain:** Cross-platform desktop audio downloader with in-app search and preview
**Researched:** 2026-03-21
**Confidence:** MEDIUM — all four research files are training-data based (web tools unavailable); core architectural patterns are well-established, but specific API behaviors and version details should be verified before implementation begins.

---

## Executive Summary

This is a cross-platform desktop app in a gap-filled market: every existing tool is either CLI-only, URL-paste-only, or bloated. The core value proposition — search YouTube, preview audio, queue tracks, download as MP3, all in one Y2K-aesthetic window — has no direct GUI competitor. The right architecture is a Tauri v2 app with Rust backend orchestrating yt-dlp and ffmpeg as bundled sidecar binaries. All subprocess management, file I/O, and download state must live in Rust; the React frontend communicates exclusively via Tauri's IPC (`invoke`/`emit`). This is non-negotiable: Node.js `child_process` is unavailable in Tauri's WebView context, and any attempt to call yt-dlp from the JS side will fail silently.

The single most important early decision is establishing the download engine foundation before writing any UI. Four Phase 1 requirements — sidecar binary naming, ffmpeg path resolution, yt-dlp output parsing contract, and an in-app yt-dlp update mechanism — must be solved as infrastructure before any feature work begins. The research is unambiguous: all four are Phase 1 requirements, not polish. Skipping any of them produces apps that work on the developer's machine and break on users' machines, with no recovery path except a patch release.

The two key technical risks are audio preview delivery and YouTube bot detection. For audio preview, the straightforward approach (point an `<audio>` element at a yt-dlp stream URL) will fail due to CORS in Tauri's WebView — this must be solved with either a local HTTP proxy server or a temp-file download approach before the preview feature ships. For bot detection, the download queue must include per-request delays (minimum 2 seconds between sequential downloads) and expose optional browser-cookie passthrough; without these, batch downloads of 5+ tracks will trigger YouTube 429 rate limits reliably.

---

## Resolved Tensions

The following conflicts appeared across research files and are resolved here. These resolutions should be treated as decisions for roadmap purposes.

### Tension 1: yt-dlp Search vs YouTube Data API v3

**The conflict:** STACK.md recommends yt-dlp `ytsearch:` (no API key, simpler UX). FEATURES.md notes API v3 gives richer metadata. PITFALLS.md (Pitfall 8) says yt-dlp search triggers bot detection faster than downloads and is 2–5x slower with worse results.

**Resolution: Dual-mode search with API v3 as primary.**

- Default: YouTube Data API v3 with a user-provided key. The free quota (10,000 units/day = 100 searches/day) is adequate for a personal tool. Better result quality, faster response (~200ms vs 2–5s), and less bot-detection exposure justify the setup friction.
- Fallback: yt-dlp `ytsearch5:` (capped at 5, not 10, to reduce request volume) when no API key is configured, with a persistent warning in the UI: "Search is slower and less reliable without an API key."
- The API key must be stored in Tauri's secure store (never in JS bundle or committed config). The UI must include a Settings panel to enter and save it.
- This resolves the friction concern: the app still works out of the box via yt-dlp fallback, but the happy path is API v3.

**Impact on roadmap:** Search implementation in Phase 2 must build both paths from the start, not add the API path later as a "nice to have."

---

### Tension 2: Audio Preview Delivery

**The conflict:** ARCHITECTURE.md (Pattern 5 and Anti-Pattern 5) says to use `<audio>` element with the URL from `yt-dlp --get-url`, noting that `<audio>` bypasses CORS unlike `fetch()`. PITFALLS.md (Pitfall 6) says direct YouTube CDN URLs fail in Tauri's WebView due to CORS even for `<audio>`, and that range requests (needed for seeking) are unreliable via pipe.

**Resolution: Temp-file download approach for Phase 2; local HTTP proxy as Phase 3 upgrade.**

The PITFALLS finding is more authoritative here — PITFALLS explicitly names this as a "will silently fail in packaged Tauri app (not tauri dev)" case. The Architecture document's CORS caveat about `<audio>` applies in a standard browser but Tauri's WebView implementations (WKWebView, WebView2, WebKitGTK) have additional restrictions on cross-origin media URLs.

- Phase 2: Download the first 60 seconds of audio to a temp file (`.tmp` file in the OS temp directory), then play via a Tauri-registered `asset://` protocol or a local file URL. Delete on track change. This is simpler, reliable, and works on all platforms.
- Phase 3 (optional upgrade): Replace with a local `axum` HTTP server on `127.0.0.1` that proxies YouTube CDN chunks. This enables seeking and instant playback but adds complexity. Only implement if users report temp-file preview latency is unacceptable.
- The `yt-dlp --get-url` command is still used — but to get the URL for the yt-dlp download invocation, not for direct WebView playback.

**Impact on roadmap:** Preview in Phase 2 requires a temp-file infrastructure piece that must be verified in the packaged app (not `tauri dev`) before shipping.

---

### Tension 3: Phase 1 Scope — What's Actually Required Before Features?

**The conflict:** FEATURES.md treats keyword search, audio preview, and the cart-style queue as P1 MVP items. PITFALLS.md identifies four infrastructure items that must be solved in Phase 1: sidecar binary naming, ffmpeg path resolution, yt-dlp update mechanism, and output parsing contract. These cannot be deferred without causing production failures.

**Resolution: Split into Foundation (Phase 1) and Core Features (Phase 2).**

Phase 1 is the download engine, not a user-facing feature set. It delivers one visible thing — a working single-URL download with progress — but the real work is invisible infrastructure. Phase 2 is where the core UX value (search, preview, queue) is built, on top of a proven engine.

This means Phase 1 is heavier and slower than it looks on a feature list, but Phase 2 can move fast because the hard problems are already solved.

**Concrete Phase 1 scope:** Sidecar setup for all platforms, ffmpeg bundling + path passthrough, yt-dlp output parsing with `--progress-template`, update mechanism (in-app "check for yt-dlp update" button), basic single-URL download to MP3 with per-item progress, save-folder dialog, title cleanup pipeline, error messaging for common failures, and cleanup-on-quit. This is a full phase of work.

**Concrete Phase 2 scope:** YouTube search (dual-mode), audio preview (temp-file approach), cart-style download queue with bounded concurrency (semaphore, 2 max), rate-limit handling (delays + 429 backoff).

---

## Key Findings

### Recommended Stack

The stack is anchored by Tauri v2 (fixed constraint per PROJECT.md) with a React 19 + TypeScript + Vite 6 frontend. Tauri v2's plugin system (`tauri-plugin-shell`, `tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-store`) covers all required surface area without additional dependencies. State management uses Zustand 5 (lightweight, no boilerplate) for download queue and UI state, with TanStack Query 5 for async search results. Tailwind CSS 4 handles the Y2K retro aesthetic.

For the Rust backend: `tokio` for async process management, `tauri-plugin-shell` for sidecar invocation, `serde`/`serde_json` for IPC serialization, and a `tokio::sync::Semaphore` for bounded download concurrency. No database is needed in Phase 1 — `tauri-plugin-store` handles flat config persistence. Phase 2+ may introduce `tauri-plugin-sql` (SQLite) for download history if needed.

**Core technologies:**
- Tauri v2 + Rust 1.78+: app shell, IPC bridge, all subprocess management — the only correct layer for yt-dlp invocation
- React 19 + TypeScript 5 + Vite 6: frontend — best ecosystem fit for Tauri; all official Tauri examples use this combination
- yt-dlp (bundled sidecar): download engine — bundled to guarantee version pinning and zero-setup UX
- ffmpeg (bundled sidecar): audio transcoding — bundled because macOS `.app` bundles don't inherit shell PATH; invoked by yt-dlp via `--ffmpeg-location`, not called directly from Rust
- Zustand 5: download queue state — lightweight, works naturally with React hooks, no Redux boilerplate
- TanStack Query 5: search result caching and async state — handles the 2–5s yt-dlp search latency with loading/error states

**Version compatibility notes:**
- `tauri` 2.x and all `tauri-plugin-*` crates must be the same major version. v1 plugins will not load in a v2 app.
- Tailwind CSS 4 changed its configuration format significantly (no `tailwind.config.js`). If the project was scaffolded with Tailwind v3 docs, verify the v4 CSS-based config before writing styles.
- TanStack Query 5 dropped React 16/17 support — confirmed compatible with React 19.

See `.planning/research/STACK.md` for full version table, installation commands, and alternatives considered.

---

### Expected Features

The market gap is real: search + preview + clean metadata + distinctive UI in a single GUI tool. No current competitor delivers all four.

**Must have for v1 launch (P1):**
- Single-URL download to MP3 with progress bar — validates the engine works; every competitor has this
- Keyword search with results list (thumbnail, title, channel, duration) — the primary differentiator
- Audio preview (30–60 seconds) — lets users confirm they have the right track
- Cart-style queue with "Download All" — the second primary differentiator
- Title auto-cleanup (strip `[Official MV]`, `(Lyrics)`, `(Audio)`, etc.) — core value, reduces library clutter
- Basic ID3 tag write (title, artist, year) via yt-dlp `--embed-metadata` — table stakes for music library integration
- Save-folder dialog with persisted last path — basic file hygiene
- Error messages for common failures (429, 403, unavailable, no ffmpeg) — silent failures are worse than ugly errors

**Should have for v1.x (P2, add after v1 validation):**
- "Show in Finder/Explorer" on completed download — single most-requested QoL feature in downloader tools
- System notification on completion — pairs with "Show in Finder"
- Metadata editor before save (editable title/artist/album fields) — YouTube channel name ≠ artist name; users will notice
- Playlist URL → selective download checklist — power-user feature; yt-dlp `--playlist-items` handles the backend
- Custom filename template with live preview (`{artist} - {title}`)
- Download history and dedup — "have I already downloaded this?" prevents re-download clutter

**Defer to v2+ (P3):**
- Concurrency setting (expose 1–4 parallel downloads to user) — serial queue with 2-max is safer for v1
- MusicBrainz tag enrichment — separate dependency, complex matching logic
- Configurable title cleanup rules (user-defined regex)
- Cookie/private playlist support via `--cookies-from-browser` UI

**Anti-features to explicitly avoid:**
- Concurrent batch downloads > 3 parallel — YouTube rate-limits aggressively; surface this as a feature, not a limitation
- Full video playback preview — scope creep; this is an audio tool
- Spotify / Apple Music integration — separate product domain

See `.planning/research/FEATURES.md` for competitor comparison table, UX pattern analysis, and full prioritization matrix.

---

### Architecture Approach

The architecture is a clean two-layer system: React frontend communicates with a Rust backend exclusively via Tauri IPC (`invoke` for request-response, `emit`/`listen` for async progress events). All yt-dlp and ffmpeg subprocess management lives in Rust. The frontend never calls system processes.

The Rust backend is organized into three concerns: (1) command handlers — thin IPC entry points that receive frontend requests and delegate; (2) queue manager — `tokio::sync::Semaphore`-bounded concurrency, per-job `CancellationToken`, `HashMap<JobId, Child>` for process tracking; (3) yt-dlp/ffmpeg helpers — binary path resolution, argument list construction, stdout parsing. All mutable state shared across commands lives in an `Arc<Mutex<AppState>>` registered with Tauri's state management.

**Major components:**
1. Rust Command Handlers (`commands/` module): `search_youtube`, `start_download`, `cancel_download`, `get_stream_url`, `set_save_directory`, `open_file_location` — registered in `main.rs` via `invoke_handler`
2. Download Queue Manager (`queue/` module): Semaphore-bounded concurrency (2 permits default), per-job cancellation via `tokio_util::sync::CancellationToken`, stdout parser that emits `download:progress` events per job ID
3. yt-dlp/ffmpeg Sidecar Layer (`ytdlp/` module): binary path resolution (sidecar-first, system PATH fallback), argument construction, `--progress-template` parser, version check on startup
4. Frontend State (Zustand): `searchStore`, `queueStore`, `playerStore`, `settingsStore` — one slice per domain; `settingsStore` persisted to `tauri-plugin-store`
5. Binary Discovery: at app startup, resolve both sidecar paths and verify both work (`yt-dlp --version`, `ffmpeg -version`); show setup guide if missing; emit `setup:missing_binaries` event to frontend

**Key data flows:**
- Download: `invoke("start_download")` → returns job ID immediately → progress via `emit("download:progress", { job_id, percent, speed, eta })` events → `emit("download:complete", { job_id, file_path })` on finish
- Search: `invoke("search_youtube", { query })` → single response with `Vec<SearchResult>` after 1–5s (no streaming events needed)
- Preview: `invoke("get_stream_url")` not used for direct playback — see resolved tension above; preview uses temp-file download instead

See `.planning/research/ARCHITECTURE.md` for full system diagram, Rust code patterns, anti-patterns, and capability configuration.

---

### Critical Pitfalls

Ten pitfalls identified across severity levels. The top five that directly affect the roadmap:

1. **Tauri sidecar binary naming** (Severity: HIGH, Phase 1) — Binaries in `src-tauri/binaries/` must be named with exact Rust target triple (`yt-dlp-aarch64-apple-darwin`, etc.). Wrong name = silent "file not found" at runtime. Mitigation: write a `build.rs` or pre-build script that downloads and renames binaries automatically; add CI matrix covering all three platforms.

2. **ffmpeg path not inherited by macOS app bundle** (Severity: HIGH, Phase 1) — macOS `.app` bundles spawn child processes without the user's shell PATH. ffmpeg at `/opt/homebrew/bin` is invisible. Mitigation: bundle ffmpeg as a second sidecar; pass `--ffmpeg-location <resolved_path>` to every yt-dlp invocation via the sidecar resolution API. Never assume ffmpeg is on PATH.

3. **Audio preview CORS failure in Tauri WebView** (Severity: HIGH, Phase 2) — Direct YouTube CDN URLs do not work in Tauri's WebView even with `<audio>` element. Will appear to work in `cargo tauri dev` (uses system browser) but fail silently in the packaged app. Mitigation: temp-file download approach (download 60s to tmp, play via local asset protocol). Must be verified in a packaged build, not in dev mode.

4. **No yt-dlp update mechanism = app breaks when YouTube changes** (Severity: HIGH, Phase 1) — yt-dlp's extractors break when YouTube changes its internal API (has happened multiple times per year since 2021). A bundled-only binary with no update path means users are stuck until a full app release. Mitigation: build the in-app yt-dlp update button in Phase 1 (download latest release binary from GitHub to app data dir, overriding the bundled one); show version age warning in Settings.

5. **YouTube bot detection + rate limiting in download queue** (Severity: HIGH, Phase 1+Phase 2) — Rapid sequential yt-dlp calls trigger HTTP 429. Parallel downloads make this worse. Mitigation: minimum 2-second delay between downloads in the queue; `tokio::sync::Semaphore` with max 2 permits; exponential backoff on 429 (30s, 60s, 120s); surface 429 state to user with retry button, not silent failure. Optional "Use browser cookies" setting via `--cookies-from-browser` for users who hit auth issues.

Additional pitfalls to address by phase: macOS notarization of sidecar binaries (Phase 4), Windows SmartScreen/EV code signing (Phase 4), yt-dlp output parsing contract via `--progress-template` not text parsing (Phase 1), download queue race conditions and process tracking (Phase 2).

See `.planning/research/PITFALLS.md` for severity ratings, warning signs, recovery strategies, and a "looks done but isn't" checklist.

---

## Implications for Roadmap

### Phase 1: Download Engine Foundation

**Rationale:** Four infrastructure requirements must be solved before any UI feature work. All four are Phase 1 per PITFALLS.md and cannot be deferred. This phase delivers one visible feature (single-URL download) but its real product is a proven engine that Phase 2 can build on safely.

**Delivers:**
- Working single-URL MP3 download on macOS, Windows, and Linux
- Sidecar binary setup for yt-dlp + ffmpeg on all three platforms, with CI matrix
- Binary naming script (automated, not manual)
- ffmpeg path resolution via `--ffmpeg-location` on every yt-dlp invocation
- yt-dlp stdout parser using `--progress-template` (machine-readable, not text parsing)
- In-app yt-dlp version check and update button (download from GitHub releases)
- Per-download progress events (Rust → frontend via `emit`)
- Save-folder dialog (Tauri `dialog::open`) with persisted last path
- Title auto-cleanup pipeline (regex strip of YouTube title noise)
- Error messaging for known yt-dlp failures (429, 403, unavailable, no ffmpeg)
- Graceful cleanup on app quit (kill child processes, delete temp files)
- Basic Y2K UI shell (app window, layout, color palette, typography)

**Pitfalls addressed:** Sidecar naming (P4), ffmpeg path (P3), yt-dlp update mechanism (P1), output parsing contract (P10), bot detection basics (P2)

**Research flag:** NEEDS SPIKE — sidecar resolution and ffmpeg path must be verified on a clean machine (not developer environment) on each platform before Phase 1 is marked done.

---

### Phase 2: Core UX — Search, Preview, Queue

**Rationale:** With a proven download engine, the core value proposition can be built. All three pillars (search, preview, queue) belong in the same phase because they are interdependent: search produces candidates, preview validates them, queue collects them for download. Splitting them would deliver partial value at each milestone.

**Delivers:**
- YouTube search: dual-mode (YouTube Data API v3 primary, yt-dlp `ytsearch5:` fallback)
- Settings panel: API key entry (stored in Tauri secure store, never in JS), API key validation
- Search results UI: thumbnail, title, channel, duration, view count
- Audio preview: temp-file download approach (60s max), playback via local asset protocol, auto-cleanup on track change
- Cart-style download queue: add from search results, queue panel, "Download All" button
- Per-item queue state: Pending → Downloading (with %) → Converting (spinner) → Done / Error
- Bounded concurrency: Semaphore(2), 2s minimum delay between downloads, 429 exponential backoff
- Process tracking: `HashMap<JobId, Child>` in Rust, cancel button kills process and cleans temp dir

**Pitfalls addressed:** Audio preview CORS (P6), YouTube search reliability (P8), download queue race conditions (P7), rate limiting in queue mode (P2)

**Research flag:** NEEDS VERIFICATION in packaged app — audio preview must be tested in a built `.app`/`.exe`, not in `cargo tauri dev`. This is explicitly called out as a "looks done but isn't" case.

---

### Phase 3: Polish and Power Features

**Rationale:** After Phase 2 validates the core loop, user feedback will surface the most-wanted additions. This phase addresses the high-value P2 features that require the Phase 2 engine to be in place first.

**Delivers:**
- Metadata editor before save (editable title, artist, album fields per queue item)
- Playlist URL support: fetch playlist metadata, show checklist UI, download selected tracks via `--playlist-items`
- Custom filename template with live preview
- Download history and dedup (check video ID against JSON log before queuing)
- "Show in Finder/Explorer" on completed download (Tauri shell plugin `open` command)
- System notification on completion (Tauri notification plugin)
- Thumbnail embedding in MP3 (`yt-dlp --embed-thumbnail`)
- Optional browser cookie passthrough (`--cookies-from-browser chrome`) as Settings toggle

**Pitfalls addressed:** Playlist URL accidentally triggering bulk download (must show selection UI first), metadata field incorrectness (channel name ≠ artist name)

**Research flag:** STANDARD PATTERNS — these features are well-documented yt-dlp flags and Tauri plugin calls. No additional research phase needed unless playlist metadata fetch latency is a concern (100+ track playlists need skeleton UI / async loading).

---

### Phase 4: Distribution and Packaging

**Rationale:** Platform-specific signing and notarization requirements are real blockers for public distribution. Cannot be retrofitted cheaply — the signing pipeline must be designed early but the final notarization/signing execution belongs here.

**Delivers:**
- macOS: code signing + notarization for app bundle and sidecar binaries; tested on clean macOS VM with SIP enabled
- Windows: code signing certificate integration (EV cert recommended; document SmartScreen workaround if using OV cert); VirusTotal scan pre-release; documented AV false positive for yt-dlp sidecar
- Linux: AppImage or `.deb` package via Tauri bundler
- CI/CD build matrix: macOS ARM + Intel, Windows x64, Linux x64
- Auto-updater for the app itself (Tauri's built-in updater plugin)
- Release notes and installer documentation

**Pitfalls addressed:** macOS Gatekeeper blocking sidecar (P5), Windows SmartScreen/AV false positives (P9)

**Research flag:** NEEDS RESEARCH when planning — macOS notarization pipeline for sidecar binaries is not standard Tauri behavior and may require custom build scripts. EV certificate acquisition has a 1–2 week lead time; plan ahead.

---

### Phase Ordering Rationale

- Phase 1 must precede Phase 2 because all search and preview features depend on a working sidecar layer. Building search UI before sidecar resolution works cross-platform creates a false confidence problem.
- Phase 2 (search + preview + queue) are grouped together because they form an inseparable user workflow. Shipping search without preview, or queue without search, delivers a product that feels half-built.
- Phase 3 power features require Phase 2's queue to be in place. Metadata editing before save requires knowing the queue abstraction. Playlist selective download is a superset of the queue feature.
- Phase 4 is last because signing/notarization is a distribution concern, not a feature concern. However, the signing infrastructure (Apple Developer account, Windows code signing cert) should be set up during Phase 1 planning to avoid blocking distribution later.

---

### Research Flags Summary

**Needs deeper research / spike before planning:**
- Phase 1: sidecar binary resolution across all platforms — verify against current Tauri v2 docs; the `tauri::api::process` module was reorganized from v1 and ARCHITECTURE.md used some v1 API patterns that need v2 verification
- Phase 4: macOS notarization of sidecar binaries — this is non-standard and community workarounds may have changed

**Needs verification in packaged build (not dev mode):**
- Phase 2: audio preview delivery — must test in `.app`/`.exe` on a clean machine; the packaged behavior differs from `cargo tauri dev`
- Phase 2: YouTube search via yt-dlp fallback — test rate limiting behavior with rapid sequential searches

**Standard patterns (skip research, implement directly):**
- Phase 1: Tokio async process spawning, `Arc<Mutex<AppState>>` state management, Tauri event emit/listen pattern — all well-documented
- Phase 3: yt-dlp flags for playlist, thumbnail embedding, metadata — stable and well-documented in yt-dlp README
- Phase 3: "Show in Finder" via Tauri shell plugin — trivial platform call

---

## Open Questions

These need resolution before or during planning. They are not blocked by research gaps but by product and environment decisions.

1. **Does the user need to provide a YouTube Data API v3 key, or does the app ship with one?** If shipping a shared key, quota will exhaust quickly in aggregate. Recommendation: require user-provided key; no-key yt-dlp fallback is available. Resolve in Phase 1 planning.

2. **What is the target distribution channel?** If macOS App Store, the sidecar approach may be incompatible (App Store sandboxing restrictions). Direct download `.dmg` is simpler. This affects Phase 4 scope significantly. Resolve before Phase 4 planning.

3. **What is the minimum macOS version?** WKWebView capabilities (which affect audio preview codec support) differ across macOS versions. macOS 12+ is required for reliable WebView2-equivalent behavior. Resolve in Phase 1.

4. **What Tailwind version is being used — v3 or v4?** STACK.md calls out that v4 changed configuration format significantly. The scaffolded project may default to v3. Verify at project initialization.

5. **Is Linux a first-class target or best-effort?** WebKitGTK (Tauri's Linux WebView) has different codec support than WKWebView (macOS) and WebView2 (Windows). Audio preview codec choice (m4a/AAC preferred) matters for cross-platform reliability. If Linux is best-effort, document the gap; if first-class, add to Phase 2 verification matrix.

6. **What is the yt-dlp update UX?** The in-app update mechanism (Phase 1 requirement) needs a decision: should it download automatically on launch if the bundled version is >30 days old, or only when the user clicks "Update"? Automatic updates are simpler for users but require network permission on first launch. Decide before Phase 1 implementation.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Tauri v2 plugin names and patterns are well-established in training data (stable since Oct 2024). Version pins (React 19, Vite 6, Tailwind 4) should be verified at project initialization. Tailwind v4 config format change is a known risk. |
| Features | MEDIUM | yt-dlp capabilities are HIGH confidence (stable, well-documented CLI). Competitor feature sets are MEDIUM (Parabolic, spotdl release frequently). YouTube Data API v3 quota limits are MEDIUM (verify current free tier before committing to the dual-mode search approach). |
| Architecture | MEDIUM | The Tauri IPC pattern (invoke/emit), Arc<Mutex<AppState>>, and Semaphore-bounded queue are HIGH confidence — these are standard Rust/Tauri patterns unchanged across versions. The sidecar API changed between Tauri v1 and v2; ARCHITECTURE.md includes some v1 syntax (`tauri::api::process::Command`) that must be verified against v2 docs. |
| Pitfalls | MEDIUM | macOS notarization requirements are HIGH confidence (Apple Developer docs are stable). YouTube bot detection specifics (PO token, 429 behavior) are MEDIUM — this area evolves rapidly; re-verify against current yt-dlp GitHub issues before Phase 1. Audio preview CORS behavior in Tauri WebView is MEDIUM — the finding is consistent across multiple community reports but should be validated early in Phase 2. |

**Overall confidence: MEDIUM**

The research provides sufficient signal to make all major decisions and sequence the phases correctly. No area is LOW confidence. The gaps are specific (API behavior, version details) and can be closed cheaply with targeted verification at phase boundaries.

---

### Gaps to Address

- **yt-dlp v2 sidecar API syntax**: ARCHITECTURE.md uses `tauri::api::process::Command::new_sidecar()` which is Tauri v1 syntax. The v2 equivalent via `tauri-plugin-shell` has a different call pattern. Verify the correct v2 invocation before Phase 1 implementation begins. This is a known change, not a speculation.

- **Audio preview CORS in packaged Tauri app**: Resolved conceptually (use temp file), but the exact behavior of `asset://` protocol vs local file path vs Tauri custom protocol for audio playback needs to be validated with a 2-hour spike at the start of Phase 2. Do not proceed to full preview implementation without this validated.

- **YouTube Data API v3 current quota and rate limits**: Research used training data through Aug 2025. Quota structure (10,000 units/day, 100 units per search) should be re-verified against the current Google Cloud Console documentation before committing to the dual-mode search design.

- **yt-dlp bot detection current state (PO tokens)**: The specifics of YouTube's proof-of-work token requirement (noted in PITFALLS.md as "from late 2023 onward") evolve rapidly. Before Phase 1, check the current yt-dlp GitHub issues for the latest bot detection mitigations yt-dlp applies by default and whether additional flags are needed.

- **macOS notarization of sidecar binaries**: The standard Tauri notarization flow notarizes the app bundle but it is unclear if yt-dlp and ffmpeg sidecars are automatically included in the entitlement scope. Research the current Tauri v2 signing guide and community issues on sidecar notarization before Phase 4 planning.

---

## Sources

### Primary (HIGH confidence)
- yt-dlp README and CLI documentation — `--progress-template`, `--dump-json`, `--flat-playlist`, `--ffmpeg-location`, `--embed-metadata`, `--get-url`, `ytsearch:` prefix, progress line format
- Tokio documentation — `tokio::sync::Semaphore`, `tokio::process::Command`, `tokio_util::sync::CancellationToken` patterns
- Apple Developer documentation — macOS Gatekeeper notarization requirements, hardened runtime entitlements

### Secondary (MEDIUM confidence)
- Tauri v2 documentation (training data, Oct 2024 stable release) — plugin system, capability configuration, sidecar pattern, state management, IPC patterns
- YouTube Data API v3 documentation (training data) — quota structure, search endpoint, result schema
- Tauri community patterns for progress reporting, sidecar binary resolution (training data through Aug 2025)
- YouTube stream URL expiry and CORS behavior (multiple community reports, consistent pattern)

### Tertiary (LOW confidence — validate before relying on)
- yt-dlp bot detection specifics (PO token requirement, 2023–2025) — evolves rapidly, re-verify against current GitHub issues
- Competitor feature sets (Parabolic, spotdl, Tartube current versions) — release frequently, training data may be stale
- Tailwind CSS v4 configuration format — verify at project initialization; v3/v4 split may affect scaffolded project

---

*Research completed: 2026-03-21*
*Ready for roadmap: yes*
