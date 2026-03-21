# Phase 3: Power Features - Research

**Researched:** 2026-03-22
**Domain:** yt-dlp playlist API, Tauri v2 notification/opener plugins, metadata injection, history persistence
**Confidence:** HIGH (core yt-dlp flags), MEDIUM (metadata override syntax), HIGH (Tauri plugin setup)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 플레이리스트 URL은 기존 Search 탭에서 입력 — 새 탭 없음
- **D-02:** 플레이리스트 URL 감지 시 결과 리스트 영역이 체크박스 트랙 목록으로 교체됨 (일반 검색 결과 뷰와 동일 컨테이너)
- **D-03:** 트랙 선택 UI: 전체 선택/해제 버튼 + 개별 체크박스 — 선택 개수 표시 없음, 이미 큐에 있는 항목 별도 처리 없음
- **D-04:** 로딩 방식: 스켈레톤 UI — 트랙이 하나씩 들어오면서 점진적으로 채워짐 (50+ 트랙 대응)
- **D-05:** 선택한 트랙은 기존 큐에 추가됨 — 별도 다운로드 흐름 없음
- **D-06:** 큐에 추가 후 사용자가 QUEUE 탭으로 이동해 DOWNLOAD ALL — 기존 흐름 그대로 유지
- **D-07:** 파일명 패턴 입력란은 Settings 탭에 추가 (API 키, 폴더 선택 아래)
- **D-08:** 라이브 미리보기는 Settings 탭 내 패턴 입력 바로 아래에 인라인으로 표시
- **D-09:** 큐 항목마다 편집 버튼 — 클릭 시 해당 항목 아래 인라인으로 펼쳐짐
- **D-10:** 편집 가능 필드: 제목, 아티스트, 앨범 (yt-dlp `--parse-metadata` 방식)
- **D-11:** 편집은 다운로드 전에만 가능 (Pending 상태일 때)
- **D-12:** Settings 탭에 "썸네일 MP3에 임베드" 토글 — 기본값 ON
- **D-13:** yt-dlp `--embed-thumbnail` 플래그로 구현
- **D-14:** HISTORY 탭 신설 — 탭 순서: SEARCH / QUEUE / HISTORY / SETTINGS
- **D-15:** Video ID 기준 중복 감지 — 이미 다운로드한 곡은 검색 결과/플레이리스트에서 "DOWNLOADED" 배지 표시
- **D-16:** 이력은 Tauri store에 영속 저장 (앱 재시작 후에도 유지)
- **D-17:** 큐 항목 완료 시 "Finder에서 보기" 버튼 — 해당 파일 경로로 OS 파일 탐색기 열기
- **D-18:** 다운로드 완료 시 시스템 알림 — Tauri `notification` 플러그인 사용

### Claude's Discretion

- 스켈레톤 UI 디자인 (색상, 애니메이션 방식)
- 파일명 패턴 변수 세트 (`{title}`, `{artist}`, `{channel}`, `{year}` 등 — 구현 시 yt-dlp 지원 변수 기준)
- HISTORY 탭 UI 레이아웃 (테이블, 카드 등)
- 메타데이터 편집 인라인 폼 디자인

### Deferred Ideas (OUT OF SCOPE)

