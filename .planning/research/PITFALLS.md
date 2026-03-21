# Pitfalls Research

**Domain:** Tauri v2 desktop app with yt-dlp YouTube music downloader
**Researched:** 2026-03-21
**Confidence:** MEDIUM (web tools unavailable; based on verified training knowledge through Aug 2025 + known GitHub issue patterns)

---

## Critical Pitfalls

### Pitfall 1: yt-dlp Breaking Changes With No Version Pin

**Severity:** HIGH

**What goes wrong:**
yt-dlp releases breaking changes frequently — sometimes weekly — as YouTube actively changes its internal API, signature extraction, and format manifest structure. An app bundling a specific yt-dlp binary can stop working overnight if that version's extractor is broken by YouTube. Conversely, pinning to an old version means users hit known bugs with no automatic fix.

**Why it happens:**
yt-dlp has no stable API contract. It is a CLI tool whose internal behavior (JSON output schema, format selection strings, error exit codes) changes across releases. Developers assume "pin a version = stability" but YouTube's server-side changes can break even a pinned version.

**How to avoid:**
- Treat yt-dlp as a **runtime dependency that must be user-updatable**, not a static sidecar. Bundle a default version but expose an in-app "Check for yt-dlp update" button that downloads the latest release binary from GitHub.
- Version-check yt-dlp on startup (`yt-dlp --version`) and show a warning if the bundled version is more than 30 days old.
- Parse yt-dlp JSON output (`--dump-json`) defensively: treat all fields as optional, log unknown structures.
- Pin the bundled version at build time using the GitHub releases API, but make the update path a first-class feature.

**Warning signs:**
- yt-dlp exits with code 1 and error message containing "Sign in to confirm your age", "This video is unavailable", or "ERROR: [youtube] ... : HTTP Error 429"
- Format strings that previously worked return empty format lists
- CI downloads start failing without any code change

**Phase to address:** Phase 1 (core download engine setup) — establish the update mechanism before shipping any binary.

---

### Pitfall 2: YouTube Bot Detection and Rate Limiting

**Severity:** HIGH

**What goes wrong:**
YouTube aggressively detects automated access. From late 2023 onward, YouTube began requiring visitor data / proof-of-work tokens (PO tokens) for unauthenticated requests. Without these, yt-dlp returns HTTP 403 or falls back to worse quality. Additionally, rapid sequential requests (download queue flushing) trigger temporary IP bans (HTTP 429), sometimes lasting hours.

**Why it happens:**
The app makes unauthenticated requests from a desktop IP with no browser fingerprint. YouTube's bot detection checks user-agent strings, request timing, cookie presence, and now also JavaScript-derived tokens that yt-dlp must emulate.

**How to avoid:**
- Use yt-dlp's `--cookies-from-browser` option (Chrome or Firefox) to pass real browser cookies for the local user's YouTube session. This is the most reliable mitigation. Expose "Use browser cookies" as an optional setting in the UI.
- Add per-download delay: at minimum 1–2 seconds between sequential yt-dlp invocations in the download queue. Configurable, with a sensible default of 2s.
- Never make parallel yt-dlp processes for the same IP without significant jitter (5–15s random delay).
- Do not use yt-dlp's built-in search (`ytsearch:`) for high-frequency queries — it triggers rate limiting faster than the YouTube Data API.
- Implement exponential backoff: on HTTP 429, wait 30s, 60s, 120s before retry. Surface the rate-limit state clearly in the UI rather than silently failing.

**Warning signs:**
- "HTTP Error 429: Too Many Requests" in yt-dlp stderr
- "Sign in to confirm you're not a bot" errors
- Downloads succeed in isolation but fail in queue mode
- Works fine with one user, breaks when multiple people use it on the same network

**Phase to address:** Phase 1 (download engine) and Phase 3 (download queue implementation).

---

### Pitfall 3: ffmpeg Path Resolution Failing Cross-Platform

**Severity:** HIGH

**What goes wrong:**
yt-dlp requires ffmpeg for audio extraction/conversion to MP3. When ffmpeg is not on the system PATH or is not adjacent to the yt-dlp binary, yt-dlp silently downloads the source video without converting it, or fails with a cryptic error. On macOS with Homebrew, ffmpeg lives at `/opt/homebrew/bin/ffmpeg` (Apple Silicon) or `/usr/local/bin/ffmpeg` (Intel) — neither is on the default PATH when spawning subprocesses from a `.app` bundle.

