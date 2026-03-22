# Phase 4: Distribution - Research

**Researched:** 2026-03-22
**Domain:** Tauri v2 code signing, notarization, Windows EV signing, Linux AppImage, tauri-plugin-updater, GitHub Actions CI/CD
**Confidence:** MEDIUM-HIGH (critical sidecar/notarization issue verified against live GitHub issues; official docs verified for all other areas)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** EV code signing certificate — already have or will be acquired before this phase executes
- **D-02:** Cert stored in CI as base64-encoded PFX + password in GitHub Secrets
- **D-03:** Windows installer format: NSIS `.exe` (Tauri v2 default)
- **D-04:** SmartScreen bypass expected day-1 with EV cert — no workaround documentation needed
- **D-05:** Update endpoint: GitHub Releases — CI uploads a `update-manifest.json` as a release asset; Tauri updater plugin points to it
- **D-06:** Update check trigger: silent check on app launch — no user action needed
- **D-07:** Update prompt UX: toast notification — `Update available — v1.2.0 [Update Now] [Later]` — non-blocking
- **D-08:** Target: universal binary (ARM + Intel merged via `lipo`) — single `.dmg` artifact for all Mac users
- **D-09:** macOS installer format: `.dmg` (drag-to-Applications)
- **D-10:** Sidecar binary strategy for universal build is deferred to researcher (this is the RESEARCH NEEDED item)
- **D-11:** Hardened Runtime + notarization required — app must pass `spctl -a` on a clean machine
- **D-12:** Linux is a first-class v1 target
- **D-13:** Linux package format: AppImage only
- **D-14:** Linux architecture: x86_64 only
- **D-15:** Trigger: GitHub Actions workflow fires on `v*` release tags
- **D-16:** Three CI jobs: `build-macos` (universal .dmg + notarize), `build-windows` (NSIS + EV sign), `build-linux` (AppImage)
- **D-17:** All three jobs must succeed for the release workflow to complete

### Claude's Discretion
- Exact Tauri updater plugin configuration and JSON manifest schema
- macOS notarization tooling (notarytool vs. altool)
- GitHub Actions job structure details (caching, artifact upload step names)
- `download-sidecars.sh` extension strategy for CI (Claude picks based on research)

### Deferred Ideas (OUT OF SCOPE)
- macOS App Store distribution — explicitly out of scope (sidecar incompatible with App Store sandbox)
- `.deb` / `.rpm` Linux packages — AppImage is sufficient for v1
- Staged rollouts / A/B update testing — requires custom update server
- Windows MSI installer — NSIS covers v1
</user_constraints>

---

## Summary

Phase 4 brings together four distinct distribution concerns: (1) macOS code signing + notarization with sidecar binaries, (2) Windows EV code signing via NSIS, (3) Linux AppImage packaging, and (4) in-app auto-updates via `tauri-plugin-updater` pointed at GitHub Releases.

