---
phase: quick
plan: 260322-sek
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/SearchTab.tsx
autonomous: true
must_haves:
  truths:
    - "User sees skeleton loading rows and 'Searching...' text while search is in progress"
    - "Loading indicator disappears when results arrive"
  artifacts:
    - path: "src/components/SearchTab.tsx"
      provides: "Search loading skeleton UI"
---

<objective>
Replace the plain "~ searching... ~" text (lines 512-524) with a richer loading indicator: animated skeleton result rows + "Searching..." label, matching the existing playlist skeleton pattern already in the same file (lines 419-441).

Purpose: Give the user visual feedback that the search is actively working, especially for yt-dlp fallback searches which can take several seconds.
Output: Enhanced loading state in SearchTab.tsx
</objective>

<execution_context>
@/Users/margarets/Dev_margaret/youtube-downloader/.claude/get-shit-done/workflows/execute-plan.md
@/Users/margarets/Dev_margaret/youtube-downloader/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/SearchTab.tsx
@src/components/SearchResultRow.tsx (for skeleton row height reference)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace search loading state with skeleton rows and spinner text</name>
  <files>src/components/SearchTab.tsx</files>
  <action>
Replace the `isSearching` block (lines 512-524) with:

1. A "Searching..." label styled with the existing font vars:
   - fontFamily: var(--font-display), fontSize: 12px, color: var(--color-pink-dark)
   - Add a simple CSS dot animation after the text (use the same inline style block that already hosts the shimmer keyframes for playlists — reuse the @keyframes shimmer already defined in the playlist section, or hoist it to render once unconditionally)

2. Three skeleton rows mimicking SearchResultRow layout:
   - Each row: height 72px (matches SearchResultRow's thumbnail + padding), marginBottom 1px
   - Use the same shimmer gradient pattern already used for playlist skeletons:
     background: linear-gradient(90deg, var(--color-pink) 25%, var(--color-white) 50%, var(--color-pink) 75%)
     backgroundSize: 200% 100%
     animation: shimmer 1.5s infinite
   - Add border: var(--border-style) to match the app's design language

3. Hoist the @keyframes shimmer style block:
   - Currently it is only rendered inside the `playlistLoading` conditional (line 421-426)
   - Move it to render unconditionally (or at least also when isSearching is true) so the search skeletons can use the same animation
   - Simplest approach: extract the style tag with @keyframes shimmer to render once at the top of the component return, outside both conditionals

Keep the existing playlist skeleton code working — only share the keyframes, do not break the playlist loading UI.
  </action>
  <verify>
    <automated>cd /Users/margarets/Dev_margaret/youtube-downloader && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    - When isSearching=true, three shimmer skeleton rows appear with "~ searching... ~" header text
    - When isSearching=false, skeletons disappear and results (or no-results message) show
    - Playlist skeleton loading still works identically
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes
- Visual: trigger a search in the app, observe skeleton rows during loading
</verification>

<success_criteria>
Search loading state shows animated skeleton rows instead of plain text. Playlist loading skeletons remain unaffected.
</success_criteria>

<output>
After completion, create `.planning/quick/260322-sek-skeleton-searching/260322-sek-SUMMARY.md`
</output>
