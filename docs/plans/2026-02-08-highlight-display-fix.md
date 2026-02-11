# Highlight Display Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the highlight display pipeline so that matched text never disappears mid-reading and section lookups work correctly for all documents in the corpus.

**Architecture:** Three targeted fixes across two files. (1) MatchedTextWidget stops replacing visible content with a loading screen. (2) Section lookup handles duplicate section names and normalizes title comparison. (3) Re-lock preserves the accumulated highlight range when switching to a better-matched document.

**Tech Stack:** React Native (Expo), JavaScript, existing App.js state management.

---

## Background

- `isLoading: true` currently replaces the entire MatchedTextWidget with "Loading text..." — even when content is already on screen and the fetch is a cache hit
- "Gems of Divine Mysteries" has two sections with identical titles; `Array.find()` returns the first (2-paragraph title page), not the main content (67 paragraphs)
- When the app re-locks to a better document (e.g. source text instead of compilation), `firstParagraphNum` resets because the document changed, losing the accumulated highlight range

---

## Task 1: Display Fix — Content Never Hides Behind Loading State

**Files:**
- Modify: `components/MatchedTextWidget.js` (line ~92)

**Step 1: Read the current loading check**

Open `components/MatchedTextWidget.js` and find (around line 92):
```jsx
if (isLoading) {
  return (
    <View style={styles.widgetContainer}>
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading text...</Text>
      </View>
    </View>
  );
}
```

**Step 2: Change the condition**

Replace only the condition — add `&& !matchedDocument`:
```jsx
if (isLoading && !matchedDocument) {
  return (
    <View style={styles.widgetContainer}>
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading text...</Text>
      </View>
    </View>
  );
}
```

This means "Loading text..." only shows when there is genuinely nothing to display yet. Once a document is on screen, the existing "..." indicator in the header (added previously) handles the loading feedback.

**Step 3: Verify**

Read the modified file and confirm the change is correct. Check that no other logic references `isLoading` in a way that would conflict.

**Step 4: Commit**

```bash
git add components/MatchedTextWidget.js
git commit -m "fix: keep matched text visible during loading state"
```

---

## Task 2: Robust Section Lookup — Fix Gems and Duplicate Section Names

**Files:**
- Modify: `App.js` — `fetchDocumentContent` function (around line 187)

**Step 1: Read the current section lookup**

Find the section lookup in `fetchDocumentContent` (around line 187):
```js
const sectionObj = doc.sections?.find(s => s.title === section);
```

**Step 2: Replace with robust lookup**

Replace that single line with:
```js
// Normalize for comparison: handle whitespace and case differences
const normalize = s => s?.trim().toLowerCase();
const matchingSections = doc.sections?.filter(
  s => normalize(s.title) === normalize(section)
);
// If multiple sections share the same title (e.g. Gems of Divine Mysteries),
// pick the one that contains enough paragraphs to include the matched paragraphNum
const sectionObj = matchingSections?.find(s => (s.paragraphs?.length ?? 0) >= paragraphNum)
  ?? matchingSections?.[0];
```

**Step 3: Add diagnostic logging for failed lookups**

Find the existing log after the section lookup (around line 188):
```js
console.log('[FETCH] Section found:', sectionObj ? 'yes' : 'no');
```
Replace with:
```js
if (!sectionObj) {
  console.log('[FETCH] Section not found:', section,
    'Available:', doc.sections?.map(s => `"${s.title}"(${s.paragraphs?.length}p)`).join(', '));
} else {
  console.log('[FETCH] Section found:', sectionObj.title,
    `(${sectionObj.paragraphs?.length} paragraphs)`);
}
```

**Step 4: Verify**

Read the modified `fetchDocumentContent` function to confirm correctness. The lookup now:
- Trims and lowercases before comparing
- When multiple sections share a name, picks the one with enough paragraphs for the matched paragraph number
- Falls back to the first match if none have enough paragraphs
- Logs exactly which sections are available when a lookup fails

**Step 5: Commit**

```bash
git add App.js
git commit -m "fix: robust section lookup handles duplicate titles and case differences"
```

---

## Task 3: Re-lock Preservation — Keep firstParagraphNum When Switching Documents

**Files:**
- Modify: `App.js` — `performTextMatch` debounce callback (around line 290)

**Step 1: Read the current progression check**

Find (around line 290):
```js
const isSameParagraph = isSameSection && ctx.currentParagraphNum === match.paragraphNum;
const isNextParagraph = isSameSection && match.paragraphNum === ctx.currentParagraphNum + 1;
const isValidProgression = isSameParagraph || isNextParagraph;
```

**Step 2: Add isRelock case**

Replace with:
```js
const isSameParagraph = isSameSection && ctx.currentParagraphNum === match.paragraphNum;
const isNextParagraph = isSameSection && match.paragraphNum === ctx.currentParagraphNum + 1;
// Re-lock: switching to a better document but landing on same paragraph we already confirmed
const isRelock = !isSameSection && match.paragraphNum === ctx.currentParagraphNum;
const isValidProgression = isSameParagraph || isNextParagraph || isRelock;
```

When `isRelock` is true, `firstParagraphIndex` remains at `ctx.firstParagraphNum - 1` (preserved), so the new document immediately shows the full accumulated highlight range.

**Step 3: Add a log for re-lock events**

Find the existing log nearby (around line 297-300):
```js
if (isSameSection && !isValidProgression) {
  console.log('[MATCH] Non-sequential jump from paragraph', ctx.currentParagraphNum, 'to', match.paragraphNum, '- resetting highlight');
}
```
Add after it:
```js
if (isRelock) {
  console.log('[MATCH] Re-lock: switching from', ctx.previousDocId, 'to', match.docId,
    'at paragraph', match.paragraphNum, '- preserving highlight from paragraph', ctx.firstParagraphNum);
}
```

**Step 4: Verify**

Read the modified section and confirm:
- `isRelock` is only true when NOT same section AND same paragraphNum
- The log fires only on actual re-lock events
- The existing `firstParagraphIndex` assignment correctly uses `ctx.firstParagraphNum - 1` when `isValidProgression` is true

**Step 5: Commit**

```bash
git add App.js
git commit -m "fix: preserve highlight range when re-locking to better-matched document"
```
