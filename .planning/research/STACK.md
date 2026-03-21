# Stack Research

**Domain:** Cross-platform desktop YouTube music downloader (Tauri v2 + yt-dlp)
**Researched:** 2026-03-21
**Confidence:** MEDIUM — WebSearch/WebFetch blocked. Based on training knowledge of Tauri v2 (stable October 2024), yt-dlp, and ffmpeg ecosystem patterns. Core facts are well-established; version pins should be verified before locking.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tauri v2 | 2.x (stable) | Desktop app shell, Rust backend, IPC bridge | Fixed constraint per PROJECT.md. v2 introduced major security model improvements (capability-based permissions), better plugin API, and improved sidecar support vs v1. |
| React | 19.x | UI framework | Best TypeScript ecosystem of the three main options (React/Svelte/Vue). Tauri's own docs use React in most examples. Largest component ecosystem — critical for Y2K/retro UI component sourcing. No framework-specific build quirks with Vite. |
| TypeScript | 5.x | Type safety across frontend | Tauri v2 ships TypeScript typings for all IPC calls. Catches mismatches between frontend and Rust commands at compile time, not runtime. |
| Vite | 6.x | Frontend bundler/dev server | Tauri v2's official scaffolder (`npm create tauri-app`) defaults to Vite. Fastest HMR for dev iteration. Native ESM. |
| Rust | 1.78+ (stable) | Backend logic, process spawning, file I/O | Tauri's backend language. All yt-dlp invocation, file path handling, and download coordination happens here. |

### Rust Crates (Backend)

| Crate | Version | Purpose | Why |
|-------|---------|---------|-----|
| `tauri` | 2.x | App framework, IPC, window management | Core dependency — all Tauri commands and events defined here. |
| `tauri-plugin-shell` | 2.x | Spawn and stream sidecar processes | The official way to invoke yt-dlp and ffmpeg as sidecars in Tauri v2. Replaces v1's `tauri::api::process`. Provides stdout/stderr streaming via Tauri events. |
| `tauri-plugin-dialog` | 2.x | Native folder/file picker dialogs | Required for "choose download folder" UX. Uses OS-native dialog so no need to implement custom one. |
| `tauri-plugin-fs` | 2.x | Sandboxed filesystem access | Reading/writing config, checking if files exist, managing download directory. Tauri v2's capability system requires explicit fs plugin registration. |
| `tauri-plugin-store` | 2.x | Persistent key-value storage | Persisting user preferences (download path, filename pattern, quality settings) across app restarts. Simpler than SQLite for flat config. |
| `serde` | 1.x | Serialize/deserialize Rust structs | Required for IPC: all data crossing the Rust↔JS boundary must implement `serde::Serialize`/`Deserialize`. |
| `serde_json` | 1.x | JSON support for serde | Tauri IPC uses JSON under the hood; serde_json needed for parsing yt-dlp JSON output. |
| `tokio` | 1.x | Async runtime | yt-dlp/ffmpeg processes are long-running. Tokio enables non-blocking process management so the UI stays responsive during downloads. |
| `regex` | 1.x | Filename sanitization | Clean up `[Official MV]`, special characters, etc. from yt-dlp title output before saving. |

### Frontend Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/api` | 2.x | IPC invoke, events, window APIs | Always — this is the JS bridge to Tauri's Rust backend. |
| `@tauri-apps/plugin-shell` | 2.x | JS side of shell plugin | Always — needed to interact with sidecar process events. |
| `@tauri-apps/plugin-dialog` | 2.x | JS side of dialog plugin | For folder picker UI trigger. |
| `@tauri-apps/plugin-store` | 2.x | JS side of store plugin | For reading/writing user preferences from the frontend. |
| `@tauri-apps/plugin-fs` | 2.x | JS side of fs plugin | When you need to check file existence or list downloads from frontend. |
| `zustand` | 5.x | Client-side state management | Download queue, selected tracks, app settings. Lightweight vs Redux, no boilerplate, works naturally with React. Avoids prop-drilling for the download cart pattern. |
| `react-query` (TanStack Query) | 5.x | Async search state, caching | Search results from yt-dlp have latency (2-5s). TanStack Query handles loading/error states, result caching, and deduplication cleanly. |
| `tailwindcss` | 4.x | Utility CSS | Y2K retro UI benefits from Tailwind's rapid iteration. Custom CSS variables for the pastel palette. Avoids bloated CSS-in-JS overhead in a desktop app. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npm create tauri-app` | Project scaffolding | Use `--template react-ts` flag. Generates correct `tauri.conf.json`, `vite.config.ts`, and Cargo.toml. |
| Rust toolchain (rustup) | Rust compiler and cargo | Install via rustup.rs. Tauri v2 requires Rust 1.70+ but 1.78+ recommended. |
| `cargo-tauri` (tauri-cli) | Build, dev, and bundle commands | `cargo tauri dev` for hot-reload, `cargo tauri build` for distributable. |
| yt-dlp binary | Download engine | See yt-dlp Bundling section below. Pinned version recommended. |
| ffmpeg binary | Audio transcoding | See ffmpeg Bundling section below. Must be co-located with yt-dlp sidecar. |