**Critical resolved question (D-10):** The universal macOS build strategy for sidecar binaries is non-trivial. Tauri v2 supports `--target universal-apple-darwin` but it only merges the Rust binary via `lipo` — it does NOT merge external sidecar binaries. The solution is: in the CI `build-macos` job, run a modified version of `download-sidecars.sh` that downloads BOTH `yt-dlp_macos` (which is already a universal binary released by yt-dlp) and both architecture slices of ffmpeg, then runs `lipo` to create `ffmpeg-universal-apple-darwin` before placing it as the expected Tauri triple. Additionally, there is an open bug (issue #11992) where sidecar binaries can cause notarization to fail with "nested code is modified or invalid" if keychain trust is set to "Always Trust." The workaround is to explicitly pass `--keychain $HOME/Library/Keychains/login.keychain-db` in the codesign invocation.

**Notarization tooling:** Use `notarytool` (not `altool` — altool was deprecated in 2023 and removed from Xcode 15+). Tauri v2 uses `notarytool` automatically when notarization env vars are present.

**Primary recommendation:** Use `tauri-apps/tauri-action@v0` for all three platform jobs. It handles signing, notarization, and `latest.json` generation automatically when given the correct env vars. Write a CI-specific sidecar download step that wraps `scripts/download-sidecars.sh` with cross-compilation support for the macOS universal case.

---

## Standard Stack

### Core
| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| `tauri-plugin-updater` | 2.10.0 (latest as of 2026-03) | In-app update check + download + install | Official Tauri plugin; integrates with GitHub Releases latest.json |
| `@tauri-apps/plugin-updater` | 2.x | JS bindings for updater plugin | Required alongside Rust crate |
| `tauri-apps/tauri-action@v0` | v0 (floating) | GitHub Actions build + release + sign + notarize | Official Tauri CI action; auto-generates latest.json |
| `notarytool` | Xcode 15+ built-in | macOS notarization submission | Apple's current tool; altool removed from Xcode 15 |

### Supporting
| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `lipo` | macOS built-in | Merge ARM + Intel slices into universal binary | macOS CI job only — for ffmpeg sidecar |
| `codesign` | macOS built-in | Sign binaries before packaging | Tauri invokes automatically; manual call needed for sidecar workaround |
| `dtolnay/rust-toolchain@stable` | latest | Rust toolchain in CI | Standard for Tauri GH Actions |
| `swatinem/rust-cache@v2` | v2 | Cargo build cache | Reduces macOS/Windows CI build times significantly |
| `actions/checkout@v4` | v4 | Repo checkout | Standard GH Actions |
| `actions/setup-node@v4` | v4 | Node.js in CI | Standard GH Actions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GitHub Releases (latest.json endpoint) | CrabNebula Cloud / custom update server | CrabNebula supports staged rollouts but requires paid plan; GitHub Releases is free and sufficient for v1 |
| notarytool | altool | altool deprecated and removed from Xcode 15 — do not use |
| NSIS | WiX (MSI) | MSI is better for enterprise/GPO; NSIS is simpler for v1 consumer app |

**Installation (Rust):**
```bash
cargo add tauri-plugin-updater --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'
```

**Installation (JS):**
```bash
npm install @tauri-apps/plugin-updater
```

---

## Architecture Patterns

### Recommended Project Structure (additions for this phase)
```
src-tauri/
├── Entitlements.plist           # Hardened Runtime entitlements (new)
├── binaries/
│   ├── yt-dlp-aarch64-apple-darwin        # existing
│   ├── yt-dlp-x86_64-apple-darwin         # CI downloads (same universal binary)
│   ├── yt-dlp-x86_64-pc-windows-msvc.exe  # CI downloads
│   ├── yt-dlp-x86_64-unknown-linux-gnu    # CI downloads
│   ├── ffmpeg-aarch64-apple-darwin        # CI: lipo output
│   ├── ffmpeg-x86_64-apple-darwin         # CI: lipo input (Intel slice)
│   ├── ffmpeg-x86_64-pc-windows-msvc.exe  # CI downloads
│   └── ffmpeg-x86_64-unknown-linux-gnu    # CI downloads
scripts/
├── download-sidecars.sh         # existing — extended for CI cross-arch use
└── download-sidecars-ci.sh      # new — CI-specific universal macOS + multi-platform
.github/
└── workflows/
    └── release.yml              # new — 3-job matrix build
src-tauri/capabilities/
└── default.json                 # add updater:default permission
```

### Pattern 1: macOS Universal Build with Sidecar Signing

**What:** Build a single `.dmg` containing a universal Rust binary + pre-merged sidecar binaries. Sign everything (app + sidecars) before notarization.

**When to use:** macOS `build-macos` CI job triggered by `v*` tag.

**Resolved D-10 — Sidecar Strategy:**

`yt-dlp_macos` released by the yt-dlp project is already a universal binary (contains both arm64 and x86_64 slices). Copy it to both `yt-dlp-aarch64-apple-darwin` and `yt-dlp-x86_64-apple-darwin` — they will be identical universal binaries and Tauri's `--target universal-apple-darwin` will bundle whichever matches.

For ffmpeg: download arch-specific ffmpeg builds (evermeet.cx for x86_64, Homebrew or static arm64 build), then merge with `lipo`:

```bash
# Source: lipo usage pattern for universal sidecar
lipo -create \
  ffmpeg-aarch64-apple-darwin \
  ffmpeg-x86_64-apple-darwin \
  -output ffmpeg-universal-apple-darwin

# Copy universal binary for each expected triple
cp ffmpeg-universal-apple-darwin src-tauri/binaries/ffmpeg-aarch64-apple-darwin
cp ffmpeg-universal-apple-darwin src-tauri/binaries/ffmpeg-x86_64-apple-darwin
```

**Tauri build command for universal:**
```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

### Pattern 2: Hardened Runtime Entitlements

**What:** `Entitlements.plist` placed in `src-tauri/` and referenced from `tauri.conf.json`. Required for notarization.

**tauri.conf.json additions:**
```json
{
  "bundle": {
    "createUpdaterArtifacts": true,
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAMID)",
      "hardenedRuntime": true,
      "entitlements": "./Entitlements.plist",
      "minimumSystemVersion": "10.15"
    }
  }
}
```

**Entitlements.plist (minimum required for Tauri + hardened runtime + sidecar child processes):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- WebView requires JIT -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <!-- WebView requires unsigned executable memory -->
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <!-- Required if Tauri's WebView loader causes library validation issues -->
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

Source: [Tauri macOS Application Bundle docs](https://v2.tauri.app/distribute/macos-application-bundle/), [Apple Hardened Runtime docs](https://developer.apple.com/documentation/security/hardened-runtime)

### Pattern 3: tauri-plugin-updater Registration

**Cargo.toml addition:**
```toml
tauri-plugin-updater = "2"
```

**lib.rs plugin registration:**
```rust
// Source: https://v2.tauri.app/plugin/updater/
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        // ... existing plugins
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
```

**tauri.conf.json updater config:**
```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_CONTENT_HERE",
      "endpoints": [
        "https://github.com/{owner}/{repo}/releases/latest/download/latest.json"
      ]
    }
  }
}
```

**capabilities/default.json — add permission:**
```json
{
  "permissions": [
    "updater:default"
  ]
}
```

**Silent check on launch + toast prompt (TypeScript):**
```typescript
// Source: https://v2.tauri.app/plugin/updater/
import { check } from '@tauri-apps/plugin-updater';