**Why it happens:**
macOS app bundles do not inherit the user's shell PATH. Tauri spawns child processes with a minimal environment. A developer tests in terminal (where PATH includes Homebrew) and it works; packaged app users find it broken.

**How to avoid:**
- Bundle ffmpeg as a **second sidecar binary** alongside yt-dlp. This is the only fully reliable cross-platform solution.
- Pass `--ffmpeg-location <path>` explicitly to every yt-dlp invocation, pointing to the bundled ffmpeg binary resolved via Tauri's `resolve_resource()` API.
- On first launch, verify ffmpeg is working by running `ffmpeg -version` and displaying the result in a settings/debug panel.
- If not bundling, probe common install locations at startup: `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `C:\ffmpeg\bin` on Windows, and present a setup wizard if not found.

**Warning signs:**
- yt-dlp produces `.webm` or `.m4a` files instead of `.mp3`
- yt-dlp outputs "WARNING: ffmpeg not found" to stderr
- Works during development (terminal-launched) but fails in packaged app
- macOS: works on Intel Mac, fails on Apple Silicon (or vice versa) due to different Homebrew paths

**Phase to address:** Phase 1 — establish ffmpeg path strategy before any download feature is built.

---

### Pitfall 4: Tauri Sidecar Requires Platform-Specific Binary Triple in Filename

**Severity:** HIGH

**What goes wrong:**
Tauri v2's sidecar system requires sidecar binaries to be named with the exact target triple appended: e.g., `yt-dlp-x86_64-apple-darwin`, `yt-dlp-aarch64-apple-darwin`, `yt-dlp-x86_64-pc-windows-msvc.exe`. If the filename doesn't match exactly what `tauri.conf.json` declares, the sidecar silently fails to resolve at runtime — often with a misleading "file not found" error pointing to a path that looks correct but has the wrong triple.

**Why it happens:**
Developers copy the yt-dlp binary and forget to rename it, or use the wrong triple string. The error message does not clearly state "binary name mismatch."

**How to avoid:**
- Write a build script (`build.rs` or a pre-build shell script) that downloads the correct yt-dlp binary for each platform, renames it with the correct triple, and places it in `src-tauri/binaries/`. Never do this manually.
- Verify the correct triple by running `rustc -vV | grep host` and using that exact string.
- Add a CI check that runs on all three platforms and verifies sidecar resolution works.
- For yt-dlp specifically: the upstream binary is a single Python-compiled executable — use the platform-appropriate release (`yt-dlp`, `yt-dlp.exe`, `yt-dlp_macos`).

**Warning signs:**
- `tauri::api::process::Command::new_sidecar("yt-dlp")` returns Err
- Error message mentions a path ending in the binary name but says "not found"
- Works on the developer's machine (correct triple) but fails on CI or another OS

**Phase to address:** Phase 1 — get sidecar resolution working on all three platforms before any feature work.

---

### Pitfall 5: macOS Notarization Blocks Bundled Executables

**Severity:** HIGH

**What goes wrong:**
macOS Gatekeeper blocks unsigned/unnotarized executables inside app bundles. yt-dlp and ffmpeg bundled as sidecar binaries must themselves be code-signed and the app must be notarized. Without this, users on macOS 12+ see "cannot be opened because the developer cannot be verified" or the app silently fails when trying to launch the sidecar. The yt-dlp binary downloaded from GitHub releases is unsigned.

**Why it happens:**
Apple's notarization requirement applies to all executables within the `.app` bundle, not just the main binary. Developers test with Gatekeeper disabled (common during development) and don't discover this until distribution.

**How to avoid:**
- Sign yt-dlp and ffmpeg sidecars with your Apple Developer certificate as part of the Tauri build pipeline. Tauri v2's `tauri build` with `signingIdentity` configured in `tauri.conf.json` handles the app bundle but you must explicitly include sidecar paths in the signing step.
- Use Tauri's built-in notarization support — set `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` environment variables and enable notarization in `tauri.conf.json`.
- Test the notarized `.dmg` on a clean macOS machine with Gatekeeper enabled before shipping.
- Add the sidecar binaries to `hardened-runtime` entitlements if they require network access.

**Warning signs:**
- macOS shows "app is damaged and can't be opened" (actual meaning: unsigned executable inside bundle)
- Sidecar launch fails silently in production but works in dev (`cargo tauri dev`)
- `spctl --assess --type exec ./src-tauri/binaries/yt-dlp-aarch64-apple-darwin` returns "rejected"

**Phase to address:** Phase 4 (packaging/distribution) — but design the signing pipeline in Phase 1 to avoid a painful retrofit.

---

### Pitfall 6: In-App Audio Streaming Without Full Download Is Fragile

**Severity:** HIGH

**What goes wrong:**
The requirement calls for 30–60 second in-app streaming previews. The natural approach — stream a YouTube audio URL directly to an HTML `<audio>` element — fails in multiple ways: (a) YouTube's streaming URLs expire in ~6 hours and contain query-string signatures, (b) direct YouTube URLs are blocked by CORS in any browser context including Tauri's WebView, (c) Tauri's `asset:` protocol does not natively support range requests needed for audio seeking.

**Why it happens:**
Developers assume the WebView can play any URL that works in Chrome. Tauri's WebView is a browser but runs without the user's existing browser session and without the relaxed CORS headers YouTube sends to the actual YouTube player.

**How to avoid:**
- Do not stream YouTube URLs directly to `<audio>`. Use yt-dlp to extract the direct audio stream URL, then proxy it through Rust using a local HTTP server (e.g., `tiny_http` or `axum` bound to `127.0.0.1:PORT`). The `<audio>` element points to `http://127.0.0.1:PORT/stream`.
- The local proxy fetches from YouTube's CDN with yt-dlp-obtained cookies/headers, forwarding chunks as they arrive. This handles CORS, range requests, and authentication.
- Alternatively: download to a temp file (`.tmp` extension), play from the local temp file via `asset://` or a Tauri-registered custom protocol, delete on track change.
- The temp-file approach is simpler and more reliable. The preview UX only needs ~30–60s anyway, so partial download time is acceptable.

