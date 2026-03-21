# Feature Research

**Domain:** YouTube music downloader desktop app (Tauri v2, yt-dlp backend)
**Researched:** 2026-03-21
**Confidence:** MEDIUM (training data; web verification unavailable — flag for validation)

---

## Competitive Landscape Overview

Tools analyzed from training data (as of August 2025):

- **yt-dlp** (CLI): The de-facto download engine. Highly capable, no GUI.
- **spotdl**: Spotify-matched YouTube downloader. Strong metadata; limited search UX.
- **Parabolic** (GNOME): GTK4 yt-dlp GUI. Clean queue UI; no search; URL-only.
- **Tartube**: Feature-rich yt-dlp GUI. Extremely complex UI; steep learning curve.
- **yt-dlg (youtube-dl-gui)**: Abandoned/unmaintained. Bare-bones.
- **Downie** (macOS, paid): Polished native UX. No search; URL-paste workflow only.
- **4K Video Downloader**: Polished but paid/limited free. URL-paste; limited metadata.
- **MusicBrainz Picard**: Standalone tag editor. Excellent ID3 handling; not a downloader.

**Verdict on the gap:** Every serious tool is either (a) CLI-only, (b) URL-paste-only with no search, or (c) bloated/ugly. A tool that combines in-app search + preview + queue + clean metadata in a desirable UI has no strong competitor in the GUI space.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| URL-paste single download | Lowest-friction path; every tool has it | LOW | yt-dlp handles format selection; Tauri invokes via sidecar |
| Progress bar per download | Users need feedback during potentially slow operations | LOW | yt-dlp `--progress` outputs parseable stdout; pipe to frontend |
| Save-to-folder dialog | Basic file hygiene; users don't want files dumped to Desktop | LOW | Tauri `dialog::open` API; persist last-used path in config |
| MP3 output (192kbps+) | "MP3" is the expected output format for music | LOW | yt-dlp `--audio-format mp3 --audio-quality 0` via ffmpeg |
| Basic ID3 tag writing | Title, artist, year — minimum for music library integration | MEDIUM | yt-dlp `--embed-metadata` writes from YouTube metadata; often messy |
| Filename sanitization | Brackets, colons, pipes in YouTube titles break filesystems | LOW | Strip `[Official MV]`, `(Official Audio)`, special chars; yt-dlp `--restrict-filenames` is too aggressive |
| Duplicate detection | Re-downloading wastes time; users notice | MEDIUM | Compare output filename before invoking yt-dlp; warn user |
| Error messaging | Silent failures are worse than ugly errors | LOW | Parse yt-dlp stderr for known error codes; surface human-readable messages |

### Differentiators (Competitive Advantage)

