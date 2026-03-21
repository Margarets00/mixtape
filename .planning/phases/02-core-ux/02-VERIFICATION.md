---
phase: 02-core-ux
verified: 2026-03-22T14:00:00Z
status: human_needed
score: 12/12 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 11/12
  gaps_closed:
    - "QUEUE-05 exponential backoff (30s → 60s → 120s) now fully implemented in queue.rs with RetryWait event emitted and rendered in QueueItem.tsx"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Play a 60s audio preview"
    expected: "Clicking PREVIEW on a search result loads the track, player bar shows title and progress bar, audio plays for up to 60 seconds then stops"
    why_human: "asset:// protocol playback from temp dir requires a packaged build or a native WebView; cannot verify audio playback programmatically. SUMMARY.md notes this as a known limitation in dev mode."
  - test: "Queue two items and observe concurrent download cap"
    expected: "Only 2 downloads run simultaneously; a third item waits until one finishes"
    why_human: "Semaphore concurrency cap requires live yt-dlp execution to observe — cannot verify at rest."
  - test: "Settings tab persists API key across restarts"
    expected: "After saving an API key in Settings, quitting and reopening the app, the key is pre-populated in the input"
    why_human: "Requires app restart cycle — cannot verify programmatically."
  - test: "Trigger a 429 and observe backoff countdown"
    expected: "Queue item shows 'Retrying in 30s... (attempt 1/3)', countdown ticks down to 0, then download restarts. If all 3 attempts fail, item shows error with RETRY button."
    why_human: "Requires a real 429 response from YouTube — cannot fake yt-dlp stderr output at rest."
---

# Phase 02: Core UX Verification Report

**Phase Goal:** A user can search YouTube by keyword, preview a track in-app, add tracks to a queue, and download all of them as MP3s with per-item progress and rate-limit protection.
**Verified:** 2026-03-22T14:00:00Z
**Status:** human_needed (all automated checks pass)
**Re-verification:** Yes — after gap closure (plan 02-03 implemented QUEUE-05 backoff)

---

## Re-verification Summary

The single gap from the initial verification (QUEUE-05 exponential backoff absent) has been
fully closed. `src-tauri/src/queue.rs` now contains a retry loop with `BACKOFF_SECS = [30, 60, 120]`,
a per-second countdown that emits `DownloadEvent::RetryWait`, and cancellation support during the
wait period. The frontend (`QueueTab.tsx` + `QueueItem.tsx`) was also updated: `RetryWait` events
are mapped to a `retrying` status, and `QueueItemRow` renders the live countdown string
`"Retrying in Xs... (attempt N/3)"` in a distinct blue background. No previously passing items
regressed.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User types a keyword and sees a list of YouTube results with thumbnail, title, channel, and duration | VERIFIED | `SearchTab.tsx` invokes `search` command on Enter/button; `SearchResultRow.tsx` renders 48px thumbnail, title, channel, duration |
| 2 | When no API key is configured, search falls back to yt-dlp and a warning banner appears above results | VERIFIED | `search.rs` uses yt-dlp when `api_key` is None/empty; `SearchTab.tsx` banner renders when `usedFallback && results.length > 0` |
| 3 | User can save a YouTube API key in Settings and it persists across app restarts | VERIFIED | `SettingsTab.tsx`: `store.set('youtube_api_key', apiKey)` + `store.save()` on save; loaded via `useEffect` on mount |
| 4 | User can pick a download folder in Settings and it persists across app restarts | VERIFIED | `SettingsTab.tsx`: `open({ directory: true })` then `store.set('lastSaveDir', selected)` + `store.save()` |
| 5 | App has three tabs: SEARCH, QUEUE, SETTINGS with tab switching | VERIFIED | `TabBar.tsx`: three buttons; `App.tsx` conditional renders by `activeTab` state |
| 6 | User clicks Preview on a search result and hears up to 60 seconds of audio playing in the app | VERIFIED (code) / HUMAN NEEDED (runtime) | `preview.rs`: downloads 60s via `--download-sections *0-60`; `PlayerBar.tsx` plays via `asset://` URL |
| 7 | Player bar shows track title, play/pause button, and progress indicator during preview | VERIFIED | `PlayerBar.tsx`: track title, play/pause toggle, progress bar from `timeupdate` event |
| 8 | User clicks + QUEUE on search results and they appear in the Queue tab | VERIFIED | `SearchResultRow.tsx` dispatches `ADD_ITEM`; reducer prevents duplicates; `TabBar.tsx` badge updates |
| 9 | User clicks DOWNLOAD ALL and each queue item progresses through Pending to Downloading to Converting to Done | VERIFIED | `QueueTab.tsx` fires `queue_download` per item; Channel events map to all state transitions; `QueueItemRow` renders all 5 states |
| 10 | No more than 2 downloads run at once, with a 2-second delay between starting each | VERIFIED (code) / HUMAN NEEDED (runtime) | `queue.rs`: `Semaphore::new(2)` + `acquire_owned().await`; `tokio::time::sleep(2s)` before spawn |
| 11 | A 429 rate-limit triggers exponential backoff (30s → 60s → 120s) with a live countdown, then retries; after 3 failed attempts shows an error with a RETRY button | VERIFIED (code) / HUMAN NEEDED (runtime) | `queue.rs` lines 5, 160-194: `BACKOFF_SECS=[30,60,120]`, retry loop with countdown emitting `RetryWait` events each second; `QueueTab.tsx` line 84-95: `RetryWait` mapped to `retrying` status; `QueueItem.tsx` line 145-155: countdown string rendered; RETRY button on final error |
| 12 | User can cancel an individual download and the partial file is cleaned up | VERIFIED | `QueueItem.tsx` `handleCancel`: calls `invoke('cancel_download', { itemId })`; `queue.rs` sends SIGTERM/taskkill |

