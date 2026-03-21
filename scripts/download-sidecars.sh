#!/usr/bin/env bash
# download-sidecars.sh
# Downloads yt-dlp and ffmpeg sidecar binaries for the current platform.
# Binaries are named with the Rust target triple as required by Tauri v2 sidecar convention.
# Run this before `cargo tauri dev` or `cargo tauri build`.

set -euo pipefail

# Determine host target triple
if TARGET_TRIPLE=$(rustc --print host-tuple 2>/dev/null); then
  : # Rust 1.84+ supports --print host-tuple
else
  TARGET_TRIPLE=$(rustc -Vv | grep host | cut -f2 -d' ')
fi

echo "Detected target triple: $TARGET_TRIPLE"

# Create binaries directory
BINARIES_DIR="$(dirname "$0")/../src-tauri/binaries"
mkdir -p "$BINARIES_DIR"
BINARIES_DIR="$(cd "$BINARIES_DIR" && pwd)"

echo "Binaries directory: $BINARIES_DIR"

# ─── yt-dlp ─────────────────────────────────────────────────────────────────

YTDLP_OUT="$BINARIES_DIR/yt-dlp-$TARGET_TRIPLE"

if [[ "$TARGET_TRIPLE" == *"-windows-"* ]]; then
  YTDLP_OUT="${YTDLP_OUT}.exe"
fi

echo "Downloading yt-dlp..."

case "$TARGET_TRIPLE" in
  aarch64-apple-darwin | x86_64-apple-darwin)
    curl -fsSL -o "$YTDLP_OUT" \
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
    ;;
  x86_64-pc-windows-msvc)
    curl -fsSL -o "$YTDLP_OUT" \
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    ;;
  x86_64-unknown-linux-gnu)
    curl -fsSL -o "$YTDLP_OUT" \
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
    ;;
  *)
    echo "ERROR: Unsupported target triple: $TARGET_TRIPLE" >&2
    exit 1
    ;;
esac

# ─── ffmpeg ──────────────────────────────────────────────────────────────────

FFMPEG_OUT="$BINARIES_DIR/ffmpeg-$TARGET_TRIPLE"

if [[ "$TARGET_TRIPLE" == *"-windows-"* ]]; then
  FFMPEG_OUT="${FFMPEG_OUT}.exe"
fi

echo "Downloading ffmpeg..."

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

case "$TARGET_TRIPLE" in
  aarch64-apple-darwin | x86_64-apple-darwin)
    # Prefer system ffmpeg if available (avoids architecture mismatch on Apple Silicon)
    if command -v ffmpeg &>/dev/null; then
      echo "Using system ffmpeg: $(which ffmpeg)"
      cp "$(which ffmpeg)" "$FFMPEG_OUT"
    else
      # Fallback: download from evermeet.cx (x86_64 only — use Homebrew on Apple Silicon)
      echo "WARNING: No system ffmpeg found. Downloading from evermeet.cx (x86_64 only)."
      echo "         On Apple Silicon, install ffmpeg via Homebrew: brew install ffmpeg"
      FFMPEG_ZIP="$TMP_DIR/ffmpeg.zip"
      curl -fsSL -o "$FFMPEG_ZIP" \
        "https://evermeet.cx/ffmpeg/getrelease/zip"
      unzip -q "$FFMPEG_ZIP" -d "$TMP_DIR"
      FFMPEG_BIN=$(find "$TMP_DIR" -maxdepth 2 -type f -name "ffmpeg" | head -1)
      if [[ -z "$FFMPEG_BIN" ]]; then
        echo "ERROR: ffmpeg binary not found in zip archive" >&2
        exit 1
      fi
      cp "$FFMPEG_BIN" "$FFMPEG_OUT"
    fi
    ;;
  x86_64-pc-windows-msvc)
    FFMPEG_ZIP="$TMP_DIR/ffmpeg.zip"
    curl -fsSL -o "$FFMPEG_ZIP" \
      "https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip"
    unzip -q "$FFMPEG_ZIP" -d "$TMP_DIR"
    FFMPEG_BIN=$(find "$TMP_DIR" -type f -name "ffmpeg.exe" | head -1)
    if [[ -z "$FFMPEG_BIN" ]]; then
      echo "ERROR: ffmpeg.exe not found in zip archive" >&2
      exit 1
    fi
    cp "$FFMPEG_BIN" "$FFMPEG_OUT"
    ;;
  x86_64-unknown-linux-gnu)
    FFMPEG_TAR="$TMP_DIR/ffmpeg.tar.xz"
    curl -fsSL -o "$FFMPEG_TAR" \
      "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
    tar -xJf "$FFMPEG_TAR" -C "$TMP_DIR"
    FFMPEG_BIN=$(find "$TMP_DIR" -type f -name "ffmpeg" | head -1)
    if [[ -z "$FFMPEG_BIN" ]]; then
      echo "ERROR: ffmpeg binary not found in tar archive" >&2
      exit 1
    fi
    cp "$FFMPEG_BIN" "$FFMPEG_OUT"
    ;;
esac

# ─── Permissions ─────────────────────────────────────────────────────────────

if [[ "$TARGET_TRIPLE" != *"-windows-"* ]]; then
  chmod +x "$YTDLP_OUT"
  chmod +x "$FFMPEG_OUT"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "Sidecars ready for $TARGET_TRIPLE:"
echo "  yt-dlp:  $(basename "$YTDLP_OUT")"
echo "  ffmpeg:  $(basename "$FFMPEG_OUT")"
