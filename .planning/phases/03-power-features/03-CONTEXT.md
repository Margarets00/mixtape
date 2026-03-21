# Phase 3: Power Features - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

플레이리스트 URL 지원, 커스텀 파일명 패턴, v2 기능 일괄 포함 (메타데이터 편집, 썸네일 임베드, 다운로드 이력, Finder 열기, 시스템 알림).

Requirements: PLAY-01, PLAY-02, PLAY-03, TITLE-01, TITLE-02 (v1) + META-01, META-02, HIST-01, QOL-01, QOL-02 (v2 → v1 promoted)

</domain>

<decisions>
## Implementation Decisions

### 플레이리스트 진입 및 UI 흐름
- **D-01:** 플레이리스트 URL은 기존 Search 탭에서 입력 — 새 탭 없음
- **D-02:** 플레이리스트 URL 감지 시 결과 리스트 영역이 체크박스 트랙 목록으로 교체됨 (일반 검색 결과 뷰와 동일 컨테이너)
- **D-03:** 트랙 선택 UI: 전체 선택/해제 버튼 + 개별 체크박스 — 선택 개수 표시 없음, 이미 큐에 있는 항목 별도 처리 없음
- **D-04:** 로딩 방식: 스켈레톤 UI — 트랙이 하나씩 들어오면서 점진적으로 채워짐 (50+ 트랙 대응)

### 플레이리스트 → 큐 통합
- **D-05:** 선택한 트랙은 기존 큐에 추가됨 — 별도 다운로드 흐름 없음
- **D-06:** 큐에 추가 후 사용자가 QUEUE 탭으로 이동해 DOWNLOAD ALL — 기존 흐름 그대로 유지

### 파일명 패턴 (TITLE-01, TITLE-02)
- **D-07:** 파일명 패턴 입력란은 Settings 탭에 추가 (API 키, 폴더 선택 아래)
- **D-08:** 라이브 미리보기는 Settings 탭 내 패턴 입력 바로 아래에 인라인으로 표시

### 메타데이터 편집 (META-01)
- **D-09:** 큐 항목마다 편집 버튼 — 클릭 시 해당 항목 아래 인라인으로 펼쳐짐
- **D-10:** 편집 가능 필드: 제목, 아티스트, 앨범 (yt-dlp `--metadata-from-options` 또는 `--postprocessor-args` 방식)
- **D-11:** 편집은 다운로드 전에만 가능 (Pending 상태일 때)

### 썸네일 임베드 (META-02)
- **D-12:** Settings 탭에 "썸네일 MP3에 임베드" 토글 — 기본값 ON
- **D-13:** yt-dlp `--embed-thumbnail` 플래그로 구현

### 다운로드 이력 (HIST-01)
- **D-14:** HISTORY 탭 신설 — 탭 순서: SEARCH / QUEUE / HISTORY / SETTINGS
- **D-15:** Video ID 기준 중복 감지 — 이미 다운로드한 곡은 검색 결과/플레이리스트에서 "DOWNLOADED" 배지 표시
- **D-16:** 이력은 Tauri store에 영속 저장 (앱 재시작 후에도 유지)

### QoL (QOL-01, QOL-02)
- **D-17:** 큐 항목 완료 시 "Finder에서 보기" 버튼 — 해당 파일 경로로 OS 파일 탐색기 열기
- **D-18:** 다운로드 완료 시 시스템 알림 — Tauri `notification` 플러그인 사용

### Claude's Discretion
- 스켈레톤 UI 디자인 (색상, 애니메이션 방식)
- 파일명 패턴 변수 세트 (`{title}`, `{artist}`, `{channel}`, `{year}` 등 — 구현 시 yt-dlp 지원 변수 기준)
- HISTORY 탭 UI 레이아웃 (테이블, 카드 등)
- 메타데이터 편집 인라인 폼 디자인

</decisions>

<specifics>
## Specific Ideas

- 플레이리스트 로딩은 스켈레톤 방식 — 50+ 트랙에서 blocking wait 없음
- 메타데이터 편집은 큐 항목 인라인 확장 — 모달 팝업 아님
- HISTORY 탭은 4번째 탭으로 신설 (기존 3탭 뒤에 추가)
- 썸네일 임베드 기본값 ON — 사용자가 Settings에서 끌 수 있음

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 기존 구현 참조
- `src/App.tsx` — QueueItem 타입, queueReducer, Tab 타입 (HISTORY 탭 추가 시 확장 필요)
- `src/components/TabBar.tsx` — 탭 추가 패턴
- `src/components/SearchTab.tsx` — URL 감지 로직, 결과 렌더링 패턴
- `src/components/SearchResultRow.tsx` — 체크박스 확장 기반 컴포넌트
- `src/components/QueueItem.tsx` — 인라인 확장 패턴 참조 (메타데이터 편집 UI)
- `src/components/SettingsTab.tsx` — Settings 추가 항목 위치
- `src-tauri/src/search.rs` — URL 감지 로직 (`is_url`), yt-dlp 호출 패턴
- `src-tauri/src/queue.rs` — 다운로드 파이프라인 (파일명 패턴, 메타데이터 주입 지점)
- `src-tauri/src/download.rs` — yt-dlp 플래그 주입 위치

### 요구사항
- `.planning/REQUIREMENTS.md` — PLAY-01~03, TITLE-01~02, META-01~02, HIST-01, QOL-01~02 전체 정의

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `queueReducer` + `QueueItem` 타입: 플레이리스트 트랙도 동일 타입으로 큐에 추가 가능 — 별도 타입 불필요
- `search.rs`의 `is_url` 감지: 플레이리스트 URL도 동일 로직으로 감지 후 분기 처리
- `QueueItem.tsx` 인라인 확장 구조: 메타데이터 편집 패널도 동일 패턴으로 구현 가능
- Tauri `@tauri-apps/plugin-store`: HIST-01 이력 저장에 그대로 사용
- `SettingsTab.tsx` 패턴: 토글/입력 추가 패턴 확립됨

### Established Patterns
- 채널 이벤트 (Channel): Rust → 프론트 스트리밍은 기존 queue.rs 패턴 재사용
- yt-dlp sidecar 호출: `locate_sidecar("yt-dlp")` 패턴 확립됨
- Tauri store 영속화: `store.set()` + `store.save()` 패턴

### Integration Points
- `search.rs`에 플레이리스트 URL 분기 추가 → 새 `search_playlist` 커맨드
- `queue.rs`의 `queue_download`에 파일명 패턴 + 메타데이터 파라미터 추가
- `App.tsx`의 `Tab` 타입에 `'history'` 추가, `TabBar`에 4번째 탭 추가

</code_context>

<deferred>
## Deferred Ideas

- ADV-01: 브라우저 쿠키 연동 (`--cookies-from-browser`) — 비공개 플레이리스트용 (v2 Advanced)
- MusicBrainz 태그 자동 매칭 — Out of Scope (복잡한 외부 의존성)
- 플레이리스트 선택 개수 표시 ("12/47 selected") — 필요 시 Phase 3 실행 중 추가 가능

</deferred>

---

*Phase: 03-power-features*
*Context gathered: 2026-03-22*
