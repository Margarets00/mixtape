# Phase 4: Distribution - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

The app can be downloaded and run by any user on macOS (ARM + Intel), Windows (x64), and Linux (x64) without Gatekeeper, SmartScreen, or AV warnings. A CI/CD pipeline produces signed artifacts automatically on each release tag, and users receive in-app update prompts.

Does NOT cover: macOS App Store distribution (sidecar incompatible with App Store sandbox).

</domain>

<decisions>
## Implementation Decisions

### Windows Code Signing

- **D-01:** EV code signing certificate — already have or will be acquired before this phase executes
- **D-02:** Cert stored in CI as base64-encoded PFX + password in GitHub Secrets
- **D-03:** Windows installer format: NSIS `.exe` (Tauri v2 default)
- **D-04:** SmartScreen bypass expected day-1 with EV cert — no workaround documentation needed

### Auto-updater

- **D-05:** Update endpoint: GitHub Releases — CI uploads a `update-manifest.json` as a release asset; Tauri updater plugin points to it
- **D-06:** Update check trigger: **silent check on app launch** — no user action needed to discover updates
- **D-07:** Update prompt UX: toast notification — `Update available — v1.2.0 [Update Now] [Later]` — non-blocking, user can dismiss

### macOS Build

- **D-08:** Target: **universal binary** (ARM + Intel merged via `lipo`) — single `.dmg` artifact for all Mac users
- **D-09:** macOS installer format: `.dmg` (drag-to-Applications)
- **D-10:** Sidecar binary strategy for universal build (yt-dlp + ffmpeg for both architectures) is **deferred to researcher** — this is the RESEARCH NEEDED risk from ROADMAP.md; researcher must resolve before planner designs the CI job
- **D-11:** Hardened Runtime + notarization required — app must pass `spctl -a` on a clean machine

### Linux

- **D-12:** Linux is a **first-class v1 target** — Linux CI job must pass before a release is cut
- **D-13:** Linux package format: **AppImage only** (portable, distro-agnostic)
- **D-14:** Linux architecture: x86_64 only

### CI/CD Structure

- **D-15:** Trigger: GitHub Actions workflow fires on `v*` release tags
- **D-16:** Three CI jobs: `build-macos` (universal .dmg + notarize), `build-windows` (NSIS + EV sign), `build-linux` (AppImage)
- **D-17:** All three jobs must succeed for the release workflow to complete — Linux is not a soft/optional job

### Claude's Discretion

- Exact Tauri updater plugin configuration and JSON manifest schema
- macOS notarization tooling (notarytool vs. altool)
- GitHub Actions job structure details (caching, artifact upload step names)
- `download-sidecars.sh` extension strategy for CI (Claude picks based on research)

</decisions>

<specifics>
## Specific Ideas

- Universal binary is preferred over "two separate downloads" — one `.dmg` for all Mac users keeps the GitHub Releases page clean
- Toast notification for update prompt matches the existing retro UI theme — should use the same Y2K styling variables as the rest of the app
- The `download-sidecars.sh` script in `scripts/` is the established sidecar acquisition pattern — CI should extend/call it rather than inlining binary downloads into the workflow YAML

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing sidecar infrastructure
- `scripts/download-sidecars.sh` — Current sidecar download script (supports macOS ARM/Intel, Windows x64, Linux x64); CI must extend this pattern
- `src-tauri/tauri.conf.json` — Current bundle config: `targets: "all"`, `externalBin: ["binaries/yt-dlp", "binaries/ffmpeg"]`; signing config is absent and must be added
- `src-tauri/Cargo.toml` — Current dependencies; `tauri-plugin-updater` is NOT yet added and must be added for in-app updates

### Planning artifacts
- `.planning/ROADMAP.md` §Phase 4 — Success criteria, plan breakdown (04-01: macOS, 04-02: Windows+Linux+updater), risks
- `.planning/STATE.md` §Blockers/Concerns — EV cert lead time note, macOS sidecar notarization risk, Linux first-class question

### Prior phase patterns
- `src/components/SettingsTab.tsx` — Existing settings UI; auto-update prompt should match this component's retro styling
- `src-tauri/src/lib.rs` — Plugin registration pattern; `tauri-plugin-updater` must be registered here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/download-sidecars.sh`: Already handles all three platforms with correct Tauri triple naming — CI should call this script rather than duplicating binary download logic in workflow YAML
- `src-tauri/binaries/`: Currently contains `yt-dlp-aarch64-apple-darwin` and `ffmpeg-aarch64-apple-darwin` — universal build needs both triples populated before `cargo tauri build`

### Established Patterns
- `tauri_plugin_store` already initialized in `lib.rs` — update check "don't ask again" or "last checked" state can use existing store
- `tauri_plugin_notification` already initialized in `lib.rs` — toast-style notifications are available (same plugin used for download-complete notifications in Phase 3)

### Integration Points
- `tauri.conf.json`: Needs `bundle.macOS.signingIdentity`, `bundle.macOS.entitlements`, `bundle.windows.certificateThumbprint` (or equivalent) added
- `src-tauri/Cargo.toml`: Add `tauri-plugin-updater = "2"` dependency
- `src-tauri/src/lib.rs`: Register updater plugin + add `check_for_updates` Tauri command
- `src/components/SettingsTab.tsx` (or `App.tsx`): Add auto-update check on launch + toast prompt logic

</code_context>

<deferred>
## Deferred Ideas

- macOS App Store distribution — explicitly out of scope (sidecar incompatible with App Store sandbox)
- `.deb` / `.rpm` Linux packages — AppImage is sufficient for v1; add post-v1 if users request
- Staged rollouts / A/B update testing — requires custom update server; GitHub Releases is sufficient for v1
- Windows MSI installer — NSIS covers v1; MSI can be added if enterprise users need it

</deferred>

---

*Phase: 04-distribution*
*Context gathered: 2026-03-22*