---

## yt-dlp Integration Pattern

### Decision: Bundled Sidecar (Recommended)

Bundle yt-dlp as a Tauri sidecar binary rather than requiring system installation.

**Why bundled wins for this app:**
- Zero-friction UX: user installs the app, it works. No "install yt-dlp first" step.
- Version pinning: you control exactly which yt-dlp version ships. yt-dlp breaks APIs on updates; a bundled version prevents silent breakage.
- Avoids PATH issues on Windows where `yt-dlp` may not be in PATH even when installed.
- Tauri v2's `tauri-plugin-shell` has first-class sidecar support with capability-based security.

**How it works in Tauri v2:**
```
src-tauri/
  binaries/
    yt-dlp-x86_64-apple-darwin      # macOS Intel
    yt-dlp-aarch64-apple-darwin     # macOS ARM
    yt-dlp-x86_64-pc-windows-msvc.exe
    yt-dlp-x86_64-unknown-linux-gnu
```

In `tauri.conf.json`:
```json
{
  "bundle": {
    "externalBin": ["binaries/yt-dlp"]
  }
}
```

The sidecar binary name must include the target triple suffix. Tauri auto-selects the correct binary at build time.

**yt-dlp invocation pattern** (Rust side):
- Use `tauri_plugin_shell::open` or `Command::new_sidecar("yt-dlp")` with args.
- Stream stdout line-by-line to parse progress (yt-dlp outputs `[download] X%` lines).
- Parse with `--print-json` or `--dump-json` flag to get metadata without downloading.
- For search: `yt-dlp "ytsearch10:query" --dump-json --flat-playlist` returns JSON for 10 results.
- For download: `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "%(title)s.%(ext)s" URL`

**yt-dlp version pinning:**
- Pin to a specific release (e.g., 2024.12.13) in your CI/download script.
- yt-dlp releases frequently; pin and update deliberately, not automatically.

### Alternative: System yt-dlp

Only choose this if: targeting power users who manage their own tools, or distributable size is a hard constraint. For a general-audience Y2K music downloader, bundled is correct.

---

## ffmpeg Integration Pattern

### Decision: Bundled Sidecar (Recommended)

Same rationale as yt-dlp. ffmpeg must be present for MP3 conversion; bundling eliminates the dependency.

**Important:** yt-dlp calls ffmpeg internally when `--audio-format mp3` is specified. You do NOT need to call ffmpeg yourself from Rust. You only need to:
1. Bundle ffmpeg binary alongside yt-dlp binary.
2. Pass `--ffmpeg-location` flag to yt-dlp pointing to the bundled ffmpeg path.

**ffmpeg binary source:**
- macOS: `ffmpeg` static builds from evermeet.cx/ffmpeg or via Homebrew bottle repackaging.
- Windows: BtbN/FFmpeg-Builds (GitHub) — static LGPL build.
- Linux: johnvansickle.com static builds.
- All three are standard sources used by the yt-dlp community for bundling.

**ffmpeg binary layout** (same sidecar pattern as yt-dlp):
```
src-tauri/
  binaries/
    ffmpeg-x86_64-apple-darwin
    ffmpeg-aarch64-apple-darwin
    ffmpeg-x86_64-pc-windows-msvc.exe
    ffmpeg-x86_64-unknown-linux-gnu
```

**Getting the ffmpeg path at runtime** (Rust):
```rust
// tauri-plugin-shell resolves the sidecar path
let ffmpeg_path = app.shell().sidecar("ffmpeg").unwrap().into_path();
```
Pass this path to yt-dlp via `--ffmpeg-location <path>`.

**Bundle size impact:**
- yt-dlp binary: ~10-15 MB (Python-frozen executable)
- ffmpeg static binary: ~50-80 MB per platform
- Total per platform: ~65-95 MB — acceptable for a desktop app, but worth communicating to users.

---

## YouTube Search: yt-dlp vs YouTube Data API v3

### Decision: yt-dlp search (Recommended)

Use `yt-dlp "ytsearch10:query" --dump-json --flat-playlist` instead of the YouTube Data API v3.

**Why yt-dlp search wins:**
- No API key required. No quota limits (YouTube API v3 gives 10,000 units/day free; a search costs 100 units = 100 searches/day limit).
- No server infrastructure. Pure local execution.
- Returns the same data yt-dlp uses for downloading — metadata is always compatible.
- Users don't need to configure anything; the app works out of the box.

