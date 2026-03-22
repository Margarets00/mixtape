---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 04-distribution-04-02-PLAN.md
last_updated: "2026-03-22T07:07:30.730Z"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 11
  completed_plans: 11
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** 유튜브 음악을 검색 → 미리듣기 → 골라담기 → 한 방에 MP3 저장 — 이 흐름이 끊기지 않아야 한다.
**Current focus:** Phase 04 — distribution

## Current Position

Phase: 04 (distribution) — EXECUTING
Plan: 2 of 2

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-download-engine P01 | 5 | 2 tasks | 22 files |
| Phase 01-download-engine P02 | 3min | 2 tasks | 5 files |
| Phase 01-download-engine P03 | 4min | 2 tasks | 12 files |
| Phase 01-download-engine P03 | 30min | 3 tasks | 16 files |
| Phase 02-core-ux P01 | 4min | 2 tasks | 13 files |
| Phase 02-core-ux P02 | 4min | 2 tasks | 7 files |
| Phase 02-core-ux P03 | 3min | 2 tasks | 5 files |
| Phase 03-power-features P01 | 2min | 2 tasks | 4 files |
| Phase 03-power-features P02 | 2min | 2 tasks | 3 files |
| Phase 03-power-features P03 | 5min | 3 tasks | 12 files |
| Phase 04-distribution P01 | 2min | 2 tasks | 9 files |
| Phase 04-distribution P02 | 30min | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Research]: Dual-mode search adopted — YouTube Data API v3 primary, yt-dlp `ytsearch5:` fallback. User must supply API key.
- [Research]: Audio preview uses temp-file approach (60s download to tmp, play via local asset protocol). Direct CDN URLs fail in packaged Tauri WebView.
- [Research]: ffmpeg bundled as sidecar; always pass `--ffmpeg-location` to yt-dlp — never assume PATH.
- [Phase 01-download-engine]: Universal macOS yt-dlp binary named with aarch64-apple-darwin triple works for both ARM and Intel macs
- [Phase 01-download-engine]: Tauri externalBin validation requires sidecar files to exist before cargo check; placeholder files needed during scaffolding
- [Phase 01-download-engine]: Folder persistence (ENG-04) is frontend-only via plugin-dialog + plugin-store; no Rust command needed
- [Phase 01-download-engine]: yt-dlp update uses temp-file (.new) + fs::rename for atomic replace; never overwrites running binary directly
- [Phase 01-download-engine]: Both stdout and stderr must be read from yt-dlp since progress moved to stderr (~2022 change)
- [Phase 01-download-engine]: StoreOptions in plugin-store 2.4.2 requires defaults field; used defaults:{} instead of autoSave:true
- [Phase 01-download-engine]: Two-step yt-dlp: --print title before download enables deterministic Done path without parsing yt-dlp output
- [Phase 01-download-engine]: locate_sidecar() uses current_exe().parent() — Tauri dev-mode resolution looks for binaries/yt-dlp-{triple} in target/debug/ which doesn't exist; this approach works in both dev and prod
- [Phase 01-download-engine]: ffmpeg bundled via download-sidecars.sh now prefers system ffmpeg on macOS to avoid x86_64/arm64 mismatch; falls back to evermeet.cx with warning
- [Phase 01-download-engine]: Playlist URLs detected by list= or /playlist in URL; skip blocking title fetch and use %(playlist_index)02d - %(title)s output template
- [Phase 02-core-ux]: http plugin permissions not valid in this Tauri v2 setup; reqwest handles YouTube API HTTP natively from Rust
- [Phase 02-core-ux]: tauri protocol-asset Cargo feature required when assetProtocol.enable=true in tauri.conf.json (build script validates)
- [Phase 02-core-ux]: API key passed as Option<String> parameter from frontend to search command — frontend loads from plugin-store before invoking
- [Phase 02-core-ux]: app.state::<AppState>() called inline in async commands to avoid Rust E0597 lifetime error with bound State<'_> variables
- [Phase 02-core-ux]: OwnedSemaphorePermit moved into spawned task so semaphore slot is held for full download duration
- [Phase 02-core-ux]: parse_yt_dlp_line made pub for queue.rs reuse; cancel_download skips .part cleanup since yt-dlp naming makes them harmless
- [Phase 02-core-ux]: Stderr collected into Arc<Mutex<Vec<String>>> during queue download — retry loop inspects lines after process exits to detect 429 before deciding to retry or emit error
- [Phase 02-core-ux]: Semaphore permit held across all retry attempts and backoff sleeps in queue_download — slot reserved for full retry lifecycle
- [Phase 03-power-features]: is_playlist_url only matches /playlist?list= — watch URLs handled as single-video
- [Phase 03-power-features]: PlaylistTrackEvent uses serde tag=type+content for discriminated union compatible with TS Channel typing
- [Phase 03-power-features]: map_filename_pattern returns None for empty string — falls back to safe_title, no behavior change for existing users
- [Phase 03-power-features]: embed_thumbnail defaults to true via unwrap_or(true) — new users get thumbnail embedding without explicit setting
- [Phase 03-power-features]: History write uses snapshot of item data before channel callback — avoids stale closure from React state
- [Phase 03-power-features]: Metadata overrides use yt-dlp --parse-metadata flag with :(?P<meta_title>...) syntax to inject ID3 tags
- [Phase 03-power-features]: Notification permission guard: isPermissionGranted check before requestPermission — avoids repeated prompts
- [Phase 04-distribution]: tauri-plugin-updater registered via .setup() not .plugin() — updater requires app handle at registration time
- [Phase 04-distribution]: UPDATER_PUBKEY_PLACEHOLDER and OWNER/REPO are greppable placeholders in tauri.conf.json — must be filled before first release
- [Phase 04-distribution]: CI sidecar script delegates Windows/Linux to existing download-sidecars.sh via exec — only macOS universal case uses lipo
- [Phase 04-distribution]: Unsigned builds chosen: no Apple Developer ID signing/notarization, no Windows EV cert — avoids certificate costs for initial release
- [Phase 04-distribution]: Auto-updater disabled in release workflow: signing removed so latest.json cannot be generated; users update manually via GitHub Releases

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1] Decision needed before implementation: yt-dlp update UX — auto-check on launch vs. user-triggered only.
- [Phase 1] Verify current yt-dlp bot detection state (PO tokens) against GitHub issues before writing queue code.
- [Phase 2] Audio preview must be tested in a packaged build (not `cargo tauri dev`) — will silently fail otherwise.
- [Phase 4] EV code signing cert for Windows: 1–2 week lead time. Apply during Phase 3 to avoid blocking.
- [Phase 4] macOS notarization of sidecar binaries is non-standard. Research before starting Phase 4 planning.
- [Open] Minimum macOS version not decided. Affects WebView codec support for audio preview.
- [Open] Linux — first-class target or best-effort? Affects Phase 2 verification matrix.

## Session Continuity

Last session: 2026-03-22T07:07:30.728Z
Stopped at: Completed 04-distribution-04-02-PLAN.md
Resume file: None
