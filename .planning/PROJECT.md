# YouTube Music Downloader

## What This Is

yt-dlp + Tauri 기반 크로스플랫폼 데스크탑 앱. 유튜브에서 음악을 검색하거나 URL로 직접 가져와 MP3로 다운로드한다. Y2K / 파워퍼프걸 / 헬로키티 감성의 레트로 인터넷 UI를 가진 귀여운 툴.

## Core Value

유튜브 음악을 검색 → 미리듣기 → 골라담기 → 한 방에 MP3 저장 — 이 흐름이 끊기지 않아야 한다.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 키워드 검색으로 유튜브 음악 결과 목록 표시
- [ ] URL 직접 입력으로 단일 영상/플레이리스트 불러오기
- [ ] 앱 내 스트리밍 미리듣기 (30초~1분 미리보기)
- [ ] 단일 선택 후 즉시 MP3 다운로드
- [ ] 여러 곡 담아서 일괄 다운로드 (장바구니식)
- [ ] 플레이리스트 URL 입력 → 전체 or 선택 다운로드
- [ ] 저장 경로 지정 (폴더 선택 다이얼로그)
- [ ] 제목 자동 클린업 (특수문자 제거, [Official MV] 등 태그 삭제)
- [ ] 커스텀 파일명 패턴 지정 (예: `아티스트 - 제목`)
- [ ] Y2K / 파워퍼프걸 / 헬로키티 / 레트로 인터넷 UI 스타일

### Out of Scope

- 음원 구매/스트리밍 서비스 연동 — 유튜브 전용
- 로그인/계정 기능 — 로컬 앱, 인증 불필요
- 모바일 앱 — 데스크탑 전용 (Tauri)
- 영상(MP4) 다운로드 — 오디오(MP3) 전용

## Context

- **런타임**: Tauri v2 (Rust 백엔드 + 웹 프론트엔드)
- **다운로드 엔진**: yt-dlp (Python, 번들링 또는 시스템 설치)
- **오디오 변환**: ffmpeg 필요 (MP3 인코딩)
- **검색 API**: YouTube Data API v3 또는 yt-dlp 검색 기능
- **타겟 플랫폼**: macOS, Windows, Linux (크로스플랫폼)
- **UI 스타일**: Y2K 레트로, 파워퍼프걸 컬러팔레트 (파스텔 핑크/블루/그린), 헬로키티 감성, 픽셀/레트로 폰트

## Constraints

- **Tech Stack**: Tauri v2 + yt-dlp — 변경 없음
- **Audio Format**: MP3 only (ffmpeg 필수 의존성)
- **Legal**: yt-dlp 사용은 개인용 로컬 툴 기준, 저작권 고지 없음
- **Bundling**: yt-dlp/ffmpeg 번들 여부는 Phase 1에서 결정

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri v2 선택 | Rust 기반 경량 데스크탑, 크로스플랫폼 | — Pending |
| yt-dlp 검색 vs YouTube API | API 키 불필요 여부 vs 검색 품질 | — Pending |
| yt-dlp/ffmpeg 번들 vs 시스템 설치 | UX vs 배포 크기 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-21 after initialization*
