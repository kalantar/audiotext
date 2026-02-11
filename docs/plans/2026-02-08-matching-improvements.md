# Matching Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix text matching so it locks onto the correct passage quickly, advances through subsequent paragraphs as reading continues, and gives visible feedback during matching.

**Architecture:** Three independent changes to App.js plus one to MatchedTextWidget.js. No new files. No new dependencies. All changes are localized to matching input preparation, stickiness thresholds, UI state, and audio chunk size.

**Tech Stack:** React Native (Expo), existing textMatcher.js pure functions, existing AudioWorklet/ScriptProcessor audio pipeline.

---

## Background

- `findBestMatch` in `utils/textMatcher.js` scores every paragraph in the search index against the input words
- Currently ALL accumulated transcription words are passed as input — old paragraphs dominate forever
- `getLastWords` helper exists in App.js but is never called for matching (dead code)
- `SWITCH_THRESHOLD = 0.15` applies equally to "advance forward in same doc" and "jump to different doc"
- Audio chunks are 1 second (~16000 samples); halving to 500ms doubles Vosk response frequency
- `isLoading` only shows during document JSON fetch, not during the 750ms debounce matching window

---

## Task 1: Sliding Window — Activate getLastWords for Matching

**Files:**
- Modify: `App.js:94` and `App.js:108`

**Step 1: Add window size constant**

In `App.js`, after the existing `WS_SERVER_URL` constant (line 28), add:

```js
// Number of recent words to use for text matching
// Large enough for noisy/KJ-English transcription signal, small enough to track progression
const MATCH_WINDOW_WORDS = 45;
```

**Step 2: Apply window to partial transcription match (App.js ~line 94)**

Replace:
```js
const wordsToMatch = combined.split(/\s+/).filter(w => w.length > 0);
```
With:
```js
const recentText = getLastWords(combined, MATCH_WINDOW_WORDS);
const wordsToMatch = recentText.split(/\s+/).filter(w => w.length > 0);
```

**Step 3: Apply window to final transcription match (App.js ~line 108)**

Replace:
```js
const wordsToMatch = newFinal.split(/\s+/).filter(w => w.length > 0);
```
With:
```js
const recentText = getLastWords(newFinal, MATCH_WINDOW_WORDS);
const wordsToMatch = recentText.split(/\s+/).filter(w => w.length > 0);
```

**Step 4: Verify**

Run the app (`npm run web`). Open browser console. After speaking ~50+ words, confirm log lines like:
```
[MATCH] performTextMatch called with 45 words: ...
```
Previously this number grew unbounded. Now it should cap at 45.

**Step 5: Commit**

```bash
git add App.js
git commit -m "feat: use sliding window of 45 words for text matching"
```

---

## Task 2: Asymmetric Stickiness — Free Forward Progression in Same Document

**Files:**
- Modify: `App.js` around the `SWITCH_THRESHOLD` constant and the stickiness check block

**Step 1: Replace single threshold with two constants**

Find (App.js ~line 232):
```js
const SWITCH_THRESHOLD = 0.15;
```
Replace with:
```js
const SWITCH_THRESHOLD_NEW_DOC = 0.15;  // require meaningful score gain to jump to different doc
const SWITCH_THRESHOLD_FORWARD = 0.0;   // free to advance forward within same document
```

**Step 2: Apply thresholds by direction**

Find the stickiness check block (App.js ~line 260-268):
```js
if (!isSameSectionMatch && ctx.previousDocId) {
  const scoreDiff = match.score - ctx.previousScore;
  if (scoreDiff < SWITCH_THRESHOLD) {
    console.log('[MATCH] Stickiness: staying in current section (score diff:', scoreDiff.toFixed(2), '< threshold:', SWITCH_THRESHOLD, ')');
    return;
  }
  console.log('[MATCH] Switching to new section (score diff:', scoreDiff.toFixed(2), ')');
}
```
Replace with:
```js
if (!isSameSectionMatch && ctx.previousDocId) {
  const scoreDiff = match.score - ctx.previousScore;
  const isForwardInSameDoc = match.docId === ctx.previousDocId &&
                             match.paragraphNum > ctx.currentParagraphNum;
  const threshold = isForwardInSameDoc ? SWITCH_THRESHOLD_FORWARD : SWITCH_THRESHOLD_NEW_DOC;
  if (scoreDiff < threshold) {
    console.log('[MATCH] Stickiness: staying in current section (score diff:', scoreDiff.toFixed(2), '< threshold:', threshold, ')');
    return;
  }
  console.log('[MATCH] Moving to new section (score diff:', scoreDiff.toFixed(2), ', forward:', isForwardInSameDoc, ')');
}
```

**Step 3: Verify**

In console, when reading past the first matched paragraph you should see:
```
[MATCH] Moving to new section (score diff: ..., forward: true)
```
instead of being stuck.

**Step 4: Commit**

```bash
git add App.js
git commit -m "feat: allow free forward progression within same document"
```

---

## Task 3: isMatching State — Visible Pipeline Feedback

**Files:**
- Modify: `App.js` (add state, set/clear it, pass to widget)
- Modify: `components/MatchedTextWidget.js` (render "Searching..." state)

### Part A — App.js

**Step 1: Add isMatching state**

In App.js, find the matchState declaration (line ~44):
```js
const [matchState, setMatchState] = useState({
```
Add immediately before it:
```js
const [isMatching, setIsMatching] = useState(false);
```