**Warning signs:**
- `<audio>` src set to YouTube URL plays in dev browser but fails in Tauri WebView
- Console shows CORS errors or "media source not supported"
- Audio works once then 403s after the URL expires
- Seeking jumps back to position 0 (range request not supported)

**Phase to address:** Phase 2 (search + preview feature) — decide the streaming architecture before implementing preview.

---

### Pitfall 7: Download Queue Race Conditions With yt-dlp Subprocess Management

**Severity:** MEDIUM

**What goes wrong:**
Spawning multiple yt-dlp processes concurrently without proper process tracking leads to: (a) processes not being killed when user cancels, (b) progress updates from process A being attributed to download B when using shared output parsing, (c) temp files not cleaned up if the app quits mid-download, (d) two processes writing to the same output file.

**Why it happens:**
yt-dlp is a CLI tool — it knows nothing about the app's queue state. Developers use fire-and-forget `Command::spawn()` calls and track state only in frontend JS, which gets out of sync with the actual process state.

**How to avoid:**
- Maintain a download manager in Rust (not in the frontend) that owns a `HashMap<DownloadId, Child>` tracking all spawned yt-dlp processes.
- Each download gets a unique temp directory (`/tmp/yt-dlp-<uuid>/`) to avoid filename collisions.
- On cancel: call `child.kill()` explicitly and clean up the temp directory.
- On app quit (`tauri::WindowEvent::CloseRequested`): terminate all in-flight downloads before exiting.
- Parse yt-dlp's `--progress-template` or `--newline` output in per-process Rust tasks, emitting Tauri events namespaced by download ID.
- Limit concurrent downloads to 2 maximum (configurable). YouTube rate-limits more aggressively with more concurrency.

**Warning signs:**
- Zombie `yt-dlp` or `ffmpeg` processes visible in Activity Monitor after app close
- Progress bar for track A shows track B's progress
- Temp files accumulate in `/tmp` across sessions
- Cancel button doesn't actually stop the download

**Phase to address:** Phase 3 (download queue implementation).

---

### Pitfall 8: YouTube Search Without API Key Has Severe Limitations

**Severity:** MEDIUM

**What goes wrong:**
Using `yt-dlp ytsearch10:query` as a search backend is tempting (no API key needed) but is unreliable: (a) it triggers YouTube's bot detection faster than audio downloads, (b) it is significantly slower (2–5s per search vs. <200ms for the YouTube Data API), (c) results include non-music content and there is no reliable way to filter to music only, (d) thumbnail URLs returned by yt-dlp search are not always valid for embedding.