**Score: 12/12 truths verified** (4 require human/runtime confirmation)

---

## Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/search.rs` | Dual-mode YouTube search (API v3 + yt-dlp fallback) | VERIFIED | `search_youtube_api`, `search_ytdlp`, `search` commands; ISO 8601 duration parsing; URL detection |
| `src/components/TabBar.tsx` | Three-tab navigation with queue badge | VERIFIED | SEARCH/QUEUE/SETTINGS tabs; badge at `queueBadge > 0` |
| `src/components/SearchTab.tsx` | Search input, result list, idle/empty states | VERIFIED | `invoke('search', ...)` on Enter/button; all 4 states; fallback banner |
| `src/components/SearchResultRow.tsx` | Result row with thumbnail, title, channel, duration, Preview/Queue buttons | VERIFIED | 48x48 thumbnail with error fallback; PREVIEW/+QUEUE buttons; IN QUEUE badge |
| `src/components/SettingsTab.tsx` | API key input with show/hide, folder picker | VERIFIED | `youtube_api_key` stored; KEY SAVED feedback; PICK FOLDER |
| `src-tauri/src/preview.rs` | Preview start (60s temp-file download) and stop (cleanup) | VERIFIED | `preview_start` + `preview_stop` + `preview_stop_internal`; PID tracking; temp file cleanup |
| `src-tauri/src/queue.rs` | Queue download with semaphore, exponential backoff retry, and cancel | VERIFIED | 259 lines; `BACKOFF_SECS=[30,60,120]`; retry loop with `RetryWait` countdown events; `Semaphore::new(2)` + 2s delay; PID registry for cancel |
| `src/components/PlayerBar.tsx` | Bottom player bar with audio playback controls | VERIFIED | loading/playing/idle states; `invoke('preview_start')` + `convertFileSrc`; play/pause toggle; progress bar |
| `src/components/QueueTab.tsx` | Queue panel with Download All, Clear Done, item list | VERIFIED | DOWNLOAD ALL + CLEAR DONE; `RetryWait` event handler (lines 84-95) dispatches `retrying` status |
| `src/components/QueueItem.tsx` | Per-item row with 6-state machine (Pending/Downloading/Converting/Retrying/Done/Error) | VERIFIED | All 6 states render correctly; `retrying` state shows live countdown `"Retrying in Xs... (attempt N/3)"`; CANCEL available during retry; RETRY button on error |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SearchTab.tsx` | `search.rs` | `invoke('search', { query, apiKey })` | WIRED | Line 38: `invoke<SearchResponse>('search', { query, apiKey })` |
| `SettingsTab.tsx` | `@tauri-apps/plugin-store` | `store.set('youtube_api_key', ...)` | WIRED | `store.set('youtube_api_key', apiKey)`; `store.save()` |
| `App.tsx` | `TabBar.tsx` | `useState<Tab>` controlling conditional render | WIRED | `<TabBar active={activeTab} onSwitch={setActiveTab}>` |
| `PlayerBar.tsx` | `preview.rs` | `invoke('preview_start', { videoId, videoUrl })` | WIRED | `invoke<string>('preview_start', { videoId, videoUrl })` |
| `PlayerBar.tsx` | `convertFileSrc` | asset:// protocol for temp file | WIRED | `convertFileSrc(path)` → `<audio src={assetUrl}>` |
| `QueueTab.tsx` | `queue.rs` | `invoke('queue_download', { itemId, videoUrl, saveDir, onEvent })` | WIRED | Line 99: `await invoke('queue_download', {...})`; Channel `onmessage` handles all 5 event types including `RetryWait` |
| `QueueTab.tsx` | `queueReducer` | `dispatch({ type: 'UPDATE_STATUS', status: { type: 'retrying', ... } })` | WIRED | `App.tsx` line 19: `retrying` status type defined; line 41: `UPDATE_STATUS` case handles it |
| `QueueItem.tsx` | `queue.rs` | `invoke('cancel_download', { itemId })` | WIRED | Line 31: `await invoke('cancel_download', { itemId: item.id })`; cancel available in `retrying` state (line 200) |
| `SearchTab.tsx` | `queueReducer` | `dispatch({ type: 'ADD_ITEM' })` | WIRED | `ADD_ITEM` dispatch; reducer prevents duplicates by ID |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SRCH-01 | 02-01 | 키워드 검색으로 유튜브 결과 목록 표시 (썸네일, 제목, 채널, 재생시간) | SATISFIED | `SearchTab.tsx` + `SearchResultRow.tsx` render all 4 fields |
| SRCH-02 | 02-01 | YouTube Data API v3 키워드 검색 (우선, 사용자 API 키 입력) | SATISFIED | `search_youtube_api` in `search.rs` calls v3 search + video details endpoints |
| SRCH-03 | 02-01 | yt-dlp `ytsearch5:` 폴백 검색 (API 키 없을 때, UI 경고 표시) | SATISFIED | `search_ytdlp` with `ytsearch5:` prefix; `used_fallback` flag drives banner |
| SRCH-04 | 02-01 | URL 직접 입력으로 단일 영상 불러오기 | SATISFIED | `search.rs`: URL detection (`http://`, `https://`, `youtu.be`), yt-dlp with `--no-playlist` |
| SRCH-05 | 02-01 | Settings 패널에서 YouTube API 키 입력 및 저장 (Tauri secure store) | SATISFIED | `SettingsTab.tsx`: password input, show/hide, `store.set('youtube_api_key')`, KEY SAVED confirmation |
| PREV-01 | 02-02 | 검색 결과에서 곡 선택 시 앱 내 오디오 미리듣기 (최대 60초) | SATISFIED | `preview_start` downloads 60s via `--download-sections *0-60`; `PlayerBar.tsx` plays via `asset://` |
| PREV-02 | 02-02 | 미리듣기는 임시파일 방식 (tmp 디렉토리에 60초 다운, 재생 후 자동 삭제) | SATISFIED | `preview.rs`: writes to `$TEMP/preview_{id}.mp3`; `preview_stop_internal` deletes matching files |
| PREV-03 | 02-02 | 재생/일시정지 컨트롤 및 진행 표시 | SATISFIED | `PlayerBar.tsx`: play/pause button; progress bar from `timeupdate` event |
| QUEUE-01 | 02-02 | 검색 결과에서 여러 곡을 장바구니(큐)에 추가 | SATISFIED | `+ QUEUE` button dispatches `ADD_ITEM`; reducer prevents duplicates; queue badge updates |
| QUEUE-02 | 02-02 | 큐 패널에서 "전체 다운로드" 버튼으로 일괄 다운로드 | SATISFIED | `QueueTab.tsx`: DOWNLOAD ALL fires `Promise.allSettled` over all pending/error items |
| QUEUE-03 | 02-02 | 큐 항목별 상태 표시 (대기 → 다운로드 중 % → 변환 중 → 완료/오류) | SATISFIED | `QueueItemRow` renders all states; `DownloadEvent` types map to all transitions via Channel |
| QUEUE-04 | 02-02 | 동시 다운로드 최대 2개 (Semaphore), 다운로드 간 2초 딜레이 | SATISFIED | `queue.rs`: `Semaphore::new(2)` + `acquire_owned().await`; `tokio::time::sleep(2s)` before spawn |
| QUEUE-05 | 02-03 | 429 응답 시 지수 백오프 (30s → 60s → 120s) 및 재시도 버튼 | SATISFIED | `queue.rs` line 5: `BACKOFF_SECS=[30,60,120]`; lines 160-194: retry loop with `RetryWait` countdown; `QueueTab.tsx` lines 84-95: `RetryWait` → `retrying` dispatch; `QueueItem.tsx` lines 145-155: countdown rendered; after 3 attempts → Error with RETRY button |
| QUEUE-06 | 02-02 | 개별 큐 항목 취소 (Rust child process kill) | SATISFIED | `QueueItem.tsx` calls `invoke('cancel_download')`; `queue.rs` sends SIGTERM (unix) or taskkill (windows); cancel also works during backoff countdown |

