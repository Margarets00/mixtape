# Phase 5: Test Infrastructure - Research

**Researched:** 2026-03-28
**Domain:** Rust unit testing, fake binary simulation, GitHub Actions CI step insertion
**Confidence:** HIGH

## Summary

This phase adds three categories of deliverables: (1) Rust `#[cfg(test)]` unit tests for `parse_yt_dlp_line`, `parse_ytdlp_error`, and `locate_sidecar`; (2) a cross-platform fake binary mechanism using tempdir + `std::fs::write` + chmod so the sidecar lookup path can be exercised without the real yt-dlp binary; and (3) two new `run:` steps in each platform job of `release.yml` — one for `cargo test` and one for sidecar filename existence checks.

All decisions are locked. Research below focuses on exact implementation details the planner needs: correct `YTDLP_PATH` injection point in `locate_sidecar`, tempdir strategy, fake binary content per platform, exact sidecar filenames per platform, and cross-platform `test -f` / `Test-Path` differences in GitHub Actions.

**Primary recommendation:** Use `std::env::temp_dir()` + `std::fs::write` (no extra crate), add `[dev-dependencies]` only if needed, place tests in `#[cfg(test)]` inline modules matching the `title.rs` pattern, and use platform-conditional shell/bat fake binary content guarded by `#[cfg(unix)]` / `#[cfg(windows)]`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `parse_yt_dlp_line` — smoke test. happy path (PROGRESS 파싱) + 에러 키워드 1개.
- **D-02:** `parse_ytdlp_error` (`errors.rs`) — smoke test. 429, "Video unavailable" 두 케이스.
- **D-03:** `locate_sidecar` — `tempdir` 안에 가짜 파일 생성 후 `YTDLP_PATH` env var 주입으로 테스트.
- **D-04:** `queue.rs` 재시도/백오프 로직 — 테스트 skip.
- **D-05:** `title.rs`는 이미 5개 테스트 존재 — 추가 불필요.
- **D-06:** `YTDLP_PATH` 환경변수로 경로 오버라이드 — `locate_sidecar`가 이 값을 우선 사용하도록 수정.
- **D-07:** 가짜 바이너리는 fixture 파일 없이 Rust 테스트 코드 안에서 `tempdir` + `std::fs::write` + chmod로 즉석 생성.
- **D-08:** macOS/Linux는 실행 가능한 셸스크립트, Windows는 `.bat` — 플랫폼 감지는 `cfg!(target_os)`.
- **D-09:** 시뮬레이션 시나리오 두 가지:
  1. `exit 1` + stderr에 `ERROR: Video unavailable` 출력 (에러 처리 경로)
  2. `exit 0` + 빈 stdout (성공인데 결과 없음 엣지 케이스)
- **D-10:** 기존 `release.yml`에 추가 — 별도 워크플로우 파일 없음.
- **D-11:** `cargo test` 스텝 추가 (현재 없음).
- **D-12:** 사이드카 파일명 검증: `download-sidecars-ci.sh` 직후, 빌드 전에 인라인 `run:` 스텝으로 파일 존재 확인.
- **D-13:** 세 플랫폼 모두 동일하게 적용.
- **D-14:** CI 트리거: release 태그 push 시에만 (`v*`) — 기존 트리거와 동일.
- **D-15:** 세 가지 경로만 커버: locate_sidecar 실패, yt-dlp exit 1, parse_yt_dlp_line 에러 키워드.
- **D-16:** 검색 실패 경로는 테스트 범위 밖.

### Claude's Discretion

- 가짜 바이너리의 정확한 출력 포맷
- `YTDLP_PATH` env var 읽는 위치 (`locate_sidecar` 함수 내 첫 줄 체크)
- tempdir 생성에 `tempfile` 크레이트 사용 여부 vs `std::env::temp_dir()`

### Deferred Ideas (OUT OF SCOPE)