- ADV-01: 브라우저 쿠키 연동 (`--cookies-from-browser`) — 비공개 플레이리스트용
- MusicBrainz 태그 자동 매칭
- 플레이리스트 선택 개수 표시 ("12/47 selected")
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAY-01 | 플레이리스트 URL 입력 시 전체 트랙 목록 표시 | `--flat-playlist --print` 스트리밍 패턴으로 구현 |
| PLAY-02 | 플레이리스트에서 개별 곡 선택/해제 후 선택 항목만 다운로드 | 프론트 체크박스 → 큐 ADD_ITEM; 다운로드는 기존 `queue_download` 재사용 |
| PLAY-03 | 플레이리스트 전체 다운로드 옵션 | 전체 선택 버튼 → 모든 항목 ADD_ITEM |
| TITLE-01 | 커스텀 파일명 패턴 지정 (예: `{artist} - {title}`) | yt-dlp output template 변수 매핑 확인 |
| TITLE-02 | 파일명 패턴 라이브 미리보기 | 프론트엔드 전용 — 샘플 데이터로 패턴 렌더링 |
| META-01 | 다운로드 전 메타데이터 편집 패널 (제목/아티스트/앨범) | `--parse-metadata` + `meta_` prefix 방식 확인 |
| META-02 | 썸네일 MP3에 임베드 (`--embed-thumbnail`) | 스탠드얼론 바이너리에 mutagen 번들됨 — 추가 의존성 없음 |
| HIST-01 | 다운로드 이력 및 중복 방지 (video ID 기반) | Tauri store `download-history.json` 영속화 |
| QOL-01 | 완료 시 "파인더/탐색기에서 보기" 버튼 | `tauri-plugin-opener` `revealItemInDir()` |
| QOL-02 | 완료 시 시스템 알림 | `tauri-plugin-notification` `sendNotification()` |
</phase_requirements>

---

## Summary

Phase 3 adds five capability areas on top of the already-working queue/download pipeline: (1) playlist fetch and selection, (2) custom filename patterns, (3) pre-download metadata editing, (4) download history with dedup, and (5) two QoL polish features (Finder reveal + system notification).

All core yt-dlp flags needed are confirmed available and work with the sidecar binary. The two new Tauri plugins (`notification`, `opener`) are straightforward — both just need Cargo entry, `lib.rs` registration, and two permission strings in `capabilities/default.json`. The `opener` plugin frontend JS package is already present in `package.json` (`@tauri-apps/plugin-opener ^2`) but the Cargo side and `lib.rs` registration are still needed.

The most technically nuanced area is metadata override: the correct method is `--parse-metadata "%(field)s:%(meta_target)s"` with the `meta_` prefix — this sets ID3 tags via yt-dlp's `FFmpegMetadataPP` postprocessor. Literal string override uses a regex capture: `--parse-metadata ":(?P<meta_title>User Title)"` (empty source, named capture group). This was confirmed working in recent yt-dlp issues and the ArchLinux man page documentation.

**Primary recommendation:** Implement playlist streaming via a new `search_playlist` Tauri command that spawns yt-dlp with `--flat-playlist --print` and streams results line-by-line through a Tauri Channel (same pattern as existing queue progress events). This avoids blocking on 50+ track playlists and enables the skeleton-loading UX.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| yt-dlp sidecar | latest bundled | Playlist fetch, download, metadata, thumbnail | `locate_sidecar("yt-dlp")` pattern established |
| ffmpeg sidecar | bundled | Audio conversion, thumbnail embedding | Always pass `--ffmpeg-location` |
| `@tauri-apps/plugin-store` | ^2.4.2 | Persist history + settings | `load('download-history.json', {defaults: {}})` pattern established |

### New Additions Required
| Library | Version | Purpose | Install |
|---------|---------|---------|---------|
| `tauri-plugin-notification` | ^2 (Rust) | System notifications (QOL-02) | `cargo add tauri-plugin-notification` |
| `@tauri-apps/plugin-notification` | ^2 (JS) | System notifications (QOL-02) | `npm install @tauri-apps/plugin-notification` |
| `tauri-plugin-opener` | ^2 (Rust) | Reveal file in Finder/Explorer (QOL-01) | `cargo add tauri-plugin-opener` |
| `@tauri-apps/plugin-opener` | ^2 (JS) | Already in package.json — Rust side missing | `cargo add tauri-plugin-opener` only |

**Note:** `@tauri-apps/plugin-opener` is already in `package.json` but `tauri-plugin-opener` is NOT in `src-tauri/Cargo.toml` and is NOT registered in `lib.rs`. Both must be added.

**Installation:**
```bash
# Rust
cargo add tauri-plugin-notification
cargo add tauri-plugin-opener

# JS (notification only — opener already in package.json)
npm install @tauri-apps/plugin-notification
```

---

## Architecture Patterns