### Orphaned Requirements Check

All 14 Phase 2 requirement IDs (SRCH-01 through SRCH-05, PREV-01 through PREV-03, QUEUE-01 through QUEUE-06) are claimed by plans 02-01, 02-02, and 02-03. No orphaned requirements.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/components/QueueTab.tsx` line 108 | `if (isDownloadAllDisabled \|\| !saveDir) return;` silently no-ops when no folder selected | INFO | User gets no feedback if DOWNLOAD ALL clicked without a configured folder. The header shows "No folder selected" but the button is not visually disabled for this case. Minor UX gap, not a blocker. |

No blocker anti-patterns found. No TODO/FIXME/placeholder comments. No empty implementations.
The QUEUE-05 gap closure added substantive logic (retry loop, countdown, cancellation during wait)
with no new stubs introduced.

---

## Human Verification Required

### 1. Audio preview playback

**Test:** Run `cargo tauri dev`, search for any song, click PREVIEW.
**Expected:** Player bar shows "~ loading preview... ~" while the 60s clip downloads, then plays audio with title, play/pause button, and a filling progress bar.
**Why human:** The `asset://` protocol requires the native WebView to serve temp files. SUMMARY.md notes this may not work reliably in `cargo tauri dev` — a packaged build (`cargo tauri build`) is the authoritative test. Cannot verify audio playback programmatically.

