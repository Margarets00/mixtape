---
status: partial
phase: 02-core-ux
source: [02-VERIFICATION.md]
started: 2026-03-21T17:04:42Z
updated: 2026-03-21T17:04:42Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Audio preview playback
expected: Run `cargo tauri dev`, search for any song, click PREVIEW. Player bar shows "~ loading preview... ~" while the 60s clip downloads, then plays audio with title, play/pause button, and a filling progress bar. Note: `asset://` protocol may not work reliably in dev mode — packaged build (`cargo tauri build`) is the authoritative test.
result: [pending]

### 2. Semaphore concurrency limit
expected: Queue 3+ items and click DOWNLOAD ALL. At most 2 items show "Downloading" state simultaneously. The third stays "Pending" until one completes.
result: [pending]

### 3. API key persistence across restarts
expected: Enter an API key in Settings, save it, quit the app completely, reopen. API key is pre-populated in the masked input field.
result: [pending]

### 4. QUEUE-05 exponential backoff countdown
expected: When yt-dlp returns a 429 response during download, the queue item shows "Retrying in Xs... (attempt N/3)" countdown with CANCEL available. After 3 failed attempts, item enters error state with manual RETRY button.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
