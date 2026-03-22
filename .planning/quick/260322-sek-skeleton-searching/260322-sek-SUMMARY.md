---
phase: quick
plan: 260322-sek
subsystem: search-ui
tags: [skeleton, loading, ux, search]
dependency_graph:
  requires: []
  provides: [search-skeleton-loading]
  affects: [SearchTab]
tech_stack:
  added: []
  patterns: [shimmer-animation, css-keyframes-hoisting]
key_files:
  modified:
    - src/components/SearchTab.tsx
decisions:
  - "Hoisted @keyframes shimmer to top-level style tag so both playlist and search skeletons share one animation definition"
metrics:
  duration: 3min
  completed: 2026-03-22
---

# Phase quick Plan 260322-sek: Skeleton Searching Summary

**One-liner:** Animated shimmer skeleton rows with "Searching..." label during search loading state, reusing existing shimmer animation pattern from playlist skeletons.

## What Was Built

Replaced the plain `~ searching... ~ ` text block (formerly lines 512-524) in `SearchTab.tsx` with:

1. A "~ searching... ~" label styled with `--font-display`, 12px, `--color-pink-dark` — consistent with the rest of the app's tilde-wrapped labels.
2. Three shimmer skeleton rows (72px height, 1px margin, `--border-style` border) using the same `linear-gradient` shimmer pattern already used for playlist loading skeletons.
3. The `@keyframes shimmer` style block was hoisted to the top of the component's `return` so both the playlist skeletons and the new search skeletons share one animation definition — removed the duplicate from the `playlistLoading` conditional.

## Tasks

| # | Name | Status | Commit |
|---|------|--------|--------|
| 1 | Replace search loading state with skeleton rows and spinner text | Done | 625010f |

## Verification

- `npx tsc --noEmit` — passed, no errors
- Playlist skeleton loading unaffected (keyframes shared, not removed)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/components/SearchTab.tsx` — modified, exists
- Commit `625010f` — verified