**Tradeoffs to accept:**
- Search results are slightly slower (2-5s round trip vs ~500ms API) — mitigate with TanStack Query loading states and a loading animation.
- Results may differ from YouTube's ranked algorithm. Generally acceptable for music search.
- No official SLA — yt-dlp search can break if YouTube changes its API. Bundled version pinning mitigates this.

**When to use YouTube Data API v3:**
- If you need exact match quality (official music videos vs covers, etc.)
- If you need autocomplete suggestions
- Neither applies to this project's core use case.

---

## In-App Audio Preview

### Decision: Web Audio API via HTML `<audio>` element

For the 30-60 second preview feature:
- Use yt-dlp to fetch the direct stream URL without downloading: `yt-dlp --get-url --format bestaudio[ext=webm]/bestaudio URL`
- Pass the URL to an HTML `<audio>` element in the frontend.
- No Rust involvement needed for playback — the WebView handles it.

**Caveat (MEDIUM confidence):** YouTube stream URLs are time-limited (typically 6 hours) and may require cookies or bot-verification bypass. yt-dlp handles this via its extractor, but the raw URL may not work in all WebView environments. An alternative is to stream the audio through Tauri's localhost server or pipe chunks — this needs a Phase 1 spike to validate. Flag this as a technical risk.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| React | Svelte | If bundle size is critical or team has Svelte expertise. Svelte compiles to vanilla JS with no runtime — smallest possible bundle. |
| React | Vue 3 | If team prefers Options API or has Vue background. Equivalent capability to React for this app. |
| zustand | Redux Toolkit | If app grows to need time-travel debugging or strict action logging. Overkill for a music downloader. |
| TanStack Query | SWR | SWR is fine but TanStack Query has better manual trigger support (needed for user-initiated search). |
| Bundled yt-dlp | System yt-dlp | If targeting CLI-savvy users who maintain their own tools, or if 15MB matters. |
| Bundled ffmpeg | System ffmpeg | Same conditions as system yt-dlp. |
| yt-dlp search | YouTube Data API v3 | If quota is not a concern (paid API tier) and search quality needs to match YouTube's ranked results exactly. |
| tauri-plugin-store | SQLite (tauri-plugin-sql) | If storing download history, playlists, or relational data in Phase 2+. SQLite via tauri-plugin-sql is the standard choice then. |
| Tailwind CSS | CSS Modules | For a retro Y2K UI with lots of custom theming, CSS Modules + CSS variables is equally valid and allows more pixel-perfect control. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Electron | 10x larger bundle (~150MB baseline), higher memory usage, same JS-bridge pattern as Tauri without Rust safety | Tauri v2 (fixed constraint) |
| youtube-dl (original) | Unmaintained since 2021. yt-dlp is the active fork with 10x more frequent updates and YT breakage fixes | yt-dlp |
| `tauri::api::process` (v1 API) | Removed in Tauri v2. Using it means you're on v1 docs by mistake | `tauri-plugin-shell` v2 |
| Node.js child_process from frontend | Tauri's security model forbids direct system process spawning from JS. All process invocation must go through Rust commands | Rust `tauri-plugin-shell` Command |
| `youtube-search-api` npm package | Unofficial scraper — breaks frequently, no relation to yt-dlp's extractors, hard to maintain | yt-dlp search mode |
| `fluent-ffmpeg` npm package | Requires Node.js runtime; Tauri frontend runs in WebView without Node.js access. ffmpeg must be invoked from Rust, not JS | yt-dlp's built-in `--ffmpeg-location` flag |
| Redux | Overkill state management for a single-window desktop app. Adds boilerplate with no benefit at this scale | zustand |
| CSS-in-JS (styled-components, emotion) | Adds JS runtime overhead in an environment where the WebView is already performance-sensitive. No SSR benefit in desktop | Tailwind CSS or CSS Modules |

---

## Stack Patterns by Variant

**If the download queue grows complex (Phase 2+):**
- Add `tauri-plugin-sql` with SQLite to store download history, queue state, and metadata.
- Keep zustand for in-memory UI state; persist to SQLite for durability across crashes.

**If audio preview via direct URL fails in WebView:**
- Implement a Tauri localhost server (using `tauri::async_runtime` + a minimal HTTP server crate like `axum`) to proxy audio chunks.
- This is a known workaround for restricted YouTube stream URLs in WebView contexts.

**If macOS Gatekeeper causes sidecar issues:**
- Sidecars must be code-signed on macOS. Use `tauri build --target` with an Apple Developer certificate for distribution.
- For local dev, `xattr -cr` on the binary removes quarantine flags.