### Recommended Project Structure Changes
```
src/
├── components/
│   ├── SearchTab.tsx          # Add playlist URL detection branch
│   ├── PlaylistTrackRow.tsx   # NEW: checkbox row for playlist items
│   ├── QueueItem.tsx          # Add inline metadata editor + "Show in Finder" button
│   ├── SettingsTab.tsx        # Add filename pattern input + thumbnail toggle
│   ├── TabBar.tsx             # Add 'history' tab (4th tab)
│   ├── HistoryTab.tsx         # NEW: history list + DOWNLOADED badge logic
│   └── ...
src-tauri/src/
├── search.rs                  # Add search_playlist command
├── queue.rs                   # Add filename_pattern + metadata params to queue_download
└── lib.rs                     # Register notification + opener plugins
```

### Pattern 1: Playlist Streaming via Channel (PLAY-01, D-04)

**What:** Spawn yt-dlp with `--flat-playlist --print` and stream each line through a Tauri `Channel<PlaylistTrackEvent>` — same mechanism as queue progress streaming. Frontend receives one track at a time and appends to list.

**Why not `--dump-single-json`:** That blocks until the entire playlist JSON is fetched. For a 100-track playlist this could take 10+ seconds with no feedback.

**Why `--flat-playlist`:** Extracts only entry-level metadata (id, title, thumbnail, duration, channel) without fetching per-video page HTML. Fast enough for 100+ track playlists.

**Confirmed yt-dlp command:**
```bash
yt-dlp \
  --flat-playlist \
  --print "%(id)s\t%(title)s\t%(thumbnail)s\t%(duration_string)s\t%(channel)s" \
  --no-warnings \
  "https://www.youtube.com/playlist?list=PLxxx"
```

**Rust implementation pattern:**
```rust
// Source: existing search_ytdlp pattern in search.rs + queue.rs Channel streaming
#[tauri::command]
pub async fn search_playlist(
    url: String,
    on_track: tauri::ipc::Channel<PlaylistTrackEvent>,
) -> Result<(), String> {
    let ytdlp_path = crate::download::locate_sidecar("yt-dlp")?;

    let mut child = tokio::process::Command::new(&ytdlp_path)
        .args([
            "--flat-playlist",
            "--print", "%(id)s\t%(title)s\t%(thumbnail)s\t%(duration_string)s\t%(channel)s",
            "--no-warnings",
            &url,
        ])
        .stdout(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    // Stream lines — each line = one track event
    let mut reader = tokio::io::BufReader::new(stdout).lines();
    while let Ok(Some(line)) = reader.next_line().await {
        // parse tab-separated fields → emit PlaylistTrackEvent::Track { ... }
    }
    Ok(())
}
```

**Playlist URL detection:** Current `is_url` check in `search.rs` already handles `https://` prefix. Need additional branch: if URL contains `list=` or `/playlist`, route to `search_playlist` instead of single-video fetch. The `download.rs` already has this exact pattern: `url.contains("list=") || url.contains("/playlist")`.

### Pattern 2: Filename Pattern Template (TITLE-01, TITLE-02)

**yt-dlp output template variables confirmed available:**
| yt-dlp variable | User-facing token | Example output |
|-----------------|-------------------|----------------|
| `%(title)s` | `{title}` | "Bohemian Rhapsody" |
| `%(artist)s` | `{artist}` | "Queen" (from metadata, may be empty) |
| `%(uploader)s` | `{channel}` | "Queen Official" |
| `%(channel)s` | — (same as uploader for YouTube) | "Queen Official" |
| `%(upload_date>%Y)s` | `{year}` | "1975" |
| `%(playlist_index)s` | `{track_num}` | "03" (playlist context only) |

**Mapping approach in `queue.rs`:** Frontend sends the user pattern string (e.g. `"{artist} - {title}"`). Rust replaces user tokens with yt-dlp template variables, then passes to `-o` flag:

```rust
fn map_filename_pattern(user_pattern: &str) -> String {
    user_pattern
        .replace("{title}", "%(title)s")
        .replace("{artist}", "%(artist)s")
        .replace("{channel}", "%(uploader)s")
        .replace("{year}", "%(upload_date>%Y)s")
        .replace("{track_num}", "%(playlist_index)s")
}
// Then: format!("{}/{}.%(ext)s", save_dir, map_filename_pattern(&pattern))
```

