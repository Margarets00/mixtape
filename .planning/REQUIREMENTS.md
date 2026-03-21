# Requirements: YouTube Music Downloader

**Defined:** 2026-03-21
**Core Value:** 유튜브 음악을 검색 → 미리듣기 → 골라담기 → 한 방에 MP3 저장 — 이 흐름이 끊기지 않아야 한다.

## v1 Requirements

### Download Engine

- [ ] **ENG-01**: URL 입력으로 단일 유튜브 영상을 MP3로 다운로드
- [x] **ENG-02**: yt-dlp + ffmpeg를 앱 내 번들 사이드카로 포함 (macOS/Windows/Linux)
- [ ] **ENG-03**: 다운로드 진행률을 실시간으로 프론트엔드에 전달 (Rust → IPC 이벤트)
- [ ] **ENG-04**: 저장 경로를 폴더 다이얼로그로 지정, 마지막 경로 유지
- [ ] **ENG-05**: 제목 자동 클린업 — `[Official MV]`, `(Lyrics)`, `(Audio)` 등 YouTube 노이즈 제거
- [ ] **ENG-06**: 기본 ID3 태그 삽입 (제목, 아티스트, 연도) via yt-dlp `--embed-metadata`
- [ ] **ENG-07**: 앱 내 yt-dlp 버전 확인 및 업데이트 버튼 (GitHub releases에서 다운)
- [ ] **ENG-08**: 공통 오류 메시지 표시 (429 rate limit, 403 Forbidden, 영상 없음, ffmpeg 없음)
- [ ] **ENG-09**: 앱 종료 시 자식 프로세스 정리 및 임시파일 삭제

### Search

- [ ] **SRCH-01**: 키워드 검색으로 유튜브 결과 목록 표시 (썸네일, 제목, 채널, 재생시간)
- [ ] **SRCH-02**: YouTube Data API v3 키워드 검색 (우선, 사용자 API 키 입력)
- [ ] **SRCH-03**: yt-dlp `ytsearch5:` 폴백 검색 (API 키 없을 때, UI 경고 표시)
- [ ] **SRCH-04**: URL 직접 입력으로 단일 영상 불러오기
- [ ] **SRCH-05**: Settings 패널에서 YouTube API 키 입력 및 저장 (Tauri secure store)

### Preview

- [ ] **PREV-01**: 검색 결과에서 곡 선택 시 앱 내 오디오 미리듣기 (최대 60초)
- [ ] **PREV-02**: 미리듣기는 임시파일 방식 (tmp 디렉토리에 60초 다운, 재생 후 자동 삭제)
- [ ] **PREV-03**: 재생/일시정지 컨트롤 및 진행 표시

### Queue & Batch Download

- [ ] **QUEUE-01**: 검색 결과에서 여러 곡을 장바구니(큐)에 추가
- [ ] **QUEUE-02**: 큐 패널에서 "전체 다운로드" 버튼으로 일괄 다운로드
- [ ] **QUEUE-03**: 큐 항목별 상태 표시 (대기 → 다운로드 중 % → 변환 중 → 완료/오류)
- [ ] **QUEUE-04**: 동시 다운로드 최대 2개 (Semaphore), 다운로드 간 2초 딜레이
- [ ] **QUEUE-05**: 429 응답 시 지수 백오프 (30s → 60s → 120s) 및 재시도 버튼
- [ ] **QUEUE-06**: 개별 큐 항목 취소 (Rust child process kill)

### Playlist

- [ ] **PLAY-01**: 플레이리스트 URL 입력 시 전체 트랙 목록 표시
- [ ] **PLAY-02**: 플레이리스트에서 개별 곡 선택/해제 후 선택 항목만 다운로드
- [ ] **PLAY-03**: 플레이리스트 전체 다운로드 옵션

### Title & Filename

- [ ] **TITLE-01**: 커스텀 파일명 패턴 지정 (예: `{artist} - {title}`)
- [ ] **TITLE-02**: 파일명 패턴 라이브 미리보기

### UI

- [ ] **UI-01**: Y2K / 파워퍼프걸 / 헬로키티 / 레트로 인터넷 스타일 UI
- [ ] **UI-02**: 파스텔 컬러팔레트 (핑크, 블루, 그린), 픽셀/레트로 폰트
- [x] **UI-03**: macOS, Windows, Linux 크로스플랫폼 동작

## v2 Requirements

### Enhanced Metadata

- **META-01**: 다운로드 전 메타데이터 편집 패널 (제목/아티스트/앨범 수동 수정)
- **META-02**: 썸네일 MP3에 임베드 (`yt-dlp --embed-thumbnail`)

### History & QoL

- **HIST-01**: 다운로드 이력 및 중복 방지 (video ID 기반 체크)
- **QOL-01**: 완료 시 "파인더/탐색기에서 보기" 버튼
- **QOL-02**: 완료 시 시스템 알림

### Advanced

- **ADV-01**: 브라우저 쿠키 연동 (`--cookies-from-browser`) — 비공개 플레이리스트용

## Out of Scope

| Feature | Reason |
|---------|--------|
| MP4/영상 다운로드 | 오디오(MP3) 전용 앱 |
| Spotify / Apple Music 연동 | 별도 서비스 도메인 |
| 로그인/계정 기능 | 로컬 앱, 인증 불필요 |
| 모바일 앱 | 데스크탑 전용 (Tauri) |
| 동시 다운로드 4개 이상 | YouTube rate limit 방지 |
| macOS App Store 배포 | sidecar 방식과 App Store 샌드박스 호환 불가 |
| MusicBrainz 태그 매칭 | 복잡한 외부 의존성, v3+로 연기 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENG-01 | Phase 1 | Pending |
| ENG-02 | Phase 1 | Complete |
| ENG-03 | Phase 1 | Pending |
| ENG-04 | Phase 1 | Pending |
| ENG-05 | Phase 1 | Pending |
| ENG-06 | Phase 1 | Pending |
| ENG-07 | Phase 1 | Pending |
| ENG-08 | Phase 1 | Pending |
| ENG-09 | Phase 1 | Pending |
| UI-01 | Phase 1 | Pending |
| UI-02 | Phase 1 | Pending |
| SRCH-01 | Phase 2 | Pending |
| SRCH-02 | Phase 2 | Pending |
| SRCH-03 | Phase 2 | Pending |
| SRCH-04 | Phase 2 | Pending |
| SRCH-05 | Phase 2 | Pending |
| PREV-01 | Phase 2 | Pending |
| PREV-02 | Phase 2 | Pending |
| PREV-03 | Phase 2 | Pending |
| QUEUE-01 | Phase 2 | Pending |
| QUEUE-02 | Phase 2 | Pending |
| QUEUE-03 | Phase 2 | Pending |
| QUEUE-04 | Phase 2 | Pending |
| QUEUE-05 | Phase 2 | Pending |
| QUEUE-06 | Phase 2 | Pending |
| PLAY-01 | Phase 3 | Pending |
| PLAY-02 | Phase 3 | Pending |
| PLAY-03 | Phase 3 | Pending |
| TITLE-01 | Phase 3 | Pending |
| TITLE-02 | Phase 3 | Pending |
| UI-03 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation — traceability expanded to individual rows*