**Why it happens:**
Developers want to avoid the YouTube Data API's quota system (10,000 units/day free tier) and the requirement for users to provide an API key.

**How to avoid:**
- Use the **YouTube Data API v3** as the primary search backend. The quota is 10,000 units/day which at 100 units per search = 100 searches/day — adequate for a personal tool.
- Provide an optional fallback to yt-dlp search for users who don't provide an API key, with a clear UI warning about slower/less reliable results.
- Cache search results in memory (within-session) to avoid re-querying on repeated searches.
- If using yt-dlp search as fallback: add `--default-search ytsearch` and limit to `ytsearch5:` to reduce request volume.

**Warning signs:**
- Search takes more than 3 seconds consistently
- Search results include gaming videos, vlogs, etc. when searching for music
- HTTP 429 errors appear during search, not just during download
- yt-dlp search returns no results for queries that return results on YouTube.com

**Phase to address:** Phase 2 (search feature implementation).

---

### Pitfall 9: Windows Executable Signing and Antivirus False Positives

**Severity:** MEDIUM

**What goes wrong:**
On Windows, unsigned `.exe` installers trigger Windows Defender SmartScreen ("Windows protected your PC"). The yt-dlp sidecar itself, being a PyInstaller-compiled executable, frequently triggers antivirus false positives — this is a known issue documented in yt-dlp's GitHub. Users will report the app as malware.

**Why it happens:**
PyInstaller-compiled binaries pattern-match against many AV signatures because malware also uses PyInstaller. Windows code signing certificates cost $300–$600/year (EV certificates) and require identity verification.

**How to avoid:**
- Sign the Windows installer (`.msi` or `.nsis` installer generated by Tauri) with an EV code signing certificate. This is the only way to avoid SmartScreen warnings permanently. EV certs from DigiCert or Sectigo are the standard choice.
- For the yt-dlp sidecar: document the false positive issue prominently in the app's README. Users can add an exclusion to Windows Defender.
- Consider shipping yt-dlp as a managed download (downloaded by the app on first run) rather than bundled in the installer, so the AV scan hits GitHub's signed release rather than your bundle.
- Test against VirusTotal before release.

**Warning signs:**
- Windows Defender flags the installer during CI artifact build
- User reports of "your app is a virus"
- SmartScreen blocks installer for all users (blue "More info" dialog instead of just for rare users)

**Phase to address:** Phase 4 (distribution/packaging).

---

### Pitfall 10: yt-dlp Output Parsing Is Not a Stable API

**Severity:** MEDIUM

**What goes wrong:**
Developers parse yt-dlp's stdout/stderr as if it were a structured API. yt-dlp's text output format changes between versions — progress line format, error message wording, JSON field names in `--dump-json` output have all changed in past releases. Code that parses "100% of 5.23MiB" strings breaks when yt-dlp changes the progress format.

**Why it happens:**
yt-dlp has no documented programmatic API contract. The `--dump-json` output is more stable than text output but still adds/removes fields.

**How to avoid:**
- Always use `--dump-json` for metadata extraction, never parse human-readable output for data.
- Use `--progress-template` to define a machine-readable progress format that you control: e.g., `--progress-template "%(progress._percent_str)s %(progress._total_bytes_str)s"`.
- Parse `--newline` output line by line, using regex with named capture groups that are tolerant of formatting changes.
- Write unit tests for your output parser against known yt-dlp output samples from multiple versions.

**Warning signs:**
- Progress parsing suddenly shows 0% or NaN after a yt-dlp update
- JSON parsing crashes on a field that was expected but no longer present
- Error detection stops working (error messages changed wording)