**Default fallback:** When pattern is empty or not set, fall back to current behavior (clean title → `safe_title`).

**Live preview (TITLE-02):** Pure frontend. Store a sample `QueueItem` in the Settings component. Render the pattern with its fields replaced using sample data (no Rust call needed).

### Pattern 3: Metadata Override (META-01)

**Confirmed working approach — `--parse-metadata` with `meta_` prefix:**

The `meta_` prefix tells yt-dlp's `FFmpegMetadataPP` to write that value as an ID3 tag, overriding the auto-detected value.

To override with a literal user-supplied value (not a field from yt-dlp's info_dict), the working syntax uses an empty source field and a named regex capture:

```bash
# Override title with literal "My Custom Title"
yt-dlp \
  --parse-metadata ":(?P<meta_title>My Custom Title)" \
  --parse-metadata ":(?P<meta_artist>My Artist)" \
  --parse-metadata ":(?P<meta_album>My Album)" \
  ...
```

**Alternative (also works):** `--postprocessor-args` with ffmpeg `-metadata`:
```bash
yt-dlp \
  --postprocessor-args "ffmpeg:-metadata title='My Title' -metadata artist='Artist'" \
  ...
```

**Recommendation:** Use `--parse-metadata` approach. It's the idiomatic yt-dlp way and avoids shell quoting complexity in Rust's `Command::args()`.

**Queue integration:** `queue_download` command receives optional `metadata_overrides: Option<MetadataOverride>` struct. If populated, appends `--parse-metadata` args before spawning.

```rust
#[derive(serde::Deserialize)]
pub struct MetadataOverride {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
}
```

**Only for pending items (D-11):** Frontend enforces this — edit button only shows when `status.type === 'pending'`. Overrides stored in queue state alongside the QueueItem; passed to `queue_download` at invocation time.

### Pattern 4: Thumbnail Embedding (META-02)

**Confirmed:** The yt-dlp standalone binary (yt-dlp_macos, yt-dlp.exe, yt-dlp_linux) bundles **mutagen** as part of the PyInstaller build. No separate dependency installation required. `--embed-thumbnail` works with the project's existing sidecar binary.

**yt-dlp flag:** `--embed-thumbnail` — embeds the YouTube thumbnail as ID3 APIC frame (album art) in the MP3 file.

**ffmpeg required:** Already bundled. yt-dlp uses ffmpeg to convert the thumbnail to JPEG before passing to mutagen for embedding.

**Settings toggle (D-12, D-13):** Stored in `app-settings.json` under key `embed_thumbnail` (boolean, default `true`). Loaded by frontend on mount. Passed as parameter to `queue_download`.

**Addition to yt-dlp args in `queue.rs`:**
```rust
if embed_thumbnail {
    args.push("--embed-thumbnail");
    args.push("--convert-thumbnails");
    args.push("jpg");  // Convert webp/png thumbnails to jpg for better compatibility
}
```

**Pitfall:** YouTube sometimes serves WebP thumbnails. The `--convert-thumbnails jpg` flag converts them before embedding. Without it, some builds of mutagen may fail on WebP.

### Pattern 5: Download History (HIST-01)

**Storage:** Separate store file `download-history.json` — keeps history isolated from settings. Same `load()` / `store.set()` / `store.save()` pattern.

**History entry structure (TypeScript):**
```typescript
interface HistoryEntry {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  downloadedAt: string;  // ISO 8601
  filePath: string;
}
```

**Write path:** In `QueueTab` when a `DownloadEvent::Done` is received for a queue item, call `addToHistory(item, path)`.

**Read path:** `HistoryTab` component loads `download-history.json` on mount. `SearchTab` and playlist list check `downloadedIds` Set to show "DOWNLOADED" badge (D-15).

**Dedup (D-15):** Pass `downloadedIds: Set<string>` down to `SearchResultRow` and `PlaylistTrackRow`. Show a "DOWNLOADED" badge when `downloadedIds.has(result.id)`.

**History capacity:** No cap defined in requirements. Implementation discretion: keep most recent 500 entries to avoid unbounded growth.

### Pattern 6: Tauri `notification` Plugin (QOL-02)

**Full setup:**

1. `src-tauri/Cargo.toml`:
```toml
tauri-plugin-notification = "2"
```

2. `src-tauri/src/lib.rs`:
```rust
.plugin(tauri_plugin_notification::init())
```

3. `src-tauri/capabilities/default.json` — add to `permissions`:
```json
"notification:default"
```

4. Frontend JS pattern:
```typescript
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

async function notifyDownloadDone(title: string) {
  let granted = await isPermissionGranted();
  if (!granted) {
    const perm = await requestPermission();
    granted = perm === 'granted';
  }
  if (granted) {
    sendNotification({ title: 'Download complete', body: title });
  }
}
```

**macOS:** System notifications require permission grant on first use. The `requestPermission()` call triggers the OS prompt.

**Windows:** Notifications work without explicit permission prompt.

### Pattern 7: Tauri `opener` Plugin (QOL-01)

**Status:** `@tauri-apps/plugin-opener` is ALREADY in `package.json`. Only Rust side is missing.

**Full setup:**

1. `src-tauri/Cargo.toml`:
```toml
tauri-plugin-opener = "2"
```

2. `src-tauri/src/lib.rs`:
```rust
.plugin(tauri_plugin_opener::init())
```

3. `src-tauri/capabilities/default.json` — add to `permissions`:
```json
"opener:default"
```

4. Frontend JS — `revealItemInDir` reveals the file's parent folder with the file selected:
```typescript
import { revealItemInDir } from '@tauri-apps/plugin-opener';

// In QueueItemRow, on "Show in Finder" button:
await revealItemInDir(item.filePath);
```

**Cross-platform behavior:** `revealItemInDir` opens Finder (macOS), File Explorer (Windows), or nautilus/dolphin (Linux) and selects the file.

**Known issue (Nov 2025):** GitHub issue #3111 reported `revealItemInDir` receiving wrong path key. Workaround: call `invoke('plugin:opener|reveal_item_in_dir', { path: filePath })` directly if the JS binding misbehaves. Verify in testing.

### Pattern 8: Tab Architecture Extension (HIST-01, D-14)

**`Tab` type in `App.tsx`** must be extended:
```typescript
type Tab = 'search' | 'queue' | 'history' | 'settings';
```

**`TabBar.tsx`:** Add `{ id: 'history', label: 'HISTORY' }` as third entry (before settings).

**`App.tsx`:** Add `HistoryTab` render branch and pass `downloadedIds` Set derived from history to `SearchTab`.

### Anti-Patterns to Avoid

- **Blocking playlist fetch:** Do NOT use `--dump-single-json` or `--skip-download --write-info-json` for playlist metadata — these block until all tracks are fetched. Use `--flat-playlist --print` with streaming.
- **Per-track API calls for playlist:** Do NOT call YouTube Data API per track — rate limits at 100 req/day. `--flat-playlist` gives all needed fields (id, title, thumbnail, duration, channel) in one yt-dlp invocation.
- **Storing metadata overrides in Rust state:** Store overrides in frontend queue state (alongside `QueueItem`), pass as parameters to `queue_download` at invocation. Don't create server-side mutation state.
- **Opening the folder directory instead of revealing the file:** `openPath(folderPath)` opens the folder. `revealItemInDir(filePath)` reveals the specific file with selection — use the latter for QOL-01.
- **Hardcoding mutagen path for thumbnail:** Do NOT attempt to bundle or call mutagen separately. The yt-dlp binary bundles it; just pass `--embed-thumbnail`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| System notifications | Custom WebView overlay | `tauri-plugin-notification` | OS-native; WebView toasts are invisible when app is unfocused |
| Reveal in Finder/Explorer | Shell script `open -R` / `explorer /select,` | `tauri-plugin-opener` `revealItemInDir` | Cross-platform; handles Windows path format differences |
| Playlist thumbnail conversion | Image processing in Rust | `--convert-thumbnails jpg` yt-dlp flag | Already in yt-dlp; WebP/PNG→JPEG handled automatically |
| History dedup logic | Custom hash/bloom filter | `Set<string>` of video IDs from store | Video IDs are already unique stable keys |
| Filename sanitization for custom patterns | Custom regex | Existing `sanitize_filename()` in `title.rs` | Already handles path separators, reserved chars |

**Key insight:** yt-dlp's postprocessor chain (EmbedMetadata → EmbedThumbnail → FFmpegMetadata) already does everything needed for metadata/thumbnail. Passing the right flags is the entire implementation — no custom postprocessing needed.

---

## Common Pitfalls

### Pitfall 1: `--flat-playlist` Missing Some Metadata Fields

**What goes wrong:** With `--flat-playlist`, some videos in a playlist may return empty strings for `%(artist)s`, `%(channel)s`, or `%(thumbnail)s` — especially for older uploads or live streams. Parsing `split('\t')` with exactly 5 fields will fail.

**Why it happens:** `--flat-playlist` skips per-video page fetching, so fields derived from video page HTML (not playlist API response) are unavailable.

**How to avoid:** Parse with `splitn(5, '\t')` and provide empty-string defaults. Use `https://img.youtube.com/vi/{id}/mqdefault.jpg` as thumbnail fallback (same pattern as existing `search_ytdlp`).

**Warning signs:** Empty thumbnail images in skeleton list; tracks with missing duration shown as "?".

### Pitfall 2: Playlist URL Detection Colliding with Single Video URL

**What goes wrong:** A YouTube video URL with `&list=` parameter appended (e.g., when opened from a playlist context) contains `list=` and would be incorrectly treated as a playlist.

**Why it happens:** YouTube appends `&list=PLxxx` to video URLs when the user clicks a video from a playlist.

**How to avoid:** Check that the URL is a playlist root by requiring either `/playlist?list=` OR the absence of `/watch?v=`. Current `download.rs` uses `url.contains("list=") || url.contains("/playlist")` — this will treat `youtube.com/watch?v=X&list=PLY` as a playlist. Decision needed: either (a) force `--no-playlist` for watch URLs with list params, or (b) detect playlist context and offer both options. **Recommendation:** For Phase 3, treat `youtube.com/watch?v=X&list=PLY` as single video (add `--no-playlist` to single-video path); only treat `youtube.com/playlist?list=PLY` or `/playlist` paths as full playlists.

**Warning signs:** User pastes a video URL that opens a 200-track playlist unexpectedly.

### Pitfall 3: `--parse-metadata` Literal Override Not Applying

**What goes wrong:** Custom title/artist/album set in the metadata editor don't appear in the downloaded MP3's ID3 tags.

**Why it happens:** Two root causes:
- `--embed-metadata` flag is required alongside `--parse-metadata` for tags to be written to the file
- `--parse-metadata` modifies the info_dict, but `FFmpegMetadataPP` only runs if `--embed-metadata` is present

**How to avoid:** Always keep `--embed-metadata` in the yt-dlp args (it's already present in `queue.rs`). The `--parse-metadata ":(?P<meta_title>X)"` flags append additional overrides on top.

**Warning signs:** yt-dlp completes successfully but VLC/Music shows original YouTube title.

### Pitfall 4: Notification Permission Not Requested on macOS

**What goes wrong:** `sendNotification()` silently fails — no notification appears.

**Why it happens:** macOS requires explicit user permission grant before any notification can be shown. If `requestPermission()` was never called, `isPermissionGranted()` returns false and the notification is skipped.

**How to avoid:** Always check-then-request pattern (shown in Pattern 6 above). On first download completion, the permission dialog will appear. Subsequent calls will use the granted state.

**Warning signs:** No notification on macOS dev build; no error thrown (the check-then-skip pattern suppresses errors).

### Pitfall 5: opener Plugin Rust Not Registered

**What goes wrong:** `revealItemInDir()` JS call throws `"invoke command not found"` error.

**Why it happens:** `@tauri-apps/plugin-opener` is already in `package.json` but `tauri-plugin-opener` is NOT in `Cargo.toml` and NOT registered in `lib.rs`. The JS side exists but Rust side is missing.

**How to avoid:** Add both `tauri-plugin-opener = "2"` to Cargo.toml AND `.plugin(tauri_plugin_opener::init())` to `lib.rs`. Also add `"opener:default"` to capabilities.

**Warning signs:** App compiles but `revealItemInDir` throws at runtime.

### Pitfall 6: History Store Growing Unbounded

**What goes wrong:** After months of use, `download-history.json` grows to thousands of entries, slowing app startup and store load.

**Why it happens:** No cap on history entries.

**How to avoid:** On each write, trim to last 500 entries sorted by `downloadedAt` descending.

---

## Code Examples

### Existing Pattern: Channel Streaming (reuse for playlist)
```rust
// Source: queue.rs — same Channel<DownloadEvent> pattern
on_event: tauri::ipc::Channel<DownloadEvent>,
// ...
let _ = on_event.send(DownloadEvent::Progress { percent, speed, eta });
```
The new `search_playlist` command uses `Channel<PlaylistTrackEvent>` identically.

### yt-dlp: Flat Playlist Print
```bash
# Source: yt-dlp man page (man.archlinux.org/man/extra/yt-dlp/yt-dlp.1.en)
yt-dlp --flat-playlist \
  --print "%(id)s\t%(title)s\t%(thumbnail)s\t%(duration_string)s\t%(channel)s" \
  --no-warnings \
  "PLAYLIST_URL"
# Output: one tab-separated line per track, streams as tracks are discovered
```

### yt-dlp: Metadata Override
```bash
# Source: yt-dlp man page + GitHub issue #12036
yt-dlp \
  --parse-metadata ":(?P<meta_title>User Supplied Title)" \
  --parse-metadata ":(?P<meta_artist>User Supplied Artist)" \
  --parse-metadata ":(?P<meta_album>User Supplied Album)" \
  --embed-metadata \
  -x --audio-format mp3 ...
```

### yt-dlp: Thumbnail Embed
```bash
# Source: yt-dlp man page, confirmed mutagen bundled in standalone binary
yt-dlp \
  --embed-thumbnail \
  --convert-thumbnails jpg \
  -x --audio-format mp3 ...
```

### yt-dlp: Playlist Items Selection
```bash
# Source: man.archlinux.org/man/extra/yt-dlp/yt-dlp.1.en
# Syntax: --playlist-items ITEM_SPEC
# Examples:
#   "1,3,5"       → items 1, 3, 5
#   "1:3"         → items 1 through 3
#   "1:3,7,-5::2" → items 1,2,3,7 and last 5 in steps of 2
# NOTE: For Phase 3 we don't use this flag — selective download is handled
# by frontend checkbox selection → ADD_ITEM to queue → queue_download per item.
# --playlist-items is only needed if we want to download a playlist slice in one yt-dlp call.
```

### Tauri notification: Full JS Pattern
```typescript
// Source: v2.tauri.app/plugin/notification/
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

async function notifyDownloadComplete(trackTitle: string) {
  let granted = await isPermissionGranted();
  if (!granted) {
    const result = await requestPermission();
    granted = result === 'granted';
  }
  if (granted) {
    sendNotification({ title: 'Download Complete', body: trackTitle });
  }
}
```

### Tauri opener: Reveal File
```typescript
// Source: v2.tauri.app/reference/javascript/opener/
import { revealItemInDir } from '@tauri-apps/plugin-opener';

// Opens Finder/Explorer with file selected
await revealItemInDir('/Users/jane/Music/song.mp3');
```

### capabilities/default.json (final state)
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-spawn",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        { "name": "binaries/yt-dlp", "sidecar": true },
        { "name": "binaries/ffmpeg", "sidecar": true }
      ]
    },
    "dialog:allow-open",
    "store:allow-load",
    "store:allow-set",
    "store:allow-get",
    "store:allow-save",
    "notification:default",
    "opener:default"
  ]
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `youtube-dl` thumbnail embedding required AtomicParsley | `yt-dlp` standalone bundles mutagen; ffmpeg handles most cases | ~2021 (yt-dlp fork) | No extra binary needed |
| Tauri v1 notification via `tauri::api::notification` | Tauri v2 `tauri-plugin-notification` separate crate | Tauri v2 (2024) | Explicit Cargo add + capabilities required |
| Tauri v1 shell `open` for file reveal | Tauri v2 `tauri-plugin-opener` `revealItemInDir` | Tauri v2 (2024) | Dedicated plugin; already partially installed in this project |
| yt-dlp `--playlist-start`/`--playlist-end` for range selection | `--playlist-items` with `[START]:[STOP][:STEP]` syntax | yt-dlp 2022+ | More flexible non-contiguous selection |