**If Windows Defender flags yt-dlp:**
- This is a known false positive for Python-frozen executables. Users must allowlist the app or the sidecar binary.
- Nothing you can do at the code level; document in the installer.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| tauri 2.x | tauri-plugin-shell 2.x | Major version must match. Tauri v1 plugins will NOT work with Tauri v2. |
| tauri 2.x | @tauri-apps/api 2.x | JS API package major version must match Rust crate version. |
| React 19.x | TanStack Query 5.x | Both are current stable. TanStack Query 5 dropped React 16/17 support. |
| Vite 6.x | React 19.x | Compatible. `@vitejs/plugin-react` or `@vitejs/plugin-react-swc` for fast refresh. |
| yt-dlp (any version) | ffmpeg 6.x or 7.x | yt-dlp supports both. Prefer ffmpeg 7.x for newer codec support. |
| Tailwind CSS 4.x | Vite 6.x | Tailwind v4 changed config format — no `tailwind.config.js` by default, uses CSS-based config. Check migration docs if coming from v3. |

---

## Installation

```bash
# Scaffold new Tauri v2 app (React + TypeScript + Vite)
npm create tauri-app@latest youtube-downloader -- --template react-ts

# Navigate to project
cd youtube-downloader

# Frontend dependencies
npm install @tauri-apps/api @tauri-apps/plugin-shell @tauri-apps/plugin-dialog @tauri-apps/plugin-store @tauri-apps/plugin-fs
npm install zustand @tanstack/react-query
npm install -D tailwindcss @tailwindcss/vite typescript @types/react @types/react-dom

# Rust plugin dependencies (add to src-tauri/Cargo.toml)
# tauri-plugin-shell = "2"
# tauri-plugin-dialog = "2"
# tauri-plugin-store = "2"
# tauri-plugin-fs = "2"
# serde = { version = "1", features = ["derive"] }
# serde_json = "1"
# tokio = { version = "1", features = ["full"] }
# regex = "1"

# yt-dlp binary download (example for macOS ARM — repeat per platform)
mkdir -p src-tauri/binaries
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos \
  -o src-tauri/binaries/yt-dlp-aarch64-apple-darwin
chmod +x src-tauri/binaries/yt-dlp-aarch64-apple-darwin

# ffmpeg — download platform-appropriate static build and place in src-tauri/binaries/
# Naming convention: ffmpeg-{target-triple}[.exe on Windows]
```

---

## Confidence Notes

| Area | Confidence | Notes |
|------|------------|-------|
| Tauri v2 plugin API (`tauri-plugin-shell`, etc.) | MEDIUM | Tauri v2 went stable Oct 2024. Plugin names and patterns are well-documented in training data, but exact crate versions should be verified at crates.io before locking. |
| yt-dlp sidecar pattern | MEDIUM | The external binary / sidecar approach is the established community pattern for Tauri + yt-dlp. Specific `tauri.conf.json` keys (`externalBin`) are confirmed in training data for Tauri v2. |
| ffmpeg bundling | MEDIUM | The `--ffmpeg-location` flag is a stable yt-dlp feature. Static binary sources (BtbN, evermeet.cx, johnvansickle) are well-established. Bundle size estimates are approximate. |
| yt-dlp search via `ytsearch:` | HIGH | `ytsearch10:query` is a stable yt-dlp feature documented in its README. YouTube quota limitation for Data API v3 is publicly documented. |
| Audio preview via WebView | LOW | Streaming YouTube audio directly in Tauri's WebView is not well-documented. YouTube URL expiry and bot detection may require a proxy approach. Needs a Phase 1 spike. |
| React over Svelte/Vue | MEDIUM | Choice based on ecosystem size argument, not a definitive Tauri recommendation. Svelte would also work well. |
| Tailwind v4 config format change | MEDIUM | Tailwind v4 changed configuration significantly. If Tailwind v3 is the latest stable at time of build, use v3 patterns instead. Verify before starting. |

---

## Sources

- Training knowledge of Tauri v2 stable release (October 2024) — core architecture, plugin system, sidecar pattern
- Training knowledge of yt-dlp README — search syntax (`ytsearch:`), `--ffmpeg-location`, `--dump-json`, `--flat-playlist`
- Training knowledge of YouTube Data API v3 quota documentation — 10,000 units/day, search costs 100 units
- Training knowledge of React 19, Vite 6, TanStack Query 5, zustand 5 ecosystem — stable as of August 2025
- No live web sources available (WebSearch/WebFetch/Brave blocked). All claims MEDIUM confidence unless otherwise noted.

---
*Stack research for: Tauri v2 + yt-dlp YouTube music downloader*
*Researched: 2026-03-21*