**Phase to address:** Phase 1 (download engine) — establish the parsing contract from the start.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip yt-dlp update mechanism | Simpler Phase 1 | App breaks when YouTube changes; users blame you | Never — build update flow in Phase 1 |
| Use system ffmpeg instead of bundling | No binary size increase | Works for developers, breaks for many users | Only for internal tools with controlled environments |
| Parse yt-dlp text output (not JSON) | Faster to implement | Breaks on every yt-dlp version update | Never — always use `--dump-json` or `--progress-template` |
| Direct YouTube URL in `<audio>` | No proxy complexity | CORS failures, URL expiry, silent breakage | Never — always proxy through local server or temp file |
| Fire-and-forget subprocess spawn | Simple Rust code | Zombie processes, no cancel support | Never for production download queue |
| No rate limiting between queue downloads | Faster batch downloads | IP bans from YouTube 429 errors | Never — always add minimum delay |
| Ship unsigned Windows installer | Save $300-600/yr signing cert | SmartScreen blocks every user; perceived as malware | Only for internal tools, never for public distribution |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| yt-dlp subprocess | Pass only URL as argument | Always pass `--no-playlist`, `--extract-audio`, `--audio-format mp3`, `--ffmpeg-location`, and `--progress-template` explicitly |
| yt-dlp + ffmpeg | Assume ffmpeg is on PATH | Resolve ffmpeg path at startup; pass `--ffmpeg-location` on every invocation |
| YouTube Data API | Hardcode API key in source | Read from user-provided setting stored in Tauri's secure store |
| Tauri sidecar | Use relative path to binary | Use `tauri::api::process::Command::new_sidecar()` which handles path resolution per platform |
| yt-dlp cookies | Tell users to "log in" | Use `--cookies-from-browser chrome` to silently pick up existing session |
| Audio preview `<audio>` | Point to YouTube URL directly | Proxy through local HTTP server bound to 127.0.0.1 |
| Download output path | Use user-provided path directly | Sanitize for invalid filename characters per OS before passing to `--output` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Parallel yt-dlp invocations without delay | HTTP 429 after 3rd–5th download | Cap concurrency at 2, add 2s minimum inter-download delay | Immediately for batch >3 downloads |
| Fetching full video info for search results | Search takes 5–10s for 10 results | Use YouTube Data API for search; only invoke yt-dlp when user selects a track | Always — yt-dlp search is inherently slow |
| Streaming audio via yt-dlp pipe to WebView | Audio stutters, seeking fails | Use temp file download + local file playback | At any file size; WebView range requests are unreliable via pipe |
| Blocking Rust main thread for yt-dlp spawn | UI freezes during download | Spawn yt-dlp in `tokio::spawn` async task, emit progress via Tauri events | Immediately on first download |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Pass user-provided URL directly to yt-dlp via shell string interpolation | Command injection | Always use `Command::new_sidecar().args([url])` — never construct shell strings. Tauri's Command API passes args as array, not shell string |
| Store YouTube API key in frontend JS bundle | API key exposed in packaged app (extractable) | Store in Tauri's secure store or environment variable; never in JS or in `tauri.conf.json` committed to git |
| Write downloaded files to app bundle directory | macOS SIP blocks writes; Windows UAC prompt | Always write to user's designated download folder (resolved via Tauri's `download_dir()` or user-selected path) |
| Allow arbitrary `--output` paths from frontend | Path traversal | Validate that resolved output path is within the user's selected download directory |
| Run ffmpeg/yt-dlp with inherited environment | May expose sensitive env vars | Spawn with minimal explicit environment (only PATH, HOME, TMPDIR) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress feedback during download | User thinks app is frozen; force-quits, leaving corrupt temp files | Stream yt-dlp `--progress-template` output as Tauri events; show per-track progress bar |
| Silent failure when yt-dlp errors | User sees nothing, tries again, same result | Parse yt-dlp stderr for known error patterns (429, 403, "unavailable") and show specific error messages with action suggestions |
| File saved with YouTube title as-is | Filenames contain `[Official MV] (4K)` etc.; special characters break some filesystems | Apply title cleanup pipeline: strip bracket tags, remove characters invalid on target OS, apply user's naming pattern |
| Download queue shows all or nothing | Users can't see which track is downloading | Show per-track state: queued / downloading (with %) / done / failed |
| No indication yt-dlp update is needed | Mysteriously broken downloads after YouTube changes | Show yt-dlp version age in settings; prompt update if >30 days old |
| Crash when user quits during download | Temp files pollute user's `/tmp` | Handle `CloseRequested` window event in Rust; kill all children and clean temp dirs before exit |

---

## "Looks Done But Isn't" Checklist

