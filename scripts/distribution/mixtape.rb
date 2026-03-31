# Homebrew Cask formula — lives in https://github.com/Margarets00/homebrew-mixtape
# Install: brew tap Margarets00/mixtape && brew install --cask mixtape
#
# CI auto-updates version + sha256 on each release via update-homebrew-tap.sh

cask "mixtape" do
  version "0.1.9"
  sha256 "PLACEHOLDER_SHA256_UNIVERSAL_DMG"

  url "https://github.com/Margarets00/mixtape/releases/download/v#{version}/mixtape_#{version}_universal-np.dmg"
  name "mixtape"
  desc "Personal YouTube music downloader with a Y2K retro aesthetic"
  homepage "https://github.com/Margarets00/mixtape"

  app "mixtape.app"

  # yt-dlp and ffmpeg are required but not bundled in this variant
  depends_on formula: "yt-dlp"
  depends_on formula: "ffmpeg"

  caveats <<~EOS
    mixtape requires yt-dlp and ffmpeg (installed automatically as dependencies).
  EOS
end
