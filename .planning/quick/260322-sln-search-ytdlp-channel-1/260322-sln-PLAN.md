---
phase: quick
plan: 260322-sln
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/search.rs
  - src/components/SearchTab.tsx
autonomous: true
requirements: [QUICK-search-streaming]
must_haves:
  truths:
    - "Keyword search results appear one-by-one as yt-dlp outputs each line"
    - "YouTube API search still works (batch emit all at once via channel)"
    - "used_fallback flag is still communicated to the frontend"
    - "Skeleton loading rows show during streaming, disappear when done"
    - "URL single-video lookup still works unchanged"
  artifacts:
    - path: "src-tauri/src/search.rs"
      provides: "Channel-based search command with SearchEvent enum"
      contains: "SearchEvent"
    - path: "src/components/SearchTab.tsx"
      provides: "Channel-based search invocation with incremental result rendering"
  key_links:
    - from: "src/components/SearchTab.tsx"
      to: "src-tauri/src/search.rs::search"
      via: "Channel<SearchEvent> passed to invoke('search')"
      pattern: "new Channel.*SearchEvent"
---

<objective>
Convert the `search` Tauri command from batch `Result<SearchResponse>` return to `Channel<SearchEvent>` streaming, mirroring the existing `search_playlist` pattern. This makes yt-dlp keyword search results appear one-by-one instead of waiting for all 5 results.

Purpose: Faster perceived search — users see the first result in ~1-2s instead of waiting ~5-8s for all results.
Output: Streaming search via Channel on both Rust and TypeScript sides.
</objective>

<execution_context>
@/Users/margarets/Dev_margaret/youtube-downloader/.claude/get-shit-done/workflows/execute-plan.md
@/Users/margarets/Dev_margaret/youtube-downloader/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src-tauri/src/search.rs (current search + search_playlist pattern reference)
@src/components/SearchTab.tsx (current frontend search flow)
@src/App.tsx (SearchState interface)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rust — Convert search() to Channel-based streaming</name>
  <files>src-tauri/src/search.rs</files>
  <action>
1. Create a new `SearchEvent` enum (same serde pattern as `PlaylistTrackEvent`):
   ```rust
   #[derive(serde::Serialize, Clone)]
   #[serde(tag = "type", content = "data")]
   pub enum SearchEvent {
       Result {
           id: String,
           title: String,
           thumbnail_url: String,
           duration: String,
           channel: String,
       },
       Done {
           total: usize,
           used_fallback: bool,
       },
       Error {
           message: String,
       },
   }
   ```

2. Change `search()` signature:
   - FROM: `pub async fn search(app: tauri::AppHandle, query: String, api_key: Option<String>) -> Result<SearchResponse, String>`
   - TO: `pub async fn search(app: tauri::AppHandle, query: String, api_key: Option<String>, on_result: tauri::ipc::Channel<SearchEvent>) -> Result<(), String>`

3. URL branch: emit single `SearchEvent::Result` then `SearchEvent::Done { total: 1, used_fallback: true }`. Return `Ok(())`.

4. YouTube API branch (`search_youtube_api` succeeds): iterate over the Vec<SearchResult> and emit each as `SearchEvent::Result`, then `SearchEvent::Done { total: N, used_fallback: false }`. Return `Ok(())`.

5. yt-dlp fallback branch: replace `search_ytdlp(query).await?` call with INLINE streaming logic (same pattern as `search_playlist`):
   - Spawn yt-dlp with `.stdout(Stdio::piped())` and `BufReader::new(stdout).lines()`
   - For each line parsed, emit `SearchEvent::Result` via `on_result.send()`
   - After loop, emit `SearchEvent::Done { total: count, used_fallback: true }`
   - Keep `search_ytdlp()` function for now (dead code is fine, can remove later)

6. Error handling: if YouTube API fails and falls back, log the error with `eprintln!` (already done), then continue to yt-dlp streaming branch. If yt-dlp itself fails to spawn, emit `SearchEvent::Error` and return `Ok(())`.

7. Keep `SearchResponse` struct (still used by nothing after this change, but removal is separate cleanup).
  </action>
  <verify>
    <automated>cd /Users/margarets/Dev_margaret/youtube-downloader && cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5</automated>
  </verify>
  <done>search() accepts Channel<SearchEvent> parameter, streams results one-by-one for yt-dlp path, batch-emits for API path. Compiles without errors.</done>
</task>

<task type="auto">
  <name>Task 2: Frontend — Switch invoke('search') to Channel-based reception</name>
  <files>src/components/SearchTab.tsx</files>
  <action>
1. Add `SearchEvent` interface (matches Rust `SearchEvent` serde output):
   ```typescript
   interface SearchEvent {
     type: 'Result' | 'Done' | 'Error';
     data?: {
       id?: string;
       title?: string;
       thumbnail_url?: string;
       duration?: string;
       channel?: string;
       total?: number;
       used_fallback?: boolean;
       message?: string;
     };
   }
   ```

2. In `handleSearch()` normal search branch (line ~209-231), replace the current `invoke<SearchResponse>('search', ...)` pattern with Channel-based approach:
   - Set state: `isSearching: true, hasSearched: true, results: []` (clear previous results)
   - Create `const onResult = new Channel<SearchEvent>()`
   - In `onResult.onmessage`:
     - `'Result'`: build a `SearchResult` from `event.data`, append to `searchStateRef.current.results` via `onSearchStateChange`
     - `'Done'`: set `isSearching: false`, `usedFallback: event.data?.used_fallback ?? false`
     - `'Error'`: set `isSearching: false`, `results: []`
   - Call `await invoke('search', { query: trimmed, apiKey: apiKey || null, onResult })`

3. URL branch (line ~144-207): also needs updating since `search()` signature changed. Create a Channel, collect the single Result event, then proceed with queue dispatch as before. Specifically:
   - Create `const onResult = new Channel<SearchEvent>()`
   - Use a Promise wrapper: resolve on 'Done' or 'Error', collect results in array
   - After await, use `collectedResults[0]` same as before for `response.results[0]`

4. Keep skeleton shimmer animation rows showing while `isSearching` is true (already works since results accumulate and skeletons show based on `isSearching` flag).

5. Remove unused `SearchResponse` interface (line 11-14) since it's no longer used.
  </action>
  <verify>
    <automated>cd /Users/margarets/Dev_margaret/youtube-downloader && npx tsc --noEmit 2>&1 | tail -10</automated>
  </verify>
  <done>Keyword search shows results incrementally (one-by-one for yt-dlp, batch for API). URL paste-to-queue still works. Skeleton loading visible during streaming. used_fallback banner displays correctly.</done>
</task>

</tasks>

<verification>
1. `cargo check` passes in src-tauri
2. `npx tsc --noEmit` passes
3. Manual test: type a keyword with no API key set, results should appear one at a time
4. Manual test: type a keyword with API key set, results appear all at once (API batch)
5. Manual test: paste a YouTube URL, should add to queue directly (unchanged behavior)
</verification>

<success_criteria>
- yt-dlp keyword search results stream one-by-one to the UI
- YouTube API results still work (emitted in batch via channel)
- URL single-video lookup unchanged
- used_fallback banner appears when yt-dlp fallback used
- Skeleton loading animation shows during search
- No TypeScript or Rust compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/260322-sln-search-ytdlp-channel-1/260322-sln-SUMMARY.md`
</output>
