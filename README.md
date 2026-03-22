# mixtape 🎵

A personal YouTube music downloader with a Y2K retro aesthetic. Built for private, non-commercial use only.

> ♩ JingJing only, Not for commercial purpose ♩

## Screenshots

| Search | Queue |
|--------|-------|
| ![Search](docs/screenshots/01-search.png) | ![Queue](docs/screenshots/02-queue.png) |

| History | Settings |
|---------|----------|
| ![History](docs/screenshots/03-history.png) | ![Settings](docs/screenshots/04-settings.png) |

## Features

- **Search** — Find YouTube videos by keyword; falls back to yt-dlp scraping when no API key is set
- **Queue** — Add tracks to a download queue and batch-download them at once
- **History** — Browse past downloads and re-queue any track with one click
- **Settings** — Optional YouTube Data API key, custom save folder, and configurable filename pattern (`{title}`, `{artist}`, `{channel}`, `{year}`, `{track_num}`)

## Built With

- [Tauri](https://tauri.app) — native macOS/Windows/Linux shell
- React + TypeScript — frontend UI
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — video/audio extraction
- [ffmpeg](https://ffmpeg.org) — audio conversion

## Download

Pre-built binaries are available on the [Releases](../../releases) page.

| Platform | Arch |
|----------|------|
| macOS | Universal (Apple Silicon + Intel) |
| Windows | x86-64 |
| Linux | x86-64 |

## Build From Source

```bash
# Prerequisites: Node.js, Rust, Cargo
npm install
bash scripts/download-sidecars.sh   # downloads yt-dlp + ffmpeg binaries
npm run tauri build
```

## Legal Notice & Copyright Disclaimer

This project is a **personal, non-commercial tool** created for private use only. It is not affiliated with, endorsed by, or connected to YouTube, Google LLC, or any content creators.

**Important:**

- Downloaded content remains the intellectual property of its respective copyright holders.
- This tool does **not** circumvent DRM or any access-control measures.
- Downloading YouTube videos may violate [YouTube's Terms of Service](https://www.youtube.com/t/terms). You are solely responsible for ensuring your use complies with applicable laws and platform terms in your jurisdiction.
- This software is provided "as is" for educational and personal archival purposes. The author accepts no liability for misuse.

**Do not use this tool to:**
- Download and redistribute copyrighted content
- Generate revenue from downloaded material
- Infringe on any creator's rights

Please support artists and content creators by consuming their work through official channels.

## License

[MIT](LICENSE) — the source code is freely available, but this license does not grant any rights to content downloaded through the tool. See Legal Notice above.