---

## Open Questions

1. **Playlist URL with `&list=` on video watch URLs**
   - What we know: `youtube.com/watch?v=X&list=PLY` contains `list=` — current detection logic would trigger playlist mode.
   - What's unclear: Should this be treated as single video or playlist? User intent is ambiguous.
   - Recommendation: Treat as single video (pass `--no-playlist`). Only `youtube.com/playlist?list=PLY` URLs trigger playlist mode. Add `/playlist?list=` as the detection condition instead of `list=` anywhere.

2. **`--parse-metadata` literal override — empty source field stability**
   - What we know: Syntax `:(?P<meta_title>Value)` works per community reports. Official man page documents the FROM:TO structure.
   - What's unclear: Whether yt-dlp's regex engine handles special characters in the "Value" portion (e.g., parentheses, colons in track titles).
   - Recommendation: URL-encode or escape special characters before building the parse-metadata argument. Test with edge-case titles before shipping.

3. **notification:default permission scope on Linux**
   - What we know: Linux desktop notifications use libnotify/dbus; behavior varies by desktop environment.
   - What's unclear: Whether the `notification:default` capability covers all Linux DE scenarios.
   - Recommendation: Test on Ubuntu GNOME in Phase 3 verification. Treat as best-effort on Linux (per existing scope — Linux is not a primary target).

