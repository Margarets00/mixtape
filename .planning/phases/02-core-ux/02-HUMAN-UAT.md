---
status: passed
phase: 02-core-ux
source: [02-VERIFICATION.md]
started: 2026-03-21T17:04:42Z
updated: 2026-03-22T17:10:00Z
---

## Current Test

Approved by user 2026-03-22.

## Tests

### 1. Audio preview playback
expected: Run `cargo tauri dev`, search for any song, click PREVIEW. Player bar shows "~ loading preview... ~" while the 60s clip downloads, then plays audio with title, play/pause button, and a filling progress bar.
result: passed

### 2. Semaphore concurrency limit
expected: Queue 3+ items and click DOWNLOAD ALL. At most 2 items show "Downloading" state simultaneously. The third stays "Pending" until one completes.
result: passed

### 3. API key persistence across restarts
expected: Enter an API key in Settings, save it, quit the app completely, reopen. API key is pre-populated in the masked input field.
result: passed

### 4. QUEUE-05 exponential backoff countdown
expected: When yt-dlp returns a 429 response during download, the queue item shows "Retrying in Xs... (attempt N/3)" countdown with CANCEL available. After 3 failed attempts, item enters error state with manual RETRY button.
result: passed

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
