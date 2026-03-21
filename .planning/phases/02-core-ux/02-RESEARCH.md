# Phase 2: Core UX — Research

**Researched:** 2026-03-22
**Domain:** YouTube API v3, yt-dlp search/preview, Tauri asset protocol, Tokio concurrency, React state management
**Confidence:** MEDIUM-HIGH (key areas verified with official docs; asset:// prod-build behavior partially LOW — documented gaps below)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Three tabs: `[SEARCH]` | `[QUEUE (N)]` | `[SETTINGS]`
**D-02:** Persistent player bar at the bottom across all tabs (always present when a preview is active; idle behavior at Claude's discretion — match the retro theme)
**D-03:** Queue tab shows a numeric badge with item count; exact trigger logic (total vs. pending-only) at Claude's discretion
**D-04:** Phase 1's `DownloadForm` URL-input component is **removed**. The queue system replaces all download UX — no direct-URL mode in Phase 2
**D-05:** Vertical list layout — each row: small thumbnail (left) + title, channel name, duration (right)
**D-06:** Each row has two action buttons: `[▶ Preview]` and `[+ Queue]`
**D-07:** When a row's track is previewing: results list stays visible unchanged; the bottom player bar activates and shows the now-playing state
**D-08:** When a row's track is already in the queue: show an "IN QUEUE" badge on the row; both `[▶ Preview]` and `[+ Queue]` buttons remain clickable
**D-09:** Before the first search (idle state): show a friendly retro text/illustration like `~ search for tunes ~`; Claude picks the exact copy and styling to match the Y2K theme
**D-10:** Queue item during download: progress bar fills the row with percentage and speed text overlay
**D-11:** Queue item states: Pending → Downloading % → Converting → Done ✓ / Error
**D-12:** Completed items stay in the queue marked `Done ✓`; a "Clear Done" button at the top lets users bulk-remove completed items
**D-13:** 429 rate-limit: item shows error state with the error message + a `[RETRY]` button; no auto-retry, user decides when to retry
**D-14:** "Download All" button skips Done items and starts only Pending/Errored items
**D-15:** Current download folder is shown at the top of the Queue tab: `Saving to: ~/Music  [change]` — clicking `[change]` navigates to the Settings tab
**D-16:** YouTube API key: password-style input masked by default, eye icon to show/hide, Save button alongside, shows `Saved ✓` confirmation on success
**D-17:** Download folder picker moved from Phase 1's `DownloadForm` to the Settings tab
**D-18:** When no API key is configured and yt-dlp fallback is active: show a banner above search results — `~ using yt-dlp fallback (no API key) ~` — tappable to navigate to Settings tab

**Architecture locks from STATE.md:**
- Dual-mode search: YouTube Data API v3 primary, yt-dlp `ytsearch5:` fallback
- Audio preview: temp-file approach (60s download to tmp, play via local asset protocol)
- `locate_sidecar()` from `download.rs` is the established pattern — any new yt-dlp/ffmpeg invocations must reuse it
- `DownloadEvent` enum defines IPC event shape — queue progress events should extend or reuse this pattern

### Claude's Discretion

- Exact player bar idle state (hidden vs. always-visible with dim message)
- Queue badge count logic (total vs. pending-only)
- Retro text/illustration copy for search idle state
- Exact spacing, animation, and color choices within the established Y2K theme variables

### Deferred Ideas (OUT OF SCOPE)

- Playlist URL input (PLAY-01–03) — Phase 3
- Custom filename pattern (TITLE-01–02) — Phase 3
- "Open in Finder/Explorer" after download (QOL-01) — v2 backlog
- Auto-retry on 429 with countdown (manual retry only in Phase 2)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-01 | Keyword search — show results list with thumbnail, title, channel, duration | YouTube API v3 + yt-dlp fallback both documented below |
| SRCH-02 | YouTube Data API v3 keyword search (user supplies API key) | API call shape, quota, response fields fully documented below |
| SRCH-03 | yt-dlp `ytsearch5:` fallback (no API key) | Exact command and JSON parsing documented below |
| SRCH-04 | URL direct-input loads single video | Two-step yt-dlp pattern from Phase 1 is reusable |
| SRCH-05 | API key stored in Settings via Tauri secure store | plugin-store usage documented; security note on plaintext below |
| PREV-01 | In-app audio preview (max 60 seconds) | Temp-file + asset:// pattern documented; prod-build gotchas flagged |
| PREV-02 | Temp-file approach (60s download to tmp dir, auto-delete after) | `--download-sections "*0-60"` yt-dlp flag confirmed |
| PREV-03 | Play/pause controls and progress indicator | HTML Audio element + React state; no external library needed |
| QUEUE-01 | Add search results to queue | `useReducer` state machine pattern documented |
| QUEUE-02 | "Download All" bulk download button | Semaphore + sequential task dispatch documented |
| QUEUE-03 | Per-item state: Pending → Downloading % → Converting → Done/Error | `useReducer` discriminated union pattern documented |
| QUEUE-04 | Max 2 concurrent downloads, 2s delay between starts | `Arc<Semaphore::new(2)>` + `tokio::time::sleep(2s)` pattern documented |
| QUEUE-05 | 429 backoff — show error + Retry button (no auto-retry) | Error detection from existing `parse_yt_dlp_line()` reusable |
| QUEUE-06 | Cancel individual queue item (kill child process) | `Arc<Mutex<HashMap<QueueId, u32>>>` PID registry pattern documented |
</phase_requirements>

---

## Summary

Phase 2 builds the complete core user loop: search → preview → queue → download. The Rust backend needs four new commands (`search`, `preview_start`, `queue_download`, `cancel_download`); the frontend needs a tab shell, search result list, audio player bar, and queue panel — all using the existing retro theme tokens.

**The single biggest risk** is the audio preview via `asset://` in a packaged `.app`/`.exe`. This works differently in `cargo tauri dev` vs a built bundle. The `tauri.conf.json` must declare `assetProtocol.enable: true` and an explicit scope that includes the system temp directory (`$TEMP/**`). The project's current config has `"csp": null` and no `assetProtocol` key — both must be added before preview can work in production. A macOS-specific symlink issue (`/var` → `/private/var`) requires using `$TEMP/**` as the scope (not a hardcoded path).

**For the YouTube API**, duration is NOT returned by `search.list` — it requires a second call to `videos.list?part=contentDetails`. Each `search.list` call costs 100 quota units (100 searches/day cap). The yt-dlp fallback uses `--print` lines in a specific format, not `--dump-json`, to avoid parsing large JSON objects for 5 results.

**Primary recommendation:** Implement search as two Rust commands — `search_youtube_api` (uses reqwest to call API v3) and `search_ytdlp` (spawns yt-dlp with `--print` for metadata) — called from a single frontend `search` function that tries API first, falls back to yt-dlp if no key is configured.

---

## Standard Stack

### Core (all already in project — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tauri-apps/api` | 2.10.1 (current) | `convertFileSrc`, `invoke` | Already installed |
| `@tauri-apps/plugin-store` | 2.4.2 (current) | API key persistence | Already installed |
| `@tauri-apps/plugin-dialog` | 2.6.0 (current) | Folder picker (Settings) | Already installed |
| `tokio` (Rust) | 1.x (current in Cargo.toml) | Semaphore, sleep, process | Already in `[dependencies]` |
| `reqwest` | 0.12 (current in Cargo.toml) | YouTube API v3 HTTP call | Already in `[dependencies]` |
| `serde_json` | 1 (current) | Parse yt-dlp JSON, API response | Already in `[dependencies]` |

### No New Dependencies Required

All required functionality is achievable with the existing stack. No new npm packages or Cargo crates are needed for Phase 2.

**Exception to watch for:** If OS-keychain storage is required for the API key, `tauri-plugin-keyring` (community) would be needed. Research conclusion: `plugin-store` (plaintext JSON on disk) is acceptable for a user-supplied YouTube API key — it is not a token with server-side privilege escalation risk. Document this tradeoff in the Settings UI ("Your API key is stored locally in plain text").

**Version verification:**
```bash
npm view @tauri-apps/plugin-store version  # → 2.4.2
npm view @tauri-apps/api version           # → 2.10.1
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── TabBar.tsx           # Three-tab nav, queue badge
│   ├── SearchTab.tsx        # Search input + result list
│   ├── SearchResultRow.tsx  # Thumbnail + title/channel/duration + buttons
│   ├── QueueTab.tsx         # Queue list + Download All + Clear Done
│   ├── QueueItem.tsx        # Per-item row with inline progress bar
│   ├── PlayerBar.tsx        # Bottom audio preview bar (play/pause/progress)
│   ├── SettingsTab.tsx      # API key input + folder picker
│   ├── ProgressBar.tsx      # (existing — reuse in QueueItem)
│   └── ErrorBanner.tsx      # (existing — reuse in QueueTab)
src-tauri/src/
├── search.rs                # search_youtube_api + search_ytdlp commands
├── preview.rs               # preview_start + preview_stop commands
├── queue.rs                 # queue_download + cancel_download commands
├── download.rs              # (existing — reuse locate_sidecar, DownloadEvent)
├── state.rs                 # Extend AppState: preview_pid, queue_pids HashMap
└── lib.rs                   # Register new commands in invoke_handler!
```

### Pattern 1: Dual-Mode Search (SRCH-01, SRCH-02, SRCH-03)

**What:** Frontend calls `invoke("search", { query })`. Rust checks if API key is stored; if yes, calls YouTube API v3; if no (or API fails), falls back to yt-dlp.

**YouTube API v3 call shape:**
```
GET https://www.googleapis.com/youtube/v3/search
  ?part=snippet
  &q={query}
  &type=video
  &maxResults=10
  &key={api_key}
```

Response fields from `items[].snippet`: `title`, `channelTitle`, `thumbnails.medium.url`, `publishedAt`. The video ID is at `items[].id.videoId`.

**Duration requires a second call** (snippet does NOT include duration):
```
GET https://www.googleapis.com/youtube/v3/videos
  ?part=contentDetails
  &id={comma-separated-videoIds}
  &key={api_key}
```

Response: `items[].contentDetails.duration` — ISO 8601 format `PT4M13S`. Parse with regex `PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?`.

**Quota cost:** `search.list` = 100 units/call. `videos.list` = 1 unit/call. With 10,000 units/day default: 99 combined search+duration calls per day before quota exhaustion.

**yt-dlp fallback command:**
```bash
yt-dlp \
  --print "%(id)s\t%(title)s\t%(thumbnail)s\t%(duration_string)s\t%(channel)s" \
  --flat-playlist \
  --no-warnings \
  --no-playlist \
  "ytsearch5:{query}"
```

Each result is one line, tab-separated. Parse in Rust: split on `\t`, fields are `[id, title, thumbnail, duration_string, channel]`. No JSON overhead.

**Why `--print` not `--dump-json`:** `--dump-json` emits a full JSON object per result (tens of KB including all format metadata). For search results we only need 5 fields. `--print` with a template emits one compact line per result.

### Pattern 2: Audio Preview via Asset Protocol (PREV-01, PREV-02, PREV-03)

**What:** Rust downloads first 60 seconds to a temp file, returns the absolute path. Frontend converts to `asset://` URL and plays via `<audio>` element.

**Rust side — preview_start command:**
```rust
// Source: locate_sidecar() pattern from download.rs
let ytdlp = locate_sidecar("yt-dlp")?;
let ffmpeg = locate_sidecar("ffmpeg")?;
let tmp_path = std::env::temp_dir().join(format!("preview_{}.mp3", video_id));

Command::new(&ytdlp)
    .args([
        "--download-sections", "*0-60",
        "-x", "--audio-format", "mp3",
        "--ffmpeg-location", ffmpeg.to_str().unwrap(),
        "-o", tmp_path.to_str().unwrap(),
        &video_url,
    ])
    .status()
    .await?;

Ok(tmp_path.to_str().unwrap().to_string())
```

**Frontend side — convert path to playable URL:**
```typescript
// Source: @tauri-apps/api/core (NOT @tauri-apps/api/tauri — that is v1 path)
import { convertFileSrc } from "@tauri-apps/api/core";

const previewPath = await invoke<string>("preview_start", { videoId, videoUrl });
const audioUrl = convertFileSrc(previewPath);
audioRef.current.src = audioUrl;
audioRef.current.play();
```

**Required tauri.conf.json changes (CRITICAL — without these, packaged build produces silence or 403):**
```json
"app": {
  "security": {
    "csp": "default-src 'self'; media-src 'self' asset: http://asset.localhost; img-src 'self' asset: http://asset.localhost https: data:",
    "assetProtocol": {
      "enable": true,
      "scope": ["$TEMP/**", "$TEMP/**/*"]
    }
  }
}
```

**macOS temp dir symlink gotcha (VERIFIED):** On macOS, `std::env::temp_dir()` returns `/var/folders/...`. `/var` is a symlink to `/private/var`. Tauri's scope validator canonicalizes the incoming URL path but may compare against the unresolved configured scope path, causing 403. Mitigation: use `$TEMP/**` (Tauri resolves the variable at runtime with canonical path) rather than a hardcoded path. If 403 still occurs in testing, fall back to scope `["**"]` as a debug step to confirm the issue is scope-related.

**Temp file cleanup:** After `audioRef.current.ended` event fires (or user starts new preview), call `invoke("preview_stop")` which deletes the temp file. Also clean up on app exit in the exit handler in `lib.rs`.

### Pattern 3: Queue State Machine with useReducer (QUEUE-01–03)

**What:** A single `useReducer` manages the entire queue array. Each item has a typed status discriminated union. Actions update individual items by ID.

```typescript
// Source: React docs + standard discriminated union pattern
type QueueItemStatus =
  | { type: 'pending' }
  | { type: 'downloading'; percent: number; speed: string }
  | { type: 'converting' }
  | { type: 'done'; path: string }
  | { type: 'error'; message: string };

interface QueueItem {
  id: string;           // YouTube video ID — also dedup key
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: string;
  status: QueueItemStatus;
}

type QueueAction =
  | { type: 'ADD_ITEM'; item: Omit<QueueItem, 'status'> }
  | { type: 'UPDATE_STATUS'; id: string; status: QueueItemStatus }
  | { type: 'CLEAR_DONE' };

function queueReducer(state: QueueItem[], action: QueueAction): QueueItem[] {
  switch (action.type) {
    case 'ADD_ITEM':
      if (state.some(i => i.id === action.item.id)) return state; // dedup
      return [...state, { ...action.item, status: { type: 'pending' } }];
    case 'UPDATE_STATUS':
      return state.map(i => i.id === action.id ? { ...i, status: action.status } : i);
    case 'CLEAR_DONE':
      return state.filter(i => i.status.type !== 'done');
    default:
      return state;
  }
}
```

**Why `useReducer` not `useState`:** Queue has 6 distinct action types and per-item updates that need to be processed atomically. `useReducer` keeps all queue logic in one testable pure function. `useState` with a functional update would work but becomes harder to reason about as actions multiply.

**Why not Zustand:** Zustand is appropriate when state is shared across many deeply nested components. The queue lives in one parent component (`App` or `QueueTab`) and passes down props. No library needed.

### Pattern 4: Bounded Concurrency with Tokio Semaphore (QUEUE-04)

**What:** `Arc<Semaphore::new(2)>` stored in `AppState`. Each queue download task acquires a permit before spawning yt-dlp. 2-second delay is inserted after acquiring the permit.

```rust
// Source: docs.rs/tokio/latest/tokio/sync/struct.Semaphore.html
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::time::{sleep, Duration};

// In AppState:
pub download_semaphore: Arc<Semaphore>,

// In AppState::default():
download_semaphore: Arc::new(Semaphore::new(2)),

// In queue_download command:
pub async fn queue_download(app: AppHandle, item_id: String, ...) -> Result<(), String> {
    let state = app.state::<AppState>();
    let sem = state.download_semaphore.clone();
    let _permit = sem.acquire_owned().await
        .map_err(|_| "semaphore closed")?;
    // 2-second delay between starts (after acquiring permit, not before)
    sleep(Duration::from_secs(2)).await;
    // spawn yt-dlp child process...
    // permit drops automatically when this function returns
}
```

**Note:** Each `queue_download` call is already async (Tauri command), so holding the permit across the entire download is correct — it is released when the command future completes.

### Pattern 5: Multi-PID Cancel Registry (QUEUE-06)

**What:** Replace `AppState.active_pid: Mutex<Option<u32>>` with `queue_pids: Mutex<HashMap<String, u32>>` where key is queue item ID.

```rust
// In state.rs — extended AppState
pub struct AppState {
    pub active_pid: Mutex<Option<u32>>,          // keep for Phase 1 download compat
    pub queue_pids: Mutex<HashMap<String, u32>>, // queue item id → child PID
    pub preview_pid: Mutex<Option<u32>>,          // preview child PID
    pub download_semaphore: Arc<Semaphore>,
}

// cancel_download command:
#[tauri::command]
pub async fn cancel_download(app: AppHandle, item_id: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let pid_opt = state.queue_pids.lock().unwrap().remove(&item_id);
    if let Some(pid) = pid_opt {
        #[cfg(unix)]
        unsafe { libc::kill(pid as libc::pid_t, libc::SIGTERM); }
        #[cfg(windows)]
        { let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .status(); }
    }
    Ok(())
}
```

**Exit handler extension:** The `lib.rs` exit handler must iterate `queue_pids` and kill all registered PIDs (same pattern as existing single-PID handler).

**`std::sync::Mutex` vs `tokio::sync::Mutex`:** Use `std::sync::Mutex` for the PID HashMap (consistent with existing `active_pid`). The lock is only held briefly for `insert`/`remove` — never across `.await` — so standard mutex is correct and avoids the overhead of async mutex.

### Pattern 6: Tab Navigation (D-01 through D-04)

**What:** Three-tab layout controlled by `useState<'search' | 'queue' | 'settings'>` in `App.tsx`. No router needed.

```typescript
type Tab = 'search' | 'queue' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [queue, dispatch] = useReducer(queueReducer, []);
  const [previewTrack, setPreviewTrack] = useState<PreviewTrack | null>(null);

  const pendingCount = queue.filter(i =>
    i.status.type === 'pending' || i.status.type === 'downloading' || i.status.type === 'converting'
  ).length;

  return (
    <div className="app-container">
      <TabBar active={activeTab} onSwitch={setActiveTab} queueBadge={pendingCount} />
      {activeTab === 'search' && <SearchTab dispatch={dispatch} queue={queue} onNavigateSettings={() => setActiveTab('settings')} />}
      {activeTab === 'queue' && <QueueTab queue={queue} dispatch={dispatch} onNavigateSettings={() => setActiveTab('settings')} />}
      {activeTab === 'settings' && <SettingsTab />}
      <PlayerBar track={previewTrack} onClose={() => setPreviewTrack(null)} />
    </div>
  );
}
```

**Queue badge:** Show count of non-done, non-error items (pending + downloading + converting). This reflects "work in progress" which is most useful at a glance.

### Pattern 7: API Key Storage with plugin-store (SRCH-05)

**plugin-store is unencrypted** (stores JSON in the app cache dir). For a user-supplied YouTube API key this is acceptable — the key only permits read access to public YouTube data, not account access. The Settings UI should note this.

```typescript
// Source: v2.tauri.app/plugin/store/ + project's known working pattern
import { load } from '@tauri-apps/plugin-store';

const store = await load('settings.json', { autoSave: false });

// Save API key
await store.set('youtube_api_key', apiKey);
await store.save();

// Read API key
const key = await store.get<string>('youtube_api_key');
```

**Important — from STATE.md (already confirmed in Phase 1):** `StoreOptions` requires `defaults: {}` — do NOT pass `autoSave: true`. Use `{ autoSave: false }` and call `.save()` explicitly.

**Confirmed working pattern:** `load('settings.json', { autoSave: false })` — the store file name can be the same as Phase 1's folder-persistence store if they already share one, or a separate `settings.json`.

### Anti-Patterns to Avoid

- **Parsing `--dump-json` for search results:** Produces tens of KB per result including format arrays. Use `--print` template instead.
- **Using `file://` directly in `<audio src>`:** Tauri v2 WebView does not allow direct `file://` access from the webview. Must use `convertFileSrc()` to get `asset://` URL.
- **Hardcoding `/tmp/` in asset protocol scope:** On macOS `/tmp` → `/private/var/...`. Use `$TEMP/**` variable instead.
- **Holding `std::sync::Mutex` across `.await`:** The queue PID map lock must be acquired, used, and dropped before any `.await`. Never `let _guard = lock.lock().await` pattern on a sync mutex in async code.
- **Single `queue_download` command with a loop inside:** Each queue item should be its own invoked command call so the semaphore works naturally. Do NOT try to sequence all downloads inside one long-running Rust command.
- **`autoSave: true` in plugin-store:** Causes a panic in plugin-store 2.4.2. Use `autoSave: false` + explicit `.save()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent task limiting | Custom counter + Mutex | `tokio::sync::Semaphore` | RAII permit drop handles release correctly in all exit paths including panics |
| YouTube duration parsing | Custom ISO 8601 parser | Regex `PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?` (4 lines) | Simple enough to inline; no library needed |
| Search result deduplication | Complex ID tracking | `state.some(i => i.id === action.item.id)` in reducer | The video ID from YouTube is already a unique key |
| Audio progress tracking | WebAudio API | `<audio>` element `ontimeupdate` event | WebAudio API has known bugs on macOS WKWebView (Safari engine) |
| Tab state routing | React Router | `useState<Tab>` | No URL routing needed in a desktop app with 3 tabs |
| Child process kill (Windows) | Native Windows API | `taskkill /PID {pid} /F` (already in lib.rs) | Pattern already established in codebase |

**Key insight:** This phase's complexity lives in coordination (semaphore, cancel registry, state machine) not in algorithms. The standard Tokio and React primitives are sufficient — no new libraries.

---

## Common Pitfalls

### Pitfall 1: Asset Protocol 403 in Packaged Build

**What goes wrong:** Preview audio plays in `cargo tauri dev` but produces silence (or 403 logged to console) in the built `.app` / `.exe`.

**Why it happens:** In dev mode, Tauri's WebView can reach `asset://` paths more permissively. In production, the asset protocol scope in `tauri.conf.json` is strictly enforced. The current project config has `"csp": null` and no `assetProtocol` key — both must be added.

**How to avoid:** Add to `tauri.conf.json` before any preview testing:
```json
"app": {
  "security": {
    "csp": "default-src 'self'; media-src 'self' asset: http://asset.localhost; img-src 'self' asset: http://asset.localhost https: data:",
    "assetProtocol": { "enable": true, "scope": ["$TEMP/**", "$TEMP/**/*"] }
  }
}
```

**Warning signs:** Audio element `error` event fires; browser console shows `Not allowed to load local resource` or HTTP 403.

**macOS extra step:** If 403 persists, the `/var` → `/private/var` symlink resolution issue may be active. Add `"/private/var/**"` to scope as a belt-and-suspenders addition.

### Pitfall 2: YouTube Search Duration Missing

**What goes wrong:** `search.list?part=snippet` response has no `duration` field. Result rows show empty duration.

**Why it happens:** Duration lives in `contentDetails`, which is NOT available on `search.list`. This is a documented limitation — a feature request has been open on Google's issue tracker since 2013 (issue #35170788).

**How to avoid:** Always do a second `videos.list?part=contentDetails&id={ids}` call after `search.list`. Batch all video IDs from one search response into a single `videos.list` call (comma-separated, up to 50 IDs). Total cost: 100 + 1 = 101 units per search (still well under 10,000/day limit for normal use).

**Warning signs:** Duration column always blank on search results.

### Pitfall 3: yt-dlp Fallback Rate Limiting on Rapid Searches

**What goes wrong:** Rapid sequential test searches with yt-dlp fallback trigger YouTube's bot detection, producing 429 or bot-check errors even for search operations (not just downloads).

**Why it happens:** yt-dlp `ytsearch5:` queries hit the public YouTube search page. Rapid requests from the same IP look like a bot.

**How to avoid:** In the search input, add a 500ms debounce before firing the search. Do NOT fire a new search on every keystroke. The user must press Enter or click a Search button for the yt-dlp path.

**Warning signs:** yt-dlp outputs `Sign in to confirm you're not a bot` or HTTP 429 for search.

### Pitfall 4: PID Store Race — Kill After Process Exits

**What goes wrong:** User cancels a download that just finished. The PID was removed from the HashMap when the process exited naturally, but the cancel command tries to kill a now-dead PID (or a recycled PID belonging to a different process).

**Why it happens:** There is a window between process exit and PID removal from the HashMap.

**How to avoid:** In the cancel command, `.remove()` from the HashMap returns `Option<u32>`. If `None`, the item already completed — send a no-op response. On Unix, `kill(pid, SIGTERM)` on an already-dead PID returns `ESRCH` (no such process) which is safe to ignore. On Windows, `taskkill /F` on a dead PID exits with error code 128 which can be ignored.

### Pitfall 5: store.get() Returns null Before First Save

**What goes wrong:** On first launch, `store.get<string>('youtube_api_key')` returns `null` (no key yet). Code that assumes a string causes a runtime error.

**Why it happens:** plugin-store returns `null` for keys that have never been set.

**How to avoid:** Always type-check: `const key = await store.get<string | null>('youtube_api_key')`. Treat `null` as "no API key configured" → activate yt-dlp fallback mode.

### Pitfall 6: yt-dlp --print Output Order Not Guaranteed for Slow Networks

**What goes wrong:** `--print` lines arrive out of order for results that resolve at different speeds.

**Why it happens:** yt-dlp fetches metadata for each `ytsearch5:` result in parallel internally. Slow-loading results arrive later than faster ones.

**How to avoid:** Collect all stdout lines until EOF (process exit), then parse all at once. Do NOT stream individual `--print` lines as they arrive and update UI — wait for the process to complete, then display all 5 results together.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### YouTube API v3 Duration Fetch (Rust + reqwest)

```rust
// Source: developers.google.com/youtube/v3/docs/videos + existing reqwest usage in updater.rs
#[derive(serde::Deserialize)]
struct VideoListResponse {
    items: Vec<VideoItem>,
}
#[derive(serde::Deserialize)]
struct VideoItem {
    id: String,
    #[serde(rename = "contentDetails")]
    content_details: ContentDetails,
}
#[derive(serde::Deserialize)]
struct ContentDetails {
    duration: String, // "PT4M13S"
}

async fn fetch_durations(api_key: &str, video_ids: &[&str]) -> reqwest::Result<HashMap<String, String>> {
    let ids = video_ids.join(",");
    let url = format!(
        "https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id={}&key={}",
        ids, api_key
    );
    let resp: VideoListResponse = reqwest::get(&url).await?.json().await?;
    Ok(resp.items.into_iter().map(|v| (v.id, v.content_details.duration)).collect())
}
```

### ISO 8601 Duration to Display String (Rust)

```rust
// Parse "PT4M13S" → "4:13", "PT1H2M3S" → "1:02:03"
fn parse_iso8601_duration(s: &str) -> String {
    let re = regex::Regex::new(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?").unwrap();
    if let Some(caps) = re.captures(s) {
        let h = caps.get(1).map_or(0, |m| m.as_str().parse::<u32>().unwrap_or(0));
        let m = caps.get(2).map_or(0, |m| m.as_str().parse::<u32>().unwrap_or(0));
        let sec = caps.get(3).map_or(0, |m| m.as_str().parse::<u32>().unwrap_or(0));
        if h > 0 {
            return format!("{}:{:02}:{:02}", h, m, sec);
        }
        return format!("{}:{:02}", m, sec);
    }
    s.to_string()
}
```

### yt-dlp Search Fallback Command (Rust)

```rust
// Source: yt-dlp docs + locate_sidecar pattern from download.rs
pub async fn search_ytdlp(query: &str) -> Result<Vec<SearchResult>, String> {
    let ytdlp = locate_sidecar("yt-dlp")?;
    let output = Command::new(&ytdlp)
        .args([
            "--print", "%(id)s\t%(title)s\t%(thumbnail)s\t%(duration_string)s\t%(channel)s",
            "--flat-playlist",
            "--no-warnings",
            &format!("ytsearch5:{}", query),
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.lines()
        .filter(|line| !line.is_empty())
        .map(|line| {
            let parts: Vec<&str> = line.splitn(5, '\t').collect();
            if parts.len() < 5 { return Err(format!("unexpected line: {}", line)); }
            Ok(SearchResult {
                id: parts[0].to_string(),
                title: parts[1].to_string(),
                thumbnail_url: parts[2].to_string(),
                duration: parts[3].to_string(),
                channel: parts[4].to_string(),
            })
        })
        .collect()
}
```

### convertFileSrc Import Path (TypeScript)

```typescript
// CORRECT in Tauri v2 — import from core, NOT from tauri
import { convertFileSrc } from "@tauri-apps/api/core";

// Convert absolute path returned by Rust to asset:// URL
const audioUrl = convertFileSrc("/private/var/.../preview_abc123.mp3");
// → "asset://localhost/%2Fprivate%2Fvar%2F...%2Fpreview_abc123.mp3" on macOS
```

### HTML Audio Playback with Progress (React)

```typescript
// No library needed — native HTMLAudioElement API
const audioRef = useRef<HTMLAudioElement>(new Audio());

useEffect(() => {
  const audio = audioRef.current;
  const onTimeUpdate = () => setProgress(audio.currentTime / (audio.duration || 1));
  const onEnded = () => { setIsPlaying(false); invoke("preview_stop"); };
  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('ended', onEnded);
  return () => {
    audio.removeEventListener('timeupdate', onTimeUpdate);
    audio.removeEventListener('ended', onEnded);
  };
}, []);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `file://` for local audio in Tauri | `convertFileSrc()` → `asset://` | Tauri v1 → v2 | Must configure `assetProtocol` in tauri.conf.json |
| `@tauri-apps/api/tauri` import | `@tauri-apps/api/core` import | Tauri v2.0 | `convertFileSrc` moved to `core` namespace |
| yt-dlp progress on stdout | Progress on stderr (since ~2022) | yt-dlp ~2022 | Already handled in download.rs — same applies to new commands |
| `search.list` returns duration | Two-step: search + videos.list | Always this way | Must always batch a second API call for duration |

**Deprecated/outdated:**
- `import { convertFileSrc } from "@tauri-apps/api/tauri"`: Tauri v1 path. In v2 use `@tauri-apps/api/core`.
- `autoSave: true` in plugin-store StoreOptions: Causes panic in plugin-store 2.4.2. Use `autoSave: false`.
- `tauri-plugin-stronghold`: Documentation states still maintained as of Dec 2025, but community discussion notes it will be removed in v3. Avoid for new work — use plugin-store for non-critical secrets, OS keyring via community plugin for critical ones.

---

## Open Questions

1. **macOS `/var` symlink and asset:// scope**
   - What we know: `/var/folders/...` is returned by `std::env::temp_dir()` on macOS; Tauri canonicalizes at runtime.
   - What's unclear: Whether `$TEMP/**` scope variable in Tauri v2 correctly resolves to `/private/var/...` at runtime, or if additional `/private/var/**` entry is also needed.
   - Recommendation: Test in packaged build immediately after adding `assetProtocol` config. If 403, add `"/private/var/**"` to scope array.

2. **yt-dlp thumbnail URL stability for search fallback**
   - What we know: `%(thumbnail)s` in yt-dlp `--print` output returns a YouTube CDN URL (e.g. `https://i.ytimg.com/vi/.../hqdefault.jpg`).
   - What's unclear: How stable these URLs are — they may expire or differ between yt-dlp versions.
   - Recommendation: Use them directly in `<img src>`. If they fail to load, show a placeholder. The CSP `img-src` must include `https:` to allow external thumbnail URLs.

3. **QUEUE-05 backoff specification vs. CONTEXT.md D-13**
   - What we know: REQUIREMENTS.md QUEUE-05 says "exponential backoff (30s → 60s → 120s)". CONTEXT.md D-13 says "no auto-retry, user decides when to retry."
   - What's unclear: Whether the 30s/60s/120s values are informational (show wait time to user) or functional (auto-wait then retry).
   - Recommendation: D-13 (locked decision) overrides QUEUE-05 requirement text. Implement as: show error with `[RETRY]` button. Optionally display the suggested wait time in the error message ("YouTube rate-limited. Try again in 30s") but do not auto-retry.

---

## Sources

### Primary (HIGH confidence)
- [developers.google.com/youtube/v3/docs/search/list](https://developers.google.com/youtube/v3/docs/search/list) — search.list quota (100 units), part=snippet fields
- [developers.google.com/youtube/v3/docs/videos](https://developers.google.com/youtube/v3/docs/videos) — contentDetails.duration for video list
- [docs.rs/tokio/latest/tokio/sync/struct.Semaphore.html](https://docs.rs/tokio/latest/tokio/sync/struct.Semaphore.html) — Semaphore acquire_owned() pattern
- [v2.tauri.app/plugin/store/](https://v2.tauri.app/plugin/store/) — plugin-store JS API, StoreOptions
- `src-tauri/src/download.rs` (project) — locate_sidecar(), DownloadEvent enum, child PID pattern
- `src-tauri/src/state.rs` (project) — existing AppState to extend
- `src-tauri/capabilities/default.json` (project) — current permission set (no assetProtocol yet)
- `src-tauri/tauri.conf.json` (project) — no assetProtocol config currently

### Secondary (MEDIUM confidence)
- [github.com/tauri-apps/tauri/discussions/11498](https://github.com/tauri-apps/tauri/discussions/11498) — asset protocol v2 usage, hidden folder scope gotcha
- [github.com/tauri-apps/tauri/issues/9648](https://github.com/tauri-apps/tauri/issues/9648) — 403 fix for asset protocol, CSP + enable config
- [github.com/orgs/tauri-apps/discussions/12678](https://github.com/orgs/tauri-apps/discussions/12678) — convertFileSrc() correct import path in v2
- [github.com/tauri-apps/tauri/issues/6256](https://github.com/tauri-apps/tauri/issues/6256) — macOS /var → /private/var symlink issue
- WebSearch verified: $TEMP, $APPDATA and other FsScope path variables listed in Tauri v2 scope docs

### Tertiary (LOW confidence — flag for validation)
- yt-dlp `--print` with `--flat-playlist` and `ytsearch5:` tab-separated output: Verified against yt-dlp man page description but not tested against the bundled binary version. Confirm with a manual run: `./binaries/yt-dlp --print "%(id)s\t%(title)s" --flat-playlist "ytsearch3:test"`.
- Asset protocol working in production build with `$TEMP/**` scope: No confirmed working repro found in official docs — only community reports. Must test in a real `cargo tauri build` before shipping.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all are already installed and used in Phase 1
- YouTube API v3 search shape: HIGH — verified against official Google API docs
- yt-dlp fallback command: MEDIUM — verified against man page; exact `--print` + `--flat-playlist` combination should be smoke-tested against bundled binary
- asset:// audio preview prod-build: MEDIUM/LOW — pattern is documented but the $TEMP scope + macOS symlink interaction is a known fragile area with incomplete official documentation
- Tokio semaphore pattern: HIGH — official docs with code example
- React useReducer pattern: HIGH — standard documented React pattern
- plugin-store API: HIGH — official Tauri docs + confirmed working in Phase 1

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (yt-dlp API evolves; YouTube quota limits are stable but confirm in Google Cloud Console)
