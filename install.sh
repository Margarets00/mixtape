#!/usr/bin/env bash
set -euo pipefail

REPO="Margarets00/mixtape"

# ── Detect OS / arch ────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) ;;
  Linux)  ;;
  *)
    echo "Unsupported OS: $OS"
    echo "Download manually: https://github.com/${REPO}/releases"
    exit 1
    ;;
esac

# ── Latest release tag ───────────────────────────────────────────────────────
echo "Fetching latest mixtape release..."
TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
VERSION="${TAG#v}"
echo "Found: ${TAG}"

# ── Download & install ───────────────────────────────────────────────────────
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

case "$OS" in
  Darwin)
    URL="https://github.com/${REPO}/releases/download/${TAG}/mixtape_${VERSION}_universal-np.dmg"
    echo "Downloading ${URL}..."
    curl -fsSL --progress-bar "$URL" -o "$TMP/mixtape.dmg"
    echo "Installing to /Applications..."
    hdiutil attach "$TMP/mixtape.dmg" -mountpoint "$TMP/mnt" -quiet
    cp -R "$TMP/mnt/mixtape.app" /Applications/
    hdiutil detach "$TMP/mnt" -quiet
    echo "✓ Installed: /Applications/mixtape.app"
    ;;
  Linux)
    if [ "$ARCH" = "x86_64" ]; then
      URL="https://github.com/${REPO}/releases/download/${TAG}/mixtape_${VERSION}_amd64-np.AppImage"
    else
      echo "Unsupported Linux arch: $ARCH"
      echo "Download manually: https://github.com/${REPO}/releases"
      exit 1
    fi
    DEST="$HOME/.local/bin/mixtape"
    mkdir -p "$HOME/.local/bin"
    echo "Downloading ${URL}..."
    curl -fsSL --progress-bar "$URL" -o "$DEST"
    chmod +x "$DEST"
    echo "✓ Installed: $DEST"
    # Warn if ~/.local/bin is not in PATH
    if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
      echo ""
      echo "  Add to PATH: export PATH=\"\$HOME/.local/bin:\$PATH\""
    fi
    ;;
esac

# ── Dependency check ─────────────────────────────────────────────────────────
echo ""
echo "Checking dependencies..."
MISSING=()
command -v yt-dlp  &>/dev/null || MISSING+=("yt-dlp")
command -v ffmpeg  &>/dev/null || MISSING+=("ffmpeg")

if [ ${#MISSING[@]} -eq 0 ]; then
  echo "✓ yt-dlp and ffmpeg found — you're all set!"
else
  echo "⚠️  Missing: ${MISSING[*]}"
  echo ""
  echo "mixtape needs yt-dlp and ffmpeg to download music."
  echo ""
  if [[ "$OS" == "Darwin" ]]; then
    echo "  brew install ${MISSING[*]}"
  else
    for dep in "${MISSING[@]}"; do
      case "$dep" in
        yt-dlp)  echo "  pip install yt-dlp  (or: sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp)" ;;
        ffmpeg)  echo "  sudo apt install ffmpeg  (or equivalent for your distro)" ;;
      esac
    done
  fi
  echo ""
  echo "After installing, the app's Settings page can also locate existing binaries manually."
fi