---

## Sources

### Primary (HIGH confidence)
- [yt-dlp man page (Arch Linux)](https://man.archlinux.org/man/extra/yt-dlp/yt-dlp.1.en) — `--flat-playlist`, `--playlist-items` syntax, `--parse-metadata` FROM:TO format, `meta_` prefix, OUTPUT TEMPLATE variables
- [Tauri v2 Notification Plugin docs](https://v2.tauri.app/plugin/notification/) — complete setup, permissions, JS API
- [Tauri v2 Opener Plugin docs](https://v2.tauri.app/plugin/opener/) — `revealItemInDir`, `openPath` API
- [Tauri v2 Opener JS reference](https://v2.tauri.app/reference/javascript/opener/) — exact function signatures

### Secondary (MEDIUM confidence)
- [yt-dlp GitHub issue #12036](https://github.com/yt-dlp/yt-dlp/issues/12036) — literal `--parse-metadata` override confirmed working
- [yt-dlp GitHub issue #12804](https://github.com/yt-dlp/yt-dlp/issues/12804) — `--parse-metadata` field mapping examples (meta_ prefix pattern)
- WebSearch cross-reference: mutagen bundled in yt-dlp standalone binaries (yt-dlp_macos, yt-dlp.exe, yt-dlp_linux) — confirmed from multiple search results citing official yt-dlp README

### Tertiary (LOW confidence — verify in implementation)
- [Tauri plugins-workspace issue #3111](https://github.com/tauri-apps/plugins-workspace/issues/3111) — `revealItemInDir` path key bug (Nov 2025). Workaround documented above. Needs verification against current plugin version.
- `--convert-thumbnails jpg` recommendation for WebP compatibility — from community issues, not officially documented as required.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in official Tauri v2 docs, existing project patterns
- Architecture/yt-dlp flags: HIGH — verified against yt-dlp man page
- Metadata override syntax: MEDIUM — confirmed working in community reports; exact escaping behavior for special chars unverified
- Tauri plugin setup: HIGH — direct official docs
- Pitfalls: MEDIUM — playlist URL detection pitfall and WebP thumbnail issue are inferred from codebase reading + community reports

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (yt-dlp flags stable; Tauri plugin APIs stable on v2 track)