Features that set this product apart. Tied to the core value: search → preview → queue → download.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| In-app keyword search | Eliminates the "open YouTube → copy URL → paste" loop that every competitor requires | MEDIUM | YouTube Data API v3 (requires key) or yt-dlp `ytsearch10:query` (no key, slower, less metadata) |
| In-app audio preview | Lets users verify they have the right track before downloading | MEDIUM | Stream via yt-dlp `--get-url` + audio element, OR use YouTube iframe API for 30s; see pitfalls |
| Cart-style queue (multi-select) | "Add to queue, download all at once" is how power users think about batch work | MEDIUM | Frontend state management; yt-dlp invoked sequentially or with limited parallelism |
| Playlist URL → selective download | Power users want to grab 3 tracks from a 50-track playlist, not all | HIGH | yt-dlp `--playlist-items` supports ranges and indices; UI needs checklist with select-all |
| Title auto-cleanup rules | YouTube titles are garbage; automatic stripping of `[Official MV]`, `(Lyrics)`, etc. | LOW | Regex pipeline; show preview of cleaned title before download |
| Custom filename template | `{artist} - {title}` patterns — power users want library consistency | LOW | Token substitution on top of yt-dlp `--output` template; expose subset of yt-dlp tokens |
| Download history / dedup | "Have I already downloaded this?" — prevents re-download clutter | MEDIUM | SQLite or JSON log of video IDs + output paths; check before queuing |
| Metadata editor before save | Edit title/artist/album before writing ID3 tags — catch bad YouTube metadata | MEDIUM | Editable fields in queue item; write corrected values via yt-dlp `--postprocessor-args` or mutagen post-process |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Concurrent batch downloads (>3 parallel) | "Faster!" | yt-dlp parallel downloads frequently hit YouTube rate limits and IP throttling; results in partial files and cryptic errors | Serial queue with clear progress; optionally 2-3 concurrent with exponential backoff |
| Full YouTube video playback preview | "I want to see the video" | Scope creep; adds video rendering complexity; this is a music tool | 30-60 second audio-only preview via streaming URL |
| Spotify / Apple Music integration | "Import my playlist" | Requires OAuth flows, API keys, separate matching logic (spotdl does this but it's fragile); out of scope per PROJECT.md | Accept Spotify track names as search queries; manual paste |
| Account/login for YouTube | "Access private playlists" | Requires cookie handling, YouTube ToS complications, security surface | Document `--cookies-from-browser` workaround for power users; don't build UI for it |
| MP4/video download | Seems related | Explicitly out of scope; adds format complexity and doubles storage expectations | Show clear "audio only" messaging upfront |
| Auto-update of downloaded files | "Re-download when source changes" | Extremely complex; YouTube videos get deleted, reuploaded; metadata changes don't map cleanly | Offer "re-download" on individual items from history |
| Built-in equalizer / audio processing | "Enhance my music" | Completely different product domain; heavy DSP library requirement | Let users use their media player for this |

---

## Detailed UX Pattern Analysis

### Search UX

**What works (from CLI tool patterns and competitor gaps):**

- **Hybrid input field**: Single input that detects whether user pasted a URL or typed a search query. URL detection via regex (`https?://`). This removes friction of choosing a mode.
- **Debounced search-as-you-type** with min 3 chars and 400ms delay — standard for music search (used by Spotify, YouTube Music). Avoids hammering the API.
- **Results card layout**: Thumbnail + title + channel + duration + view count. Duration is critical — distinguishes "3:42 song" from "3:42:00 livestream".
- **YouTube Data API v3** gives richer results (proper view counts, publish dates, channel verification). yt-dlp `ytsearch:` is a fallback when no API key is configured — slower, fewer metadata fields.
- **Confidence: MEDIUM** — API v3 behavior verified from training; current rate limits and quotas should be re-verified.

**What existing tools do poorly:**

- Tartube requires URL input only — no search at all.
- Parabolic is URL-paste only.
- spotdl does search but only via Spotify-to-YouTube matching, not free-text YouTube search.

### Queue / Batch Download Management

**What works:**

- **Cart metaphor**: "Add to queue" button on each search result. Queue panel (sidebar or bottom drawer) shows pending items. One "Download All" button.
- **Item-level controls**: Remove individual item, re-order (drag handles), edit metadata per-item.
- **Status per item**: Pending → Downloading (with % progress) → Done / Error. Color-coded.
- **Persistent queue**: If app is closed mid-download, queue state should survive restart (local JSON or SQLite). Completed items stay in list as history.
- **Concurrency control**: Default to 2 concurrent; expose setting for 1-4. Above 4 is anti-pattern.

**What existing tools do poorly:**

- 4K Video Downloader queue is opaque — no per-item status until complete.
- yt-dlg has no queue concept; one URL at a time.
- Tartube has queuing but the UI is overwhelming (too many columns, too many options exposed).

### Playlist Handling

**What works:**

- Paste playlist URL → fetch metadata (title, track count, thumbnail) → show checklist of all tracks with checkboxes.
- **Select all / deselect all** toggle. Select a range.
- Show which tracks are already in history (greyed out with "downloaded" badge).
- Start download with only selected tracks using yt-dlp `--playlist-items`.

**What existing tools do poorly:**

- Most tools either download ALL or ONE — no selective playlist UI.
- yt-dlp CLI does support `--playlist-items 1,3,5-8` but no GUI exposes this cleanly.
- Fetching playlist metadata can be slow (100+ item playlists); needs async loading with skeleton UI, not a spinner that blocks the whole window.

### Audio Metadata (ID3 Tags)

**What yt-dlp provides by default (confidence: HIGH — well-documented):**

- `--embed-metadata` writes: title (from YouTube title), artist (channel name), year (upload year), comment (YouTube URL).
- `--embed-thumbnail` embeds the video thumbnail as album art (requires AtomicParsley or mutagen).
- Channel name ≠ artist name. YouTube Music videos often have proper artist in the title but yt-dlp writes channel name to the artist tag.

**What's missing and must be addressed:**

- **Artist field is usually wrong**: "HYBE LABELS" instead of "BTS". Must provide editable field.
- **Album field**: YouTube has no album concept. Either leave blank or derive from playlist name.
- **Track number**: Only meaningful for playlist downloads. Auto-assign based on playlist position.
- **Genre**: Not available from YouTube. Leave blank or allow manual entry.
- **MusicBrainz lookup**: Post-download lookup by title+artist to enrich tags — nice-to-have, v1.x.

**Recommended approach:**

Before each download, show a metadata preview panel with editable fields: Title (pre-cleaned), Artist (from channel, editable), Album (blank or playlist name), Year, Cover art (from thumbnail). User confirms or edits. This catches bad metadata before it pollutes the library.

**Confidence: HIGH** (yt-dlp metadata behavior is well-documented and stable).

### Filename / Title Formatting Patterns

**Standard power-user patterns (confidence: MEDIUM — derived from community conventions):**

```
{artist} - {title}                  # Most common: "Adele - Hello"
{title}                             # Minimal
{artist}/{album}/{track}. {title}   # Library-organized (subfolders)
{year} - {artist} - {title}        # Chronological libraries
```

**Title cleanup pipeline (ordered):**

1. Strip bracketed suffixes: `[Official MV]`, `[Official Audio]`, `[Lyric Video]`, `[4K]`, `(Official Video)`, `(Lyrics)`, `(Audio)`.
2. Strip feature notation variants: `(feat. X)` → normalize to `ft. X` or strip.
3. Strip promotional noise: `| HYBE LABELS`, `|| Official`, `// Sony Music`.
4. Strip quality/remaster tags: `[HQ]`, `(Remastered 2021)` — configurable, some users want these.
5. Trim whitespace and trailing punctuation.
6. Replace filesystem-unsafe chars: `: / \ * ? " < > |` → safe alternatives (`：`, `-`, etc.) or removal.

**Show live preview**: As user types their template pattern, show "will save as: Adele - Hello.mp3" in real time. This is a UX detail that existing tools mostly skip and users love when present.

**yt-dlp output template tokens available (confidence: HIGH):**

`%(title)s`, `%(uploader)s`, `%(upload_date)s`, `%(id)s`, `%(playlist_title)s`, `%(playlist_index)s`, `%(duration)s`

Expose a curated subset: title, uploader (as artist proxy), upload_date, playlist_title, playlist_index. Hide power-user tokens to reduce cognitive load.

### Preview / Streaming Approach

**Options and tradeoffs:**

1. **yt-dlp `--get-url`**: Fetches the direct streaming URL for the audio stream. Then play via `<audio>` element in the Tauri webview. Pros: no API key; works for any yt-dlp-supported URL. Cons: URL expires in ~6 hours; requires a subprocess call per preview; first-play latency 1-3 seconds.

2. **YouTube IFrame Player API**: Embed YouTube player in a hidden iframe, control via JS API. Pros: instant; handles auth/cookies for age-restricted content. Cons: Requires internet; YouTube may restrict embedding; no control over 30-second preview limit (plays full video).

3. **Partial download + cache**: yt-dlp downloads first N seconds to a temp file, play from temp. Pros: reliable. Cons: high latency (must download first); disk I/O.

**Recommendation**: Use approach #1 (yt-dlp `--get-url`) for MVP. It aligns with the existing yt-dlp dependency, needs no additional API keys, and the ~2 second latency is acceptable for a preview. Implement a 60-second stop timer client-side. Cache the streaming URL per video ID for the session.

**Confidence: MEDIUM** — yt-dlp `--get-url` behavior is well-documented; YouTube URL expiry and rate behavior may have changed.

### Download Progress UX

**What works:**

- **Per-item progress bar** in the queue panel: show percentage, current speed (MB/s), ETA.
- yt-dlp outputs progress to stdout in a parseable format: `[download]  45.3% of 4.23MiB at 1.23MiB/s ETA 00:02`. Parse with regex.
- **Two-phase progress**: Download phase (0-100%) then conversion phase ("Converting..."). ffmpeg progress is separate and harder to parse — show indeterminate spinner for conversion.
- **System notification on completion**: macOS/Windows notifications via Tauri's notification API. "Downloaded: Adele - Hello.mp3".
- **Clickable "Show in Finder/Explorer"** on completed item. Single most-requested QoL feature in downloader tools.

**What existing tools do poorly:**

- Most tools hide conversion progress entirely — users think the download is stuck.
- Parabolic shows conversion progress but the UI makes download vs. conversion phases hard to distinguish.
- 4K Video Downloader shows speed but not ETA during conversion.

**yt-dlp progress parsing (confidence: HIGH):**

```
[download]  45.3% of 4.23MiB at 1.23MiB/s ETA 00:02
[download] 100% of 4.23MiB in 00:03
[ffmpeg] Destination: /path/to/file.mp3
```

Parse with: `/\[download\]\s+([\d.]+)%.*?at\s+([\d.]+\w+\/s).*?ETA\s+(\d+:\d+)/`

---

## Feature Dependencies

```
Keyword Search
    └──requires──> YouTube Data API v3 OR yt-dlp search subprocess

Audio Preview
    └──requires──> yt-dlp --get-url subprocess
                       └──requires──> yt-dlp installed/bundled

Queue Management
    └──requires──> Download Engine (yt-dlp sidecar)
                       └──requires──> ffmpeg (for MP3 conversion)

Playlist Selective Download
    └──requires──> Playlist metadata fetch (yt-dlp)
    └──requires──> Queue Management

ID3 Tag Writing
    └──requires──> yt-dlp --embed-metadata
    └──enhances──> Metadata Editor (pre-download edit)

Filename Template
    └──enhances──> ID3 Tag Writing (same metadata tokens)

Download History / Dedup
    └──requires──> Persistent storage (SQLite or JSON)
    └──enhances──> Playlist Selective Download (greyed-out already-downloaded)

"Show in Finder" on complete
    └──requires──> Download completion event from yt-dlp stdout parsing
```

### Dependency Notes

- **Search requires API or subprocess**: YouTube Data API v3 gives better results but requires API key management UX. yt-dlp search requires no key but has higher latency and fewer metadata fields. Decision deferred per PROJECT.md — must resolve in Phase 1.
- **Preview requires yt-dlp**: Not independent — yt-dlp must be available before preview works. Bundle decision (Phase 1) gates this.
- **ffmpeg is a hard dependency**: MP3 conversion without ffmpeg is not possible via yt-dlp. Bundle or detect and error clearly.
- **Playlist selective download is a superset**: Everything in basic URL download, plus metadata fetch and checklist UI. Phase later than single-URL download.

---

## MVP Definition

### Launch With (v1)

Minimum viable to validate the core value: search → preview → queue → download.

- [ ] URL-paste single download to MP3 — validates the engine works
- [ ] Keyword search with results list (title, duration, thumbnail) — validates search flow
- [ ] Audio preview via yt-dlp streaming URL — validates the preview concept
- [ ] Add-to-queue + Download All — validates the cart metaphor
- [ ] Basic ID3 tag write (title, artist, year) via yt-dlp `--embed-metadata` — table stakes
- [ ] Title auto-cleanup (regex strip of common YouTube suffixes) — core value prop
- [ ] Save-to-folder dialog with persisted last path — table stakes
- [ ] Per-item progress (download %, conversion spinner) — table stakes
- [ ] Error messages for common failures (video unavailable, network error, age restriction) — table stakes

### Add After Validation (v1.x)

- [ ] Playlist URL → selective download checklist — add when users request playlist support
- [ ] Metadata editor before save — add when users complain about wrong artist tags
- [ ] Custom filename template with live preview — add when power users request it
- [ ] Download history / dedup — add when users report re-download frustration
- [ ] "Show in Finder/Explorer" on completion — quick win, add early in v1.x
- [ ] System notification on completion — add with "Show in Finder"

### Future Consideration (v2+)

- [ ] MusicBrainz tag enrichment — complex dependency; defer until metadata complaints are consistent
- [ ] Concurrency setting (1-4 parallel) — defer; serial queue is safer for v1
- [ ] Configurable title cleanup rules (user-defined regex) — power user feature; defer until base UX is stable
- [ ] Cookies / private playlist support — legally and technically complex; defer

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| URL-paste single download | HIGH | LOW | P1 |
| Per-item progress bar | HIGH | LOW | P1 |
| Save-to-folder dialog | HIGH | LOW | P1 |
| MP3 output (192kbps+) | HIGH | LOW | P1 |
| Error messaging | HIGH | LOW | P1 |
| Basic ID3 tag write | HIGH | LOW | P1 |
| Title auto-cleanup | HIGH | LOW | P1 |
| Keyword search | HIGH | MEDIUM | P1 |
| Audio preview | HIGH | MEDIUM | P1 |
| Cart-style queue | HIGH | MEDIUM | P1 |
| Duplicate detection | MEDIUM | MEDIUM | P2 |
| Metadata editor (pre-download) | MEDIUM | MEDIUM | P2 |
| Custom filename template | MEDIUM | LOW | P2 |
| "Show in Finder/Explorer" | HIGH | LOW | P2 |
| System notifications | MEDIUM | LOW | P2 |
| Playlist selective download | HIGH | HIGH | P2 |
| Download history / log | MEDIUM | MEDIUM | P2 |
| Concurrency control (1-4) | LOW | LOW | P3 |
| MusicBrainz lookup | LOW | HIGH | P3 |
| Configurable cleanup rules | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add in v1.x after validation
- P3: Nice to have, v2+ consideration

---

## Competitor Feature Analysis

| Feature | spotdl | Parabolic | Tartube | 4K Video Downloader | Our Approach |
|---------|--------|-----------|---------|---------------------|--------------|
| In-app search | Spotify-matched only | None (URL paste) | None (URL paste) | None (URL paste) | YouTube keyword search — key differentiator |
| Audio preview | None | None | None | None | yt-dlp streaming URL — unique in this space |
| Queue/batch | URL list only | Queue with progress | Complex queue | Queue | Cart metaphor; add from search results |
| Playlist support | Full (Spotify) | Full (all tracks) | Full | Full | Selective download checklist — better than all |
| ID3 metadata | Excellent (Spotify-sourced) | Basic | Basic | Basic | yt-dlp + editable pre-download — good enough |
| Filename template | Good (`{artist} - {title}`) | None | Limited | None | Template with live preview |
| Title cleanup | Automatic (Spotify match) | None | None | None | Regex pipeline + preview |
| Progress UI | CLI spinner | Per-item bar | Per-item (complex UI) | Per-item | Per-item with phase labels |
| "Show in Finder" | None | Yes | Yes | Yes | Yes |
| UI quality | CLI/terminal | Clean GTK4 | Overwhelming | Okay (paid feel) | Y2K retro — the differentiator |

**Key takeaway**: spotdl has the best metadata (Spotify-sourced), but is CLI-only and Spotify-locked. Parabolic has the cleanest GUI but zero search. The combination of in-app YouTube search + audio preview + selective playlist + clean metadata + a distinctive UI has no direct competitor.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| yt-dlp capabilities | HIGH | Well-documented, stable CLI; training data reliable through v2024.x |
| YouTube Data API v3 | MEDIUM | Quota limits and endpoint behavior may have changed; verify current free tier limits |
| Preview via `--get-url` | MEDIUM | URL expiry and rate limiting behavior may have changed since training cutoff |
| Competitor feature sets | MEDIUM | Based on training data; Parabolic and spotdl release frequently — verify current versions |
| ID3 tag writing via yt-dlp | HIGH | `--embed-metadata` is stable and well-documented |
| yt-dlp progress parsing regex | HIGH | Output format is stable and documented |
| ffmpeg as hard dependency | HIGH | yt-dlp MP3 conversion requires ffmpeg; no alternative |

---

## Sources

- yt-dlp documentation and README (training data, verified stable through 2024)
- spotdl GitHub README and documentation (training data)
- Parabolic (GNOME) feature set (training data)
- Tartube documentation (training data)
- 4K Video Downloader feature pages (training data)
- YouTube Data API v3 documentation (training data; quota limits should be re-verified)
- Community patterns from r/DataHoarder, yt-dlp issue tracker conventions (training data, LOW-MEDIUM confidence on specific claims)

**Note:** WebSearch and WebFetch were unavailable during this research session. All findings are from training data (knowledge cutoff August 2025). Confidence levels reflect this limitation. Recommend verifying: (1) current YouTube Data API v3 free quota limits, (2) current yt-dlp `--get-url` streaming URL behavior, (3) Parabolic and spotdl current feature sets.

---
*Feature research for: YouTube music downloader desktop app (Tauri v2 + yt-dlp)*
*Researched: 2026-03-21*