### 2. Semaphore concurrency limit

**Test:** Queue 3+ items and click DOWNLOAD ALL.
**Expected:** At most 2 items show "Downloading" state simultaneously. The third stays "Pending" until one completes.
**Why human:** Semaphore cap requires live yt-dlp execution and observable state transitions. Cannot verify at rest.

### 3. API key persistence across restarts

**Test:** Enter an API key in Settings, save it, quit the app completely, reopen.
**Expected:** API key is pre-populated in the masked input field.
**Why human:** Requires full app restart cycle to verify Tauri store persistence.

### 4. Exponential backoff countdown (QUEUE-05)

**Test:** Trigger a 429 response (or mock yt-dlp stderr with "HTTP Error 429"). Queue an item, click DOWNLOAD ALL.
**Expected:** Item background turns blue, text shows "Retrying in 30s... (attempt 1/3)", ticks down to 0, then download re-spawns. If all 3 attempts fail, item shows the error message "YouTube rate limit (429). Tried 3 times with backoff. Try again later." with a RETRY button.
**Why human:** Requires a real or mocked 429 response from yt-dlp's stderr — cannot simulate yt-dlp process output at rest.

---

## Gaps Summary

No gaps remain. All 14 requirements are satisfied in code. Phase goal fully achieved.

---

_Verified: 2026-03-22T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
