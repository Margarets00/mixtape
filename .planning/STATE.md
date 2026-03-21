---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 01-download-engine-02-PLAN.md - Rust download engine with yt-dlp sidecar and updater
last_updated: "2026-03-21T13:31:46.411Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** 유튜브 음악을 검색 → 미리듣기 → 골라담기 → 한 방에 MP3 저장 — 이 흐름이 끊기지 않아야 한다.
**Current focus:** Phase 01 — download-engine

## Current Position

Phase: 01 (download-engine) — EXECUTING
Plan: 3 of 3

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

Last session: 2026-03-21T13:31:46.409Z
Stopped at: Completed 01-download-engine-02-PLAN.md - Rust download engine with yt-dlp sidecar and updater
Resume file: None
