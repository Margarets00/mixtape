# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** 유튜브 음악을 검색 → 미리듣기 → 골라담기 → 한 방에 MP3 저장 — 이 흐름이 끊기지 않아야 한다.
**Current focus:** Phase 1 — Download Engine

## Current Position

Phase: 1 of 4 (Download Engine)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-03-21 — Roadmap created, ready to begin Phase 1 planning

Progress: [░░░░░░░░░░] 0%

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Research]: Dual-mode search adopted — YouTube Data API v3 primary, yt-dlp `ytsearch5:` fallback. User must supply API key.
- [Research]: Audio preview uses temp-file approach (60s download to tmp, play via local asset protocol). Direct CDN URLs fail in packaged Tauri WebView.
- [Research]: ffmpeg bundled as sidecar; always pass `--ffmpeg-location` to yt-dlp — never assume PATH.

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

Last session: 2026-03-21
Stopped at: Roadmap written to .planning/ROADMAP.md. Phase 1 has 3 plans defined and is ready to run /gsd:plan-phase.
Resume file: None