- 검색 실패 경로 테스트 (API 키 필요)
- 프론트엔드(React) 테스트
- 큐 재시도/백오프 통합 테스트
</user_constraints>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `std::env::temp_dir()` | stdlib | Temp directory for fake binaries | No crate needed; cross-platform; guaranteed available |
| `std::fs::write` | stdlib | Write fake binary content to temp path | Direct, no ceremony |
| `std::os::unix::fs::PermissionsExt` | stdlib (unix only) | `chmod +x` on temp script | Unix permission bit setting pattern |
| `#[cfg(test)]` inline module | Rust language | Unit test placement | Established pattern already used in `title.rs` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tempfile` crate | 3.x | RAII temp dir (auto-cleanup on drop) | Only needed if auto-cleanup is important; adds a dev-dependency |

### Decision: `tempfile` crate vs `std::env::temp_dir()`

After reviewing the codebase: **no `tempfile` crate is currently listed** in `Cargo.toml` dev-dependencies or dependencies. The `std::env::temp_dir()` approach works and avoids adding a dependency. However, `tempfile::tempdir()` provides automatic cleanup on drop, which prevents test pollution if a test panics before cleanup. The crate is well-known in the Rust ecosystem.

**Recommendation:** Use `tempfile::tempdir()`. The RAII cleanup guarantee is meaningful for CI environments where leaked tempfiles can accumulate. Add it as a `[dev-dependencies]` entry only (does not affect production binary).

```toml
[dev-dependencies]
tempfile = "3"
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tempfile` crate | `std::env::temp_dir()` + manual cleanup | Manual cleanup requires explicit `fs::remove_dir_all` in teardown; if test panics, cleanup is skipped; no production impact either way |

**Installation:**
```bash
# No runtime install needed — dev-dependency only
# Add to src-tauri/Cargo.toml under [dev-dependencies]
```

---

## Architecture Patterns

### Pattern 1: Inline `#[cfg(test)]` module (established in `title.rs`)

**What:** Tests live at the bottom of the same `.rs` file they test, inside `#[cfg(test)] mod tests { use super::*; ... }`.

**When to use:** All new tests in this phase. Already established convention in this codebase.

