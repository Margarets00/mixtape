#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$REPO = "Margarets00/mixtape"

# ── Latest release tag ───────────────────────────────────────────────────────
Write-Host "Fetching latest mixtape release..."
$release = Invoke-RestMethod "https://api.github.com/repos/$REPO/releases/latest"
$tag     = $release.tag_name
$version = $tag.TrimStart('v')
Write-Host "Found: $tag"

# ── Download installer ───────────────────────────────────────────────────────
$url = "https://github.com/$REPO/releases/download/$tag/mixtape_${version}_x64-setup-np.exe"
$tmp = Join-Path $env:TEMP "mixtape-setup.exe"

Write-Host "Downloading $url..."
$client = New-Object System.Net.WebClient
$client.DownloadFile($url, $tmp)

Write-Host "Installing..."
# /S = NSIS silent install
Start-Process -FilePath $tmp -ArgumentList "/S" -Wait
Remove-Item $tmp -Force

Write-Host "✓ mixtape installed"

# ── Dependency check ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Checking dependencies..."
$missing = @()
if (-not (Get-Command yt-dlp  -ErrorAction SilentlyContinue)) { $missing += "yt-dlp" }
if (-not (Get-Command ffmpeg  -ErrorAction SilentlyContinue)) { $missing += "ffmpeg" }

if ($missing.Count -eq 0) {
  Write-Host "✓ yt-dlp and ffmpeg found — you're all set!"
} else {
  Write-Host "⚠️  Missing: $($missing -join ', ')"
  Write-Host ""
  Write-Host "mixtape needs yt-dlp and ffmpeg to download music."
  Write-Host ""
  Write-Host "Install with winget:"
  foreach ($dep in $missing) {
    Write-Host "  winget install $dep"
  }
  Write-Host ""
  Write-Host "After installing, the app's Settings page can also locate existing binaries manually."
}
