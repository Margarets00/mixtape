#!/usr/bin/env bash
# scripts/download-sidecars-ci.sh
# CI-specific: downloads sidecars for all platforms.
# For macOS universal build: populates both aarch64 and x86_64 triples.
# Usage: bash download-sidecars-ci.sh [universal-apple-darwin|x86_64-pc-windows-msvc|x86_64-unknown-linux-gnu]
set -euo pipefail

BINARIES_DIR="$(cd "$(dirname "$0")/.." && pwd)/src-tauri/binaries"
mkdir -p "$BINARIES_DIR"

BUILD_TARGET="${1:-}"

case "$BUILD_TARGET" in
  universal-apple-darwin)
    # yt-dlp: already a universal binary — copy to both triples
    echo "Downloading yt-dlp (universal macOS)..."
    curl -fsSL -o "$BINARIES_DIR/yt-dlp-aarch64-apple-darwin" \
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
    cp "$BINARIES_DIR/yt-dlp-aarch64-apple-darwin" \
       "$BINARIES_DIR/yt-dlp-x86_64-apple-darwin"
    chmod +x "$BINARIES_DIR/yt-dlp-aarch64-apple-darwin" \
              "$BINARIES_DIR/yt-dlp-x86_64-apple-darwin"

    echo "Downloading/preparing ffmpeg (universal macOS via lipo)..."

    # arm64 ffmpeg: use Homebrew on the macOS CI runner (macos-latest is Apple Silicon)
    brew install ffmpeg 2>/dev/null || true
    ARM64_FFMPEG="$(which ffmpeg)"

    TMP=$(mktemp -d)
    trap 'rm -rf "$TMP"' EXIT

    # x86_64 ffmpeg: download from evermeet.cx
    echo "Downloading ffmpeg x86_64 from evermeet.cx..."
    curl -fsSL -o "$TMP/ffmpeg-x86.zip" \
      "https://evermeet.cx/ffmpeg/getrelease/zip"
    unzip -q "$TMP/ffmpeg-x86.zip" -d "$TMP"
    X86_FFMPEG=$(find "$TMP" -maxdepth 2 -name "ffmpeg" -type f | head -1)

    if [[ -z "$X86_FFMPEG" ]]; then
      echo "ERROR: x86_64 ffmpeg binary not found in zip archive" >&2
      exit 1
    fi

    # lipo-merge arm64 + x86_64 into universal binary
    echo "Merging arm64 + x86_64 ffmpeg with lipo..."
    lipo -create "$ARM64_FFMPEG" "$X86_FFMPEG" \
      -output "$BINARIES_DIR/ffmpeg-universal"

    cp "$BINARIES_DIR/ffmpeg-universal" "$BINARIES_DIR/ffmpeg-aarch64-apple-darwin"
    cp "$BINARIES_DIR/ffmpeg-universal" "$BINARIES_DIR/ffmpeg-x86_64-apple-darwin"
    chmod +x "$BINARIES_DIR/ffmpeg-aarch64-apple-darwin" \
              "$BINARIES_DIR/ffmpeg-x86_64-apple-darwin"

    echo ""
    echo "Sidecars ready for universal-apple-darwin:"
    echo "  yt-dlp-aarch64-apple-darwin  (universal)"
    echo "  yt-dlp-x86_64-apple-darwin   (universal)"
    echo "  ffmpeg-aarch64-apple-darwin  (universal lipo)"
    echo "  ffmpeg-x86_64-apple-darwin   (universal lipo)"
    ;;
  *)
    # Delegate to existing script for Windows and Linux
    exec "$(dirname "$0")/download-sidecars.sh"
    ;;
esac