**Step 2: Set isMatching before performTextMatch calls**

At both sites where `performTextMatch(wordsToMatch)` is called (after the sliding window changes from Task 1), wrap like:
```js
if (wordsToMatch.length >= 3) {
  setIsMatching(true);
  performTextMatch(wordsToMatch);
}
```
(The `if (wordsToMatch.length >= 3)` check is already there — just add `setIsMatching(true)` inside it.)

**Step 3: Clear isMatching inside performTextMatch**

At the top of the `debounce(async (words) => {` callback (App.js ~line 236), add as the first line:
```js
setIsMatching(false);
```

**Step 4: Pass isMatching to MatchedTextWidget**

Find the MatchedTextWidget usage (App.js ~line 891):
```jsx
<MatchedTextWidget
  matchedDocument={matchState.matchedDocument}
  fullContent={matchState.matchedContent}
  highlightPosition={matchState.highlightPosition}
  isLoading={matchState.isLoading}
  confidence={matchState.confidence}
/>
```
Add the new prop:
```jsx
<MatchedTextWidget
  matchedDocument={matchState.matchedDocument}
  fullContent={matchState.matchedContent}
  highlightPosition={matchState.highlightPosition}
  isLoading={matchState.isLoading}
  isMatching={isMatching}
  confidence={matchState.confidence}
/>
```

### Part B — MatchedTextWidget.js

**Step 5: Accept isMatching prop**

Find the props destructuring (line ~55):
```js
const MatchedTextWidget = ({
  matchedDocument,
  fullContent,
  highlightPosition,
  isLoading,
  confidence
}) => {
```
Add `isMatching`:
```js
const MatchedTextWidget = ({
  matchedDocument,
  fullContent,
  highlightPosition,
  isLoading,
  isMatching,
  confidence
}) => {
```

**Step 6: Show "Searching..." in the no-match state**

Find the no-match return (line ~103):
```jsx
if (!matchedDocument || !fullContent) {
  return (
    <View style={styles.widgetContainer}>
      <View style={styles.noMatchContainer}>
        <Text style={styles.noMatchText}>
          Speak to find matching text...
        </Text>
        <Text style={styles.noMatchHint}>
          The app will search for matching passages as you speak.
        </Text>
      </View>
    </View>
  );
}
```
Replace with:
```jsx
if (!matchedDocument || !fullContent) {
  return (
    <View style={styles.widgetContainer}>
      <View style={styles.noMatchContainer}>
        <Text style={styles.noMatchText}>
          {isMatching ? 'Searching...' : 'Speak to find matching text...'}
        </Text>
        <Text style={styles.noMatchHint}>
          The app will search for matching passages as you speak.
        </Text>
      </View>
    </View>
  );
}
```

**Step 7: Also show "Searching..." in header when already matched**

In `DocumentHeader`, add a searching indicator next to the confidence bar. Find the confidence bar block (line ~38):
```jsx
{confidence !== undefined && (
  <View style={styles.confidenceContainer}>
    <View style={[styles.confidenceBar, { width: `${Math.min(100, confidence * 100)}%` }]} />
  </View>
)}
```
The `DocumentHeader` component doesn't receive `isMatching`. Pass it through by updating the `DocumentHeader` call in `MatchedTextWidget` (line ~131):
```jsx
<DocumentHeader
  title={matchedDocument.title}
  author={matchedDocument.author}
  url={matchedDocument.url}
  confidence={confidence}
  isMatching={isMatching}
/>
```
And update `DocumentHeader` props and render:
```jsx
const DocumentHeader = ({ title, author, url, confidence, isMatching }) => {
```
```jsx
{confidence !== undefined && (
  <View style={styles.confidenceContainer}>
    <View style={[styles.confidenceBar, { width: `${Math.min(100, confidence * 100)}%` }]} />
  </View>
)}
{isMatching && (
  <Text style={styles.searchingText}>...</Text>
)}
```
Add to StyleSheet:
```js
searchingText: {
  fontSize: 11,
  color: '#999',
  marginHorizontal: 4,
},
```

**Step 8: Commit**

```bash
git add App.js components/MatchedTextWidget.js
git commit -m "feat: show searching indicator during match pipeline"
```

---

## Task 4: Faster Audio Chunks — 500ms Instead of 1s

**Files:**
- Modify: `App.js:567` (AudioWorklet)
- Modify: `App.js:654` (ScriptProcessor fallback)

**Step 1: Halve AudioWorklet chunk size**

Find (App.js ~line 567):
```js
this.samplesPerChunk = this.targetSampleRate; // ~1 second
```
Replace with:
```js
this.samplesPerChunk = this.targetSampleRate / 2; // ~500ms
```

**Step 2: Halve ScriptProcessor chunk size**

Find (App.js ~line 654):
```js
const samplesPerSecond = targetSampleRate;
```
Replace with:
```js
const samplesPerSecond = targetSampleRate / 2;
```

**Step 3: Verify**

In browser console during recording, PCM send logs should appear roughly twice as often:
```
[DEBUG] PCM sent (worklet), samples: 8000 bytes: 16000
```
Previously samples was 16000; now 8000.

**Step 4: Commit**

```bash
git add App.js
git commit -m "perf: halve audio chunk size to 500ms for faster Vosk response"
```