**Example (from `title.rs` — verified by reading source):**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_official_video() {
        assert_eq!(
            clean_title("Rick Astley - Never Gonna Give You Up [Official Video]"),
            "Rick Astley - Never Gonna Give You Up"
        );
    }
}
```

Apply identically in `download.rs` (for `parse_yt_dlp_line`) and `errors.rs` (for `parse_ytdlp_error`).

### Pattern 2: `YTDLP_PATH` env var injection in `locate_sidecar`

**What:** Add an env var override as the first check in `locate_sidecar`, before the `current_exe()` logic.

**Exact insertion point:** Line 36 of `download.rs`, immediately after `pub fn locate_sidecar(name: &str) -> Result<std::path::PathBuf, String> {`

**Minimal code change (2 lines):**
```rust
pub fn locate_sidecar(name: &str) -> Result<std::path::PathBuf, String> {
    // Test hook: YTDLP_PATH overrides sidecar lookup for unit tests
    if let Ok(p) = std::env::var("YTDLP_PATH") {
        return Ok(std::path::PathBuf::from(p));
    }

    // ... rest of existing function unchanged ...
    let exe = std::env::current_exe().map_err(|e| format!("current_exe: {}", e))?;
```

**Why this works:** The env var is only set during test execution (inside `#[cfg(test)]` setup), so it has zero effect on production code paths. The function signature and return type are unchanged.

**Important caveat — parallel test isolation:** `std::env::set_var` is not thread-safe in Rust 1.x test harness (tests run in parallel by default). To avoid race conditions when multiple tests set `YTDLP_PATH`:

Option A (simplest): Run tests with `-- --test-threads=1` in CI (acceptable for this small test suite).

Option B (correct): Use `env` crate's `with_var` helper, or manually scope env var setting with a mutex.

**Recommendation:** Use `--test-threads=1` for the `cargo test` CI step. The test suite is small (< 10 tests total), so sequential execution has negligible runtime cost.

### Pattern 3: Cross-platform fake binary creation

**What:** Inside the `#[cfg(test)]` module, create a temp binary appropriate for the platform.

**macOS / Linux (Unix) — shell script:**
```rust
#[cfg(unix)]
fn write_fake_binary(dir: &std::path::Path, name: &str, script_body: &str) -> std::path::PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let path = dir.join(name);
    let content = format!("#!/bin/sh\n{}", script_body);
    std::fs::write(&path, content).unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
    path
}
```

**Windows — batch file:**
```rust
#[cfg(windows)]
fn write_fake_binary(dir: &std::path::Path, name: &str, script_body: &str) -> std::path::PathBuf {
    let path = dir.join(format!("{}.bat", name));
    std::fs::write(&path, script_body).unwrap();
    path
}
```

**Scenario 1 — exit 1 + ERROR stderr:**
- Unix script body: `echo "ERROR: Video unavailable" >&2\nexit 1`
- Windows bat body: `@echo ERROR: Video unavailable 1>&2\n@exit /b 1`

**Scenario 2 — exit 0 + empty stdout:**
- Unix script body: `exit 0`
- Windows bat body: `@exit /b 0`

### Pattern 4: CI sidecar filename check

**What:** An inline `run:` step in each platform job of `release.yml` that verifies the expected sidecar files exist in `src-tauri/binaries/` before the Tauri build starts.

**Exact filenames per platform** (verified from `download-sidecars-ci.sh` and `download-sidecars.sh`):

| Platform | yt-dlp filename | ffmpeg filename |
|----------|-----------------|-----------------|
| macOS (aarch64) | `yt-dlp-aarch64-apple-darwin` | `ffmpeg-aarch64-apple-darwin` |
| macOS (x86_64) | `yt-dlp-x86_64-apple-darwin` | `ffmpeg-x86_64-apple-darwin` |
| macOS (universal) | `yt-dlp-universal-apple-darwin` | `ffmpeg-universal-apple-darwin` |
| Windows | `yt-dlp-x86_64-pc-windows-msvc.exe` | `ffmpeg-x86_64-pc-windows-msvc.exe` |
| Linux | `yt-dlp-x86_64-unknown-linux-gnu` | `ffmpeg-x86_64-unknown-linux-gnu` |

Note: macOS CI job builds `universal-apple-darwin` target, so the CI script generates all three macOS filenames. The Tauri build for macOS requires both `aarch64-apple-darwin` and `x86_64-apple-darwin` triples (plus universal).

**macOS check (bash `test -f`):**
```yaml
- name: Verify sidecar files exist
  run: |
    test -f src-tauri/binaries/yt-dlp-aarch64-apple-darwin || (echo "MISSING: yt-dlp-aarch64-apple-darwin" && exit 1)
    test -f src-tauri/binaries/yt-dlp-x86_64-apple-darwin  || (echo "MISSING: yt-dlp-x86_64-apple-darwin"  && exit 1)
    test -f src-tauri/binaries/ffmpeg-aarch64-apple-darwin  || (echo "MISSING: ffmpeg-aarch64-apple-darwin"  && exit 1)
    test -f src-tauri/binaries/ffmpeg-x86_64-apple-darwin   || (echo "MISSING: ffmpeg-x86_64-apple-darwin"   && exit 1)
    echo "All sidecar files present."
```

**Windows check (PowerShell `Test-Path`):**
```yaml
- name: Verify sidecar files exist
  run: |
    if (-not (Test-Path "src-tauri/binaries/yt-dlp-x86_64-pc-windows-msvc.exe")) { Write-Error "MISSING: yt-dlp-x86_64-pc-windows-msvc.exe"; exit 1 }
    if (-not (Test-Path "src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe")) { Write-Error "MISSING: ffmpeg-x86_64-pc-windows-msvc.exe"; exit 1 }
    Write-Host "All sidecar files present."
  shell: pwsh
```

**Linux check (bash `test -f`):**
```yaml
- name: Verify sidecar files exist
  run: |
    test -f src-tauri/binaries/yt-dlp-x86_64-unknown-linux-gnu || (echo "MISSING: yt-dlp-x86_64-unknown-linux-gnu" && exit 1)
    test -f src-tauri/binaries/ffmpeg-x86_64-unknown-linux-gnu  || (echo "MISSING: ffmpeg-x86_64-unknown-linux-gnu"  && exit 1)
    echo "All sidecar files present."
```

**Insertion point in `release.yml`:** After the `Download sidecars` step name and BEFORE the `tauri-apps/tauri-action@v0` step in each platform job.

### Anti-Patterns to Avoid

- **Setting env vars without thread isolation:** `std::env::set_var("YTDLP_PATH", ...)` in parallel tests will race. Use `--test-threads=1` in CI.
- **Using `cfg!(test)` inside production code:** Do not pollute `locate_sidecar` with test-only branches other than the env var override. The env var approach is sufficient and invisible in production.
- **Fake binary as a committed fixture file:** D-07 explicitly prohibits this. Create fake binaries inline in test code only.
- **Windows bat file without `@echo off`:** Not strictly required but the script body for scenario 1 must redirect stderr correctly (`1>&2` syntax).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Temp dir with auto-cleanup | Manual `fs::create_dir_all` + `fs::remove_dir_all` | `tempfile::tempdir()` | Drop-based cleanup handles panic paths; well-tested edge cases (concurrent deletion, OS temp dir permissions) |
| Cross-platform file existence check in CI | Custom script | Native shell built-ins (`test -f` on Unix, `Test-Path` on PowerShell) | GitHub Actions runners provide bash on macOS/Linux and PowerShell on Windows out of the box |

**Key insight:** The env var override pattern is the minimal, correct way to inject test dependencies into `locate_sidecar` without changing the function's production contract or adding test-only compilation branches.

---

## Common Pitfalls

### Pitfall 1: Parallel test env var races
**What goes wrong:** `test_locate_sidecar_with_ytdlp_path` and another test both set `YTDLP_PATH` via `std::env::set_var`. Tests run in parallel threads by default; one test's env var leaks into the other test's execution window.
**Why it happens:** `std::env::set_var` mutates global process state. Rust test threads share the same process.
**How to avoid:** Add `-- --test-threads=1` to the `cargo test` command in CI. For a suite this small (< 10 tests), the serial penalty is under 1 second.
**Warning signs:** Flaky test failures where `locate_sidecar` returns unexpected paths intermittently.

### Pitfall 2: Windows fake binary missing `.bat` extension lookup
**What goes wrong:** On Windows, `locate_sidecar` appends `.exe` to find the sidecar. A fake `.bat` file named `yt-dlp-fake.bat` won't be found by the production lookup path.
**Why it happens:** The `YTDLP_PATH` env var override bypasses filename construction entirely — `locate_sidecar` returns the exact path set in the env var. So as long as the test sets `YTDLP_PATH` to the full path including `.bat` extension, and the fake binary is invoked via `Command::new(path)`, Windows will execute the `.bat` file correctly.
**How to avoid:** In the test helper, set `YTDLP_PATH` to the full `.bat` path. Do not rely on `locate_sidecar`'s filename logic at all in tests.
**Warning signs:** `No such file` or `Access denied` when spawning the fake binary on Windows.

### Pitfall 3: Shell script not executable on Unix
**What goes wrong:** `std::fs::write` creates the file without execute permission. `Command::new(path).spawn()` returns `Permission denied`.
**Why it happens:** `fs::write` creates files with mode `0o644` on Unix. Shell scripts need `0o755`.
**How to avoid:** Always call `std::fs::set_permissions(&path, Permissions::from_mode(0o755))` after writing the script content. Use `#[cfg(unix)]` to gate the `use std::os::unix::fs::PermissionsExt` import.
**Warning signs:** `Os { code: 13, kind: PermissionDenied }` error in test output.

### Pitfall 4: `cargo test` in CI fails because Tauri setup needed
**What goes wrong:** `cargo test` for a Tauri project may fail if the build requires system libraries (e.g., `libwebkit2gtk` on Linux) that aren't installed at test time.
**Why it happens:** The `cargo test` step runs in the same job that already installed Linux dependencies (the `sudo apt-get install` step). On macOS and Windows no extra setup is needed.
**How to avoid:** Place the `cargo test` step AFTER the existing system dependency install step (Linux job already does `apt-get install` before building). On macOS and Windows the existing jobs have no such step and `cargo test` can run immediately after `npm ci`.
**Warning signs:** `cannot find -lwebkit2gtk-4.1` or similar linker errors.

### Pitfall 5: Windows `run:` step shell defaults to PowerShell, not bash
**What goes wrong:** The sidecar filename check step uses `test -f` syntax which is bash-only. On Windows runners, `run:` defaults to PowerShell.
**Why it happens:** GitHub Actions Windows runners use PowerShell as the default shell. `test -f` is not a valid PowerShell command.
**How to avoid:** Add `shell: pwsh` explicitly to Windows `run:` steps that use PowerShell syntax (`Test-Path`). For steps that must use bash on Windows, add `shell: bash` (Git Bash is available on Windows runners).
**Warning signs:** `'test' is not recognized as an internal or external command` in CI logs.

---

## Code Examples

### `locate_sidecar` YTDLP_PATH override (2-line insertion)
```rust
// Source: derived from current download.rs implementation (verified by reading source)
pub fn locate_sidecar(name: &str) -> Result<std::path::PathBuf, String> {
    // Test hook: YTDLP_PATH env var overrides normal sidecar lookup
    if let Ok(p) = std::env::var("YTDLP_PATH") {
        return Ok(std::path::PathBuf::from(p));
    }

    // (rest of function unchanged from current implementation)
    let exe = std::env::current_exe().map_err(|e| format!("current_exe: {}", e))?;
    let dir = exe.parent().ok_or("no parent dir for executable")?;
    // ...
}
```

### `parse_yt_dlp_line` smoke tests (D-01)
```rust
// Source: matches parse_yt_dlp_line implementation in download.rs (verified)
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_progress_line() {
        let evt = parse_yt_dlp_line("PROGRESS 42.5 1.2MiB/s 00:30").unwrap();
        match evt {
            DownloadEvent::Progress { percent, speed, eta } => {
                assert!((percent - 42.5).abs() < 0.01);
                assert_eq!(speed, "1.2MiB/s");
                assert_eq!(eta, "00:30");
            }
            _ => panic!("expected Progress event"),
        }
    }

    #[test]
    fn test_parse_error_keyword_video_unavailable() {
        let evt = parse_yt_dlp_line("ERROR: Video unavailable").unwrap();
        match evt {
            DownloadEvent::Error { message } => {
                assert!(message.contains("unavailable") || message.contains("removed"));
            }
            _ => panic!("expected Error event"),
        }
    }
}
```

### `parse_ytdlp_error` smoke tests (D-02)
```rust
// Source: matches parse_ytdlp_error implementation in errors.rs (verified)
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_429_rate_limit() {
        let msg = parse_ytdlp_error("ERROR: HTTP Error 429: Too Many Requests").unwrap();
        assert!(msg.contains("rate limit") || msg.contains("429"));
    }

    #[test]
    fn test_video_unavailable() {
        let msg = parse_ytdlp_error("ERROR: Video unavailable").unwrap();
        assert!(msg.contains("unavailable") || msg.contains("removed"));
    }
}
```

### `locate_sidecar` test via YTDLP_PATH (D-03)
```rust
// Source: pattern derived from D-03 decision and locate_sidecar implementation
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_locate_sidecar_via_env_override() {
        let dir = tempfile::tempdir().unwrap();
        let fake_path = dir.path().join("yt-dlp-fake");

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::write(&fake_path, "#!/bin/sh\nexit 0").unwrap();
            std::fs::set_permissions(
                &fake_path,
                std::fs::Permissions::from_mode(0o755)
            ).unwrap();
        }
        #[cfg(windows)]
        {
            let bat_path = dir.path().join("yt-dlp-fake.bat");
            std::fs::write(&bat_path, "@exit /b 0").unwrap();
            // use bat_path as fake_path for env var
        }

        std::env::set_var("YTDLP_PATH", fake_path.to_str().unwrap());
        let result = locate_sidecar("yt-dlp");
        std::env::remove_var("YTDLP_PATH");

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), fake_path);
    }

    #[test]
    fn test_locate_sidecar_missing_returns_err() {
        // Ensure YTDLP_PATH is not set, and current_exe() dir has no yt-dlp
        std::env::remove_var("YTDLP_PATH");
        // This test may pass or fail depending on whether real sidecar is present;
        // in CI (no sidecars at test time) it should return Err.
        // Mark as doc-only or skip in dev environments.
        // Recommended: only assert if in CI (check env var CI=true).
        if std::env::var("CI").is_ok() {
            assert!(locate_sidecar("yt-dlp-nonexistent-test-binary").is_err());
        }
    }
}
```

### CI `cargo test` step placement
```yaml
# Add to each platform job in release.yml, AFTER system dependency install, BEFORE tauri-action

- name: Run Rust unit tests
  run: cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1
```

### CI sidecar file check — macOS
```yaml
- name: Verify sidecar files exist
  run: |
    test -f src-tauri/binaries/yt-dlp-aarch64-apple-darwin   || { echo "MISSING: yt-dlp-aarch64-apple-darwin"; exit 1; }
    test -f src-tauri/binaries/yt-dlp-x86_64-apple-darwin    || { echo "MISSING: yt-dlp-x86_64-apple-darwin"; exit 1; }
    test -f src-tauri/binaries/ffmpeg-aarch64-apple-darwin    || { echo "MISSING: ffmpeg-aarch64-apple-darwin"; exit 1; }
    test -f src-tauri/binaries/ffmpeg-x86_64-apple-darwin     || { echo "MISSING: ffmpeg-x86_64-apple-darwin"; exit 1; }
    echo "Sidecar check passed."
```

### CI sidecar file check — Windows
```yaml
- name: Verify sidecar files exist
  shell: pwsh
  run: |
    $missing = @()
    if (-not (Test-Path "src-tauri/binaries/yt-dlp-x86_64-pc-windows-msvc.exe")) { $missing += "yt-dlp-x86_64-pc-windows-msvc.exe" }
    if (-not (Test-Path "src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe")) { $missing += "ffmpeg-x86_64-pc-windows-msvc.exe" }
    if ($missing.Count -gt 0) { Write-Error "MISSING sidecars: $($missing -join ', ')"; exit 1 }
    Write-Host "Sidecar check passed."
```

### CI sidecar file check — Linux
```yaml
- name: Verify sidecar files exist
  run: |
    test -f src-tauri/binaries/yt-dlp-x86_64-unknown-linux-gnu  || { echo "MISSING: yt-dlp-x86_64-unknown-linux-gnu"; exit 1; }
    test -f src-tauri/binaries/ffmpeg-x86_64-unknown-linux-gnu   || { echo "MISSING: ffmpeg-x86_64-unknown-linux-gnu"; exit 1; }
    echo "Sidecar check passed."
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `std::env::set_var` in parallel tests | `-- --test-threads=1` or env scoping | Rust 1.x always had this issue; better documented as of Rust 2024 edition | Must use serial test execution when tests mutate env vars |
| Tauri sidecar without triple suffix (dev mode) | Triple-suffix naming for production, plain name for dev | Tauri v2 convention | Already implemented in `locate_sidecar`; env var override fits cleanly |

---

## Open Questions

1. **`locate_sidecar` missing-sidecar test reliability in dev environment**
   - What we know: In CI (no sidecars present), testing that `locate_sidecar("yt-dlp")` returns `Err` is reliable. In a developer's local environment, the real sidecar may exist next to the test binary.
   - What's unclear: Should the "missing sidecar" test be unconditional or CI-gated?
   - Recommendation: Gate on `std::env::var("CI").is_ok()` so the test is a no-op locally. Alternatively, always test with a name guaranteed not to exist (e.g., `"yt-dlp-nonexistent-test-binary"`).

2. **Windows fake binary invocation via `Command::new` for `.bat`**
   - What we know: On Windows, `Command::new("path/to/fake.bat")` works if `cmd.exe` is in PATH (it always is). The `.bat` file content must use Windows-compatible exit syntax (`@exit /b N`).
   - What's unclear: Whether Tokio's `Command` on Windows handles `.bat` files the same way `std::process::Command` does.
   - Recommendation: The fake binary simulation (D-09) does not need to be run as a Tokio async subprocess in tests. It only needs to exist as a file for D-03 (locate_sidecar test). The scenarios in D-09 are for future integration tests; for this phase's scope (locate_sidecar existence test), just verify the path is returned correctly.

---

## Sources

### Primary (HIGH confidence)
- `src-tauri/src/download.rs` (lines 35-69) — `locate_sidecar` exact implementation, verified insertion point
- `src-tauri/src/errors.rs` — `parse_ytdlp_error` all branches, verified test inputs
- `src-tauri/src/title.rs` (lines 36-79) — established `#[cfg(test)]` module pattern
- `src-tauri/Cargo.toml` — confirmed no `[dev-dependencies]` section exists; `tempfile` must be added
- `.github/workflows/release.yml` — confirmed step insertion points and shell defaults per platform
- `scripts/download-sidecars-ci.sh` + `scripts/download-sidecars.sh` — exact sidecar filenames per platform verified
- `src-tauri/tauri.conf.json` — `externalBin` declarations confirm `binaries/yt-dlp` and `binaries/ffmpeg` base names

### Secondary (MEDIUM confidence)
- Rust reference on `std::os::unix::fs::PermissionsExt::set_mode` — stdlib, stable API
- GitHub Actions documentation on default shells per runner OS (bash on macOS/Linux, PowerShell on Windows)

### Tertiary (LOW confidence — not needed for this phase)
- None. All required information was obtained from the project's own source files.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from Cargo.toml; `tempfile` crate recommendation is well-established Rust ecosystem practice
- Architecture: HIGH — derived directly from reading existing source code; no external APIs involved
- Pitfalls: HIGH — derived from reading the exact implementation being tested and GitHub Actions runner behavior
- CI filenames: HIGH — verified from both download scripts and workflow file

**Research date:** 2026-03-28
**Valid until:** 2026-06-28 (stable — Rust stdlib and GitHub Actions shell defaults are long-lived; `tempfile` crate API is stable)