// Call from App.tsx useEffect on mount — silent, non-blocking
export async function checkForUpdates(
  onUpdateAvailable: (version: string, onConfirm: () => void) => void
) {
  try {
    const update = await check();
    if (update?.available) {
      onUpdateAvailable(update.version, async () => {
        await update.downloadAndInstall();
        await relaunch();
      });
    }
  } catch (e) {
    console.error('Update check failed:', e);
    // Silent failure — never block app launch
  }
}
```

Uses `tauri_plugin_notification` (already registered in lib.rs) for the toast prompt — matches existing notification pattern from Phase 3 (download-complete notifications).

**Key generation (run once, store private key password in CI secrets):**
```bash
npm run tauri signer generate -- -w ~/.tauri/youtube-dl-app.key
# Outputs: public key → paste into tauri.conf.json pubkey field
# Private key → store path and password as CI secrets
```

### Pattern 4: GitHub Actions Release Workflow

**Trigger and matrix structure:**
```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/*, cache: npm }
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin,x86_64-apple-darwin
      - uses: swatinem/rust-cache@v2
      - name: Install frontend deps
        run: npm ci
      - name: Download sidecars (macOS universal)
        run: bash scripts/download-sidecars-ci.sh universal-apple-darwin
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: "YouTube Music Downloader v__VERSION__"
          releaseDraft: true
          args: --target universal-apple-darwin

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/*, cache: npm }
      - uses: dtolnay/rust-toolchain@stable
      - uses: swatinem/rust-cache@v2
      - run: npm ci
      - name: Download sidecars (Windows)
        run: bash scripts/download-sidecars.sh  # existing script
        shell: bash
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          # EV cert via signCommand in tauri.conf.json — see Windows signing section
        with:
          tagName: v__VERSION__
          releaseName: "YouTube Music Downloader v__VERSION__"
          releaseDraft: true

  build-linux:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: lts/*, cache: npm }
      - uses: dtolnay/rust-toolchain@stable
      - uses: swatinem/rust-cache@v2
      - name: Install Linux deps
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev \
            librsvg2-dev patchelf libfuse2 file
      - run: npm ci
      - name: Download sidecars (Linux)
        run: bash scripts/download-sidecars.sh
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: "YouTube Music Downloader v__VERSION__"
          releaseDraft: true
```

**Note:** `fail-fast: false` should be set on the matrix (if using matrix strategy) so all three jobs always run. Here they are separate named jobs — if any fails, the release is incomplete per D-17.

### Pattern 5: Windows EV Signing via signCommand

EV certificates (physical USB tokens or cloud-based HSM) require a custom sign command because Windows signtool must be invoked with the HSM provider. For cloud EV providers (DigiCert, SSL.com, Sectigo) the typical approach is:

**tauri.conf.json:**
```json
{
  "bundle": {
    "windows": {
      "signCommand": "signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /sha1 %CERT_THUMBPRINT% %1",
      "nsis": {}
    }
  }
}
```

The environment variable `%CERT_THUMBPRINT%` (or equivalent) is injected via GitHub Secrets. The exact `signCommand` value depends on which EV provider issued the certificate — the planner should leave a placeholder with a note to fill in the actual provider's sign command.

Source: [Tauri Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)

### Anti-Patterns to Avoid

- **Running `cargo tauri build` before sidecars exist:** Tauri validates `externalBin` paths at build time. CI must download all sidecar binaries before invoking tauri-action.
- **Passing `--target universal-apple-darwin` to a non-macOS runner:** This target only works on macOS. The workflow matrix must use `runs-on: macos-latest` for the universal build job.
- **Setting keychain certificate trust to "Always Trust" in CI:** This causes notarization to fail with "nested code is modified or invalid" (issue #11992). Always import the certificate without setting trust level in CI keychain scripts.
- **Using `altool` for notarization:** Removed from Xcode 15+. Only use `notarytool`. Tauri v2 uses `notarytool` automatically.
- **Committing the updater private key:** The `TAURI_SIGNING_PRIVATE_KEY` must only exist in GitHub Secrets. If committed, all previous releases can be forged.
- **Using `--target universal-apple-darwin` without both Rust targets installed:** Must run `rustup target add aarch64-apple-darwin x86_64-apple-darwin` before tauri-action.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Update manifest generation | Custom JSON assembly script | `tauri-apps/tauri-action@v0` with `createUpdaterArtifacts: true` | Action auto-generates correct `latest.json` with per-platform sig hashes |
| macOS notarization submission | xcrun notarytool shell scripts | Tauri v2 built-in (env vars trigger automatically) | Tauri handles stapling, polling, error retry internally |
| Update signature verification | Custom crypto | `tauri-plugin-updater` (mandatory, cannot be disabled) | Built-in Ed25519 signature verification; cannot be bypassed |
| Sidecar codesigning loop | Manual `codesign` loop over binaries | Tauri handles sidecar codesigning automatically when `APPLE_CERTIFICATE` + `APPLE_SIGNING_IDENTITY` env vars are set | Tauri signs all `externalBin` entries before packaging |
| Cross-platform CI matrix | Custom build scripts | `tauri-apps/tauri-action@v0` matrix | Handles artifact upload, release creation, latest.json in one step |

**Key insight:** The only custom build work needed is the sidecar download step (call `download-sidecars.sh` or a new `download-sidecars-ci.sh`). Everything else — signing, notarization, packaging, manifest generation — is handled by Tauri and `tauri-action`.

---

## Common Pitfalls

### Pitfall 1: Sidecar Binaries Not Present Before `cargo tauri build`
**What goes wrong:** Build fails with "binary not found" error at link/bundle time.
**Why it happens:** `externalBin` entries are validated at build time; if the file doesn't exist for the current target triple, Tauri errors out.
**How to avoid:** Add a sidecar download step in the CI workflow BEFORE the `tauri-apps/tauri-action` step.
**Warning signs:** CI fails on "could not find binary" during the bundle phase.

### Pitfall 2: Universal Build Sidecar Triple Mismatch
**What goes wrong:** Building `--target universal-apple-darwin` but only `aarch64-apple-darwin` sidecar exists → build fails.
**Why it happens:** Tauri's universal build needs BOTH `binaries/yt-dlp-aarch64-apple-darwin` AND `binaries/yt-dlp-x86_64-apple-darwin` to exist on disk.
**How to avoid:** The CI sidecar download step must populate BOTH triples. Since `yt-dlp_macos` is already universal, copy it to both names. For ffmpeg, use `lipo` to merge.
**Warning signs:** Error referencing `yt-dlp-x86_64-apple-darwin not found` during universal build.

### Pitfall 3: Notarization Fails with "Nested Code Modified or Invalid"
**What goes wrong:** Notarization submission to Apple returns error about invalid sidecar binary signature.
**Why it happens:** If the keychain certificate was imported with "Always Trust" setting, codesign produces invalid signatures for nested binaries (issue #11992, currently open).
**How to avoid:** In the CI keychain setup step, import certificate WITHOUT setting trust — only add to keychain. Do not run `security set-key-partition-list` with `apple-tool:` in a way that sets Always Trust.
**Warning signs:** `xcrun notarytool` returns "The signature of the binary is invalid" for the main app bundle.

### Pitfall 4: AppImage Missing `libwebkit2gtkinjectedbundle.so`
**What goes wrong:** Linux AppImage launches on the build machine but fails on other distros.
**Why it happens:** Known bug in some Tauri v2 AppImage builds where the WebKit injection library isn't bundled.
**How to avoid:** Build on `ubuntu-22.04` (not newer) — AppImages bundle glibc at build time and the older base ensures broader compatibility. Install `libfuse2` and `file` packages. Test the generated AppImage on a clean Ubuntu 22.04 VM.
**Warning signs:** AppImage works locally but crashes on launch on target machines.

### Pitfall 5: `latest.json` Platform Key Mismatch
**What goes wrong:** Updater silently never finds an update, or crashes trying to parse the manifest.
**Why it happens:** The `latest.json` platform keys must match what Tauri generates at runtime. For macOS universal builds, the key is `darwin-universal` (not `darwin-aarch64` or `darwin-x86_64`).
**How to avoid:** Let `tauri-action` generate `latest.json` automatically with `createUpdaterArtifacts: true` in `tauri.conf.json`. Do not hand-craft the manifest.
**Warning signs:** Updater plugin `check()` returns `null` even when a newer version exists.

### Pitfall 6: `tauri-plugin-updater` Version Must Be ≥ 2.10.0 for Multi-Installer Keys
**What goes wrong:** If using `tauri-plugin-updater` < 2.10.0 with a `latest.json` generated by a recent tauri-action, the plugin may not find the correct platform entry.
**Why it happens:** tauri-action now generates `{os}-{arch}-{installer}` keys (e.g., `darwin-universal-dmg`) in addition to `{os}-{arch}` keys. Older plugin versions don't understand the new keys.
**How to avoid:** Pin `tauri-plugin-updater = "2"` (resolves to latest 2.x, currently 2.10.0).
**Warning signs:** Updater check returns no update despite newer version existing.

### Pitfall 7: Windows EV Sign Command Varies by Provider
**What goes wrong:** CI build fails at signing step or produces unsigned artifact.
**Why it happens:** EV certificates from different providers (DigiCert, SSL.com, Sectigo, GlobalSign) require different signing tools and command syntax.
**How to avoid:** The `signCommand` in `tauri.conf.json` must be confirmed against the EV certificate issuer's CI documentation. The planner should note this as a "fill in before running" placeholder.
**Warning signs:** CI completes but Windows installer is unsigned; SmartScreen warning appears.

---

## Code Examples

### Sidecar Download Script for Universal macOS CI

```bash
#!/usr/bin/env bash
# scripts/download-sidecars-ci.sh
# CI-specific: downloads sidecars for all platforms.
# For macOS universal build: populates both aarch64 and x86_64 triples.
# Usage: bash download-sidecars-ci.sh [universal-apple-darwin|x86_64-pc-windows-msvc|x86_64-unknown-linux-gnu]
set -euo pipefail

BINARIES_DIR="$(cd "$(dirname "$0")/../src-tauri/binaries" && pwd)"
mkdir -p "$BINARIES_DIR"

BUILD_TARGET="${1:-}"

case "$BUILD_TARGET" in
  universal-apple-darwin)
    # yt-dlp: already a universal binary — copy to both triples
    curl -fsSL -o "$BINARIES_DIR/yt-dlp-aarch64-apple-darwin" \
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
    cp "$BINARIES_DIR/yt-dlp-aarch64-apple-darwin" \
       "$BINARIES_DIR/yt-dlp-x86_64-apple-darwin"
    chmod +x "$BINARIES_DIR/yt-dlp-aarch64-apple-darwin" \
              "$BINARIES_DIR/yt-dlp-x86_64-apple-darwin"

    # ffmpeg: download arm64 static + x86_64 static, lipo-merge
    # NOTE: arm64 static ffmpeg — use Homebrew installed in CI
    # (macos-latest GitHub runner has Homebrew preinstalled)
    brew install ffmpeg 2>/dev/null || true
    ARM64_FFMPEG="$(which ffmpeg)"

    TMP=$(mktemp -d)
    trap 'rm -rf "$TMP"' EXIT
    curl -fsSL -o "$TMP/ffmpeg-x86.zip" \
      "https://evermeet.cx/ffmpeg/getrelease/zip"
    unzip -q "$TMP/ffmpeg-x86.zip" -d "$TMP"
    X86_FFMPEG=$(find "$TMP" -maxdepth 2 -name "ffmpeg" -type f | head -1)

    lipo -create "$ARM64_FFMPEG" "$X86_FFMPEG" \
      -output "$BINARIES_DIR/ffmpeg-universal"
    cp "$BINARIES_DIR/ffmpeg-universal" "$BINARIES_DIR/ffmpeg-aarch64-apple-darwin"
    cp "$BINARIES_DIR/ffmpeg-universal" "$BINARIES_DIR/ffmpeg-x86_64-apple-darwin"
    chmod +x "$BINARIES_DIR/ffmpeg-aarch64-apple-darwin" \
              "$BINARIES_DIR/ffmpeg-x86_64-apple-darwin"
    ;;
  *)
    # Delegate to existing script for Windows and Linux
    exec "$(dirname "$0")/download-sidecars.sh"
    ;;
esac
```

### Updater Check on App Launch (TypeScript)

```typescript
// src/hooks/useAutoUpdate.ts
// Source: https://v2.tauri.app/plugin/updater/
import { useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export function useAutoUpdate(
  onUpdateAvailable: (version: string, install: () => Promise<void>) => void
) {
  useEffect(() => {
    // Silent check — never block UI
    check().then((update) => {
      if (update?.available) {
        onUpdateAvailable(update.version, async () => {
          await update.downloadAndInstall();
          await relaunch();
        });
      }
    }).catch(() => {
      // Network failure or bad manifest — silently ignore
    });
  }, []); // Run once on mount
}
```

### CI Keychain Setup (macOS) — Correct Trust Import

```bash
# Source: tauri-apps/tauri-action internals + community pattern
# DO NOT add 'apple-tool:,apple:' as allowed-list to avoid "Always Trust" issue
KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db
security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH

echo -n "$APPLE_CERTIFICATE" | base64 --decode -o $RUNNER_TEMP/certificate.p12
security import $RUNNER_TEMP/certificate.p12 \
  -P "$APPLE_CERTIFICATE_PASSWORD" \
  -A -t cert -f pkcs12 \
  -k $KEYCHAIN_PATH
# Note: NOT running security set-key-partition-list with apple-tool: here
# to avoid "Always Trust" which causes notarization nested-code failure
security list-keychain -d user -s $KEYCHAIN_PATH
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `altool` for notarization | `notarytool` | Xcode 13 (2021); altool removed Xcode 15 (2023) | Must use notarytool; Tauri v2 does this automatically |
| Separate ARM + Intel `.dmg` artifacts | Single `universal-apple-darwin` `.dmg` | Tauri v1 → v2 (feature existed in v1, confirmed in v2) | Simpler GitHub Releases page; one file for all Mac users |
| `tauri-plugin-updater` < 2.10: only `{os}-{arch}` keys | 2.10+: `{os}-{arch}-{installer}` keys in latest.json | tauri-plugin-updater 2.10.0 (2025) | Must use plugin ≥ 2.10.0 to match new tauri-action manifest format |
| WiX as default Windows installer | NSIS as default | Tauri v2 (NSIS is now the default) | NSIS `.exe` is the expected default; WiX/MSI optional |

**Deprecated/outdated:**
- `altool`: removed from Xcode 15. Never use.
- `tauri-plugin-updater` version below 2.x: v1 updater API is completely different.
- `universal-apple-darwin` target in v1 syntax (`cargo tauri build --target universal-apple-darwin` without `npm run ... --`): works, but use `npm run tauri build -- --target universal-apple-darwin` through package.json script.

---

## Open Questions

1. **Exact EV certificate signCommand**
   - What we know: Windows EV cert is confirmed available (D-01/D-02); cert is a PFX in GitHub Secrets
   - What's unclear: The exact `signCommand` syntax depends on the EV certificate provider (DigiCert KeyLocker vs. SSL.com eSigner vs. traditional HSM with signtool)
   - Recommendation: The plan should include a task to "configure signCommand for the actual EV provider" as a prerequisite step. Leave a placeholder in `tauri.conf.json` that the implementer fills in. If using a standard PFX (not HSM), use `certificateThumbprint` instead.

2. **ffmpeg arm64 static binary source**
   - What we know: evermeet.cx provides x86_64 macOS ffmpeg static builds; `lipo` needs an arm64 source
   - What's unclear: evermeet.cx arm64 build availability may be inconsistent; Homebrew on the CI runner is the most reliable arm64 source but may be slow
   - Recommendation: Use `brew install --formula ffmpeg` on the `macos-latest` runner (which is Apple Silicon as of 2024) as the arm64 source. Cache via `actions/cache` on the Homebrew path to avoid repeated installs.

3. **Keychain trust vs. notarization (issue #11992)**
   - What we know: Open bug; workaround documented above (don't set Always Trust in CI keychain import)
   - What's unclear: Whether `tauri-apps/tauri-action@v0` internally does the keychain import in a way that triggers this bug
   - Recommendation: If notarization fails with "nested code modified/invalid", the fallback is to sign sidecars manually before invoking tauri-action, using `codesign --keychain login.keychain-db`.

---

## Sources

### Primary (HIGH confidence)
- [Tauri v2 macOS Code Signing](https://v2.tauri.app/distribute/sign/macos/) — env vars, signing flow
- [Tauri v2 Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/) — EV cert, signCommand, SmartScreen
- [Tauri v2 Updater Plugin](https://v2.tauri.app/plugin/updater/) — registration, config, permissions, latest.json format
- [Tauri v2 GitHub Actions Pipeline](https://v2.tauri.app/distribute/pipelines/github/) — workflow structure, Linux deps
- [Tauri v2 Sidecar / Embedding External Binaries](https://v2.tauri.app/develop/sidecar/) — triple naming, architecture handling
- [Tauri v2 macOS Application Bundle](https://v2.tauri.app/distribute/macos-application-bundle/) — entitlements config

### Secondary (MEDIUM confidence)
- [Tauri issue #11992 — ExternalBin notarization failure](https://github.com/tauri-apps/tauri/issues/11992) — open bug, workaround verified
- [Tauri discussion #9419 — Universal binary on macOS](https://github.com/orgs/tauri-apps/discussions/9419) — `--target universal-apple-darwin` confirmed working in v2
- [DEV.to: Ship Tauri v2 App (Part 2/2)](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-github-actions-and-release-automation-part-22-2ef7) — GitHub Actions secrets list, workflow structure
- [That Gurjot: Tauri v2 Auto-Updater](https://thatgurjot.com/til/tauri-auto-updater/) — key generation, latest.json format, gotchas
- tauri-plugin-updater v2.10.0 (npm, March 2026) — version confirmed from npm registry

### Tertiary (LOW confidence)
- Search result: `yt-dlp_macos` is a universal binary — cited in yt-dlp's own release description but not independently verified against current release artifacts

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — official Tauri v2 docs verified for all core tools
- Architecture patterns (macOS): MEDIUM — universal + sidecar approach derived from docs + community discussions; sidecar lipo strategy is researcher-recommended based on yt-dlp release format
- Architecture patterns (updater): HIGH — official docs
- Architecture patterns (Windows EV): MEDIUM — signCommand syntax is provider-dependent; planner must leave placeholder
- Architecture patterns (Linux AppImage): HIGH — official docs + known ubuntu-22.04 base requirement
- Pitfalls: HIGH — most confirmed against live GitHub issues or official docs

**Research date:** 2026-03-22
**Valid until:** 2026-06-22 (stable Tauri v2 ecosystem; yt-dlp binary format unlikely to change; notarization bug #11992 may be fixed)