- [ ] **yt-dlp sidecar resolution:** Works in `cargo tauri dev` but not in packaged `.app`/`.exe` — verify by running the built installer on a clean machine.
- [ ] **ffmpeg path:** Works when launched from terminal but not from Dock/Start Menu — verify by launching the packaged app without opening a terminal first.
- [ ] **Cancellation:** Download progress stops in UI but yt-dlp/ffmpeg process still runs — verify with Activity Monitor / Task Manager during cancel.
- [ ] **Temp file cleanup:** Old temp files remain in `/tmp` after crash — verify by force-killing the app during download and checking `/tmp`.
- [ ] **Rate limiting:** Single download works but queue of 10 triggers 429 — verify by queuing 5+ downloads on a fresh IP.
- [ ] **macOS notarization:** App installs fine on dev machine (Gatekeeper disabled) but shows "damaged" on clean machine — verify on a fresh macOS VM with SIP enabled.
- [ ] **Windows SmartScreen:** Installer runs fine for developer but shows blue warning for new users — verify by running installer on machine where the app has never been seen before.
- [ ] **Audio preview CORS:** Plays in browser during dev but silent in packaged Tauri app — verify in packaged app, not `tauri dev`.
- [ ] **Playlist URL handling:** Single video URL works but playlist URL imports all 200 tracks with no way to stop — verify playlist URLs trigger a selection UI, not an immediate bulk download.
- [ ] **Filename sanitization:** Works on macOS but Windows rejects characters like `:` `?` `*` in filenames — verify downloads on Windows with tracks containing colons in their titles.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| yt-dlp sidecar naming wrong after shipping | HIGH | Patch release with corrected binary name; users must re-download |
| No yt-dlp update mechanism shipped in v1 | HIGH | Cannot update without new app release; ship update mechanism ASAP as emergency patch |
| ffmpeg bundling skipped — users can't convert | HIGH | Patch release adding ffmpeg sidecar; update installer; existing installs need manual ffmpeg install until update |
| No process cancellation shipped | MEDIUM | Zombie processes are annoying but non-destructive; ship fix in next release |
| Unsigned macOS build shipped | HIGH | All macOS users on 12+ cannot open app; must notarize and reshare immediately |
| Rate limit not handled — queue 429s silently | MEDIUM | Users think app is broken; patch to add retry/delay logic and user-visible error |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| yt-dlp breaking changes / no update mechanism | Phase 1 | yt-dlp update flow tested end-to-end before Phase 1 ships |
| ffmpeg path resolution | Phase 1 | Run packaged app on all 3 platforms with no terminal; confirm MP3 output |
| Tauri sidecar binary naming | Phase 1 | CI matrix (macOS ARM, macOS Intel, Windows, Linux) all pass sidecar resolution |
| yt-dlp output parsing contract | Phase 1 | Parser unit tests cover at least 2 yt-dlp versions |
| YouTube bot detection / rate limiting | Phase 1 + Phase 3 | Queue of 5 downloads completes without 429 |
| Audio preview streaming approach | Phase 2 | Preview plays in packaged app (not tauri dev) on all platforms |
| YouTube search reliability | Phase 2 | Search returns results in <1s with API key; fallback tested with yt-dlp |
| Download queue race conditions | Phase 3 | Cancel mid-queue: no zombie processes; temp dirs cleaned |
| macOS notarization | Phase 4 | `spctl --assess` passes; tested on clean macOS VM |
| Windows signing / SmartScreen | Phase 4 | SmartScreen shows green checkmark (EV cert) or is documented as known limitation |
| Windows AV false positives | Phase 4 | VirusTotal scan run pre-release; documented in README |

---

## Sources

- yt-dlp GitHub repository issues and CHANGELOG (training data through Aug 2025) — MEDIUM confidence
- Tauri v2 documentation: sidecar guide, signing guide (training data through Aug 2025) — MEDIUM confidence
- Community experience with PyInstaller-compiled binaries and Windows Defender — MEDIUM confidence
- Known YouTube bot detection changes (PO token requirement, 2023–2025) — MEDIUM confidence
- macOS Gatekeeper / notarization requirements (Apple Developer documentation) — HIGH confidence
- Tauri community Discord and GitHub issues re: sidecar path resolution — MEDIUM confidence

**Note:** Web search and WebFetch were unavailable during this research session. All findings are from verified training knowledge (cutoff Aug 2025). Confidence ratings reflect this limitation. Re-verify yt-dlp bot detection specifics against current GitHub issues before Phase 1 begins, as this area evolves rapidly.

---
*Pitfalls research for: Tauri v2 + yt-dlp YouTube music downloader*
*Researched: 2026-03-21*
