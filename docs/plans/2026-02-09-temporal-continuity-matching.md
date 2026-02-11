# Temporal Continuity Matching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add temporal continuity to text matching so that sequential paragraph progression is favored when we have confidence the reader is moving forward, while allowing escape when stuck in the wrong location.

**Architecture:** Track the last 3 matched paragraphs in `matchContextRef`. Before each match, detect if the history shows a valid sequence (same document, sequential/same paragraph numbers). If so, predict the next paragraph and pass this to `findBestMatch` which applies a +0.10 neighborhood bonus to candidates within ±3 paragraphs of the prediction. This helps stable reading while allowing distant paragraphs with much better scores to override.

**Tech Stack:** React Native (Expo), JavaScript, existing textMatcher.js matching algorithm.

---

## Background

- The sliding window (45 words) with noisy speech recognition doesn't have enough signal to distinguish between paragraphs in the same document
- Religious texts have similar language throughout, causing the matcher to jump between distant paragraphs (e.g. 35→82→36)
- Current `isValidProgression` only looks at the immediate previous match, not whether there's a consistent sequence
- We need to favor local progression when we have evidence of sequential reading, but not trap the user if the initial lock was wrong

---

## Task 1: Add Match History Tracking to Context

**Files:**
- Modify: `App.js` — `matchContextRef` initialization and update

**Step 1: Read current matchContextRef initialization**

Find the `matchContextRef` initialization in `App.js` (around line 53):
```js
const matchContextRef = useRef({
  previousDocId: null,
  previousParagraphNum: null,
  previousSection: null,
  previousScore: 0,
  firstParagraphNum: null,
  currentParagraphNum: null
});
```

**Step 2: Add matchHistory array**

Add `matchHistory: []` to the initialization:
```js
const matchContextRef = useRef({
  previousDocId: null,
  previousParagraphNum: null,
  previousSection: null,
  previousScore: 0,
  firstParagraphNum: null,
  currentParagraphNum: null,
  matchHistory: []  // Track last 3 matches for temporal continuity
});
```

**Step 3: Find the context update after successful match**

Find where `matchContextRef.current` is updated (around line 342):
```js
matchContextRef.current = {
  previousDocId: match.docId,
  previousParagraphNum: match.paragraphNum,
  previousSection: match.section,
  previousScore: match.score,
  firstParagraphNum: firstParagraphIndex + 1,
  currentParagraphNum: match.paragraphNum
};
```

**Step 4: Update to include history rolling**

Replace with:
```js
// Update match history for temporal continuity (keep last 3)
const newHistoryEntry = {
  docId: match.docId,
  paragraphNum: match.paragraphNum,
  section: match.section
};
const updatedHistory = [...(ctx.matchHistory || []), newHistoryEntry].slice(-3);

matchContextRef.current = {
  previousDocId: match.docId,
  previousParagraphNum: match.paragraphNum,
  previousSection: match.section,
  previousScore: match.score,
  firstParagraphNum: firstParagraphIndex + 1,
  currentParagraphNum: match.paragraphNum,
  matchHistory: updatedHistory
};
```

**Step 5: Also update the reset path**

Find where `matchContextRef.current` is cleared (around line 465-472 in `startRecording`):
```js
matchContextRef.current = {
  previousDocId: null,
  previousParagraphNum: null,
  previousSection: null,
  previousScore: 0,
  firstParagraphNum: null,
  currentParagraphNum: null
};
```

Add `matchHistory: []`:
```js
matchContextRef.current = {
  previousDocId: null,
  previousParagraphNum: null,
  previousSection: null,
  previousScore: 0,
  firstParagraphNum: null,
  currentParagraphNum: null,
  matchHistory: []
};
```

**Step 6: Verify**

Read the modified sections and confirm:
- `matchHistory: []` is in both the `useRef` initialization and the reset path
- The context update after match appends to history and slices to keep last 3 entries

**Step 7: Commit**

```bash
git add App.js
git commit -m "feat: add match history tracking for temporal continuity"
```

---

## Task 2: Detect Sequential Progression and Predict Next Paragraph

**Files:**
- Modify: `App.js` — `performTextMatch` function, before calling `findBestMatch`

**Step 1: Find the findBestMatch call**

In `performTextMatch`, find where `findBestMatch` is called (around line 276):
```js
const match = findBestMatch(words, searchIndexRef.current, matchContextRef.current);
```

**Step 2: Add sequence detection before the call**

Insert before the `findBestMatch` call:
```js
// Temporal continuity: detect if last 2-3 matches show sequential progression
let prediction = null;
const history = matchContextRef.current.matchHistory || [];
if (history.length >= 2) {
  // Check if last 2-3 entries form a valid sequence
  const isSequential = history.every((entry, idx) => {
    if (idx === 0) return true;
    const prev = history[idx - 1];
    // Same document, and paragraph stays same or increments by 1
    return entry.docId === prev.docId &&
           (entry.paragraphNum === prev.paragraphNum ||
            entry.paragraphNum === prev.paragraphNum + 1);
  });

  if (isSequential) {
    const lastMatch = history[history.length - 1];
    prediction = {
      docId: lastMatch.docId,
      paragraphNum: lastMatch.paragraphNum + 1  // Predict next paragraph
    };
    console.log('[MATCH] Temporal continuity detected: predicting',
      prediction.docId, 'paragraph', prediction.paragraphNum);
  }
}
```

**Step 3: Pass prediction to findBestMatch**

Change the call:
```js
const match = findBestMatch(words, searchIndexRef.current, matchContextRef.current, prediction);
```

**Step 4: Verify**

Read the modified section and confirm:
- Sequence detection checks all entries have same `docId` and paragraphs stay same or increment by 1
- Prediction is logged when detected
- `prediction` is passed as 4th parameter to `findBestMatch`

**Step 5: Commit**

```bash
git add App.js
git commit -m "feat: detect sequential progression and predict next paragraph"
```

---

## Task 3: Apply Neighborhood Bonus in findBestMatch

**Files:**
- Modify: `utils/textMatcher.js` — `findBestMatch` function signature and scoring loop

**Step 1: Update findBestMatch signature**

Find the function signature (around line 171):
```js
export function findBestMatch(words, searchIndex, context = {}) {
```

Change to accept prediction:
```js
export function findBestMatch(words, searchIndex, context = {}, prediction = null) {
```

**Step 2: Find the scoring loop**

Find the loop where scores are calculated (around line 183-224):
```js
for (const doc of searchIndex.documents) {
  // Calculate fuzzy token overlap score
  const tokenScore = fuzzyTokenOverlap(searchTokens, doc.tokens);
  // ... rest of scoring ...
  const score = baseScore + continuityBonus;
```

**Step 3: Add neighborhood bonus after continuityBonus**

After the `continuityBonus` calculation and before `const score = ...`, add:
```js
// Temporal continuity bonus: boost nearby paragraphs if we have a prediction
let neighborhoodBonus = 0;
if (prediction && doc.docId === prediction.docId) {
  const distance = Math.abs(doc.paragraphNum - prediction.paragraphNum);
  if (distance <= 3) {
    neighborhoodBonus = 0.10;
    // Stronger bonus for exact predicted paragraph
    if (doc.paragraphNum === prediction.paragraphNum) {
      neighborhoodBonus = 0.15;
    }
  }
}
```

**Step 4: Include neighborhoodBonus in final score**

Change the final score calculation from:
```js
const score = baseScore + continuityBonus;
```
To:
```js
const score = baseScore + continuityBonus + neighborhoodBonus;
```

**Step 5: Update the match object to include neighborhoodBonus**

Find where the match object is created (around line 218):
```js
bestMatch = {
  ...doc,
  score,
  tokenScore,
  ngramScore,
  continuityBonus
};
```

Add `neighborhoodBonus`:
```js
bestMatch = {
  ...doc,
  score,
  tokenScore,
  ngramScore,
  continuityBonus,
  neighborhoodBonus
};
```

**Step 6: Update debug logging**

Find the debug log that shows top candidates (around line 229):
```js
console.log('[MATCH] Top 3 candidates:', debugTopMatches.map(m =>
  `${m.docId.substring(0, 30)}(t=${m.tokenScore.toFixed(2)},n=${m.ngramScore.toFixed(2)},s=${m.score.toFixed(2)})`
).join(', '));
```

This doesn't need to change (it's fine to show final score), but if you want to show the neighborhood bonus:
```js
console.log('[MATCH] Top 3 candidates:', debugTopMatches.map(m =>
  `${m.docId.substring(0, 30)}(t=${m.tokenScore.toFixed(2)},n=${m.ngramScore.toFixed(2)},s=${m.score.toFixed(2)}${m.neighborhoodBonus ? ',nb=' + m.neighborhoodBonus.toFixed(2) : ''})`
).join(', '));
```

**Step 7: Verify**

Read the modified function and confirm:
- `prediction` parameter is accepted (default `null`)
- `neighborhoodBonus` is calculated when prediction exists and docId matches
- Bonus is 0.15 for exact predicted paragraph, 0.10 for ±1-3 paragraphs away
- Final score includes `+ neighborhoodBonus`

**Step 8: Commit**

```bash
git add utils/textMatcher.js
git commit -m "feat: apply neighborhood bonus for temporal continuity prediction"
```

---

## Task 4: Verification and Tuning

**Files:**
- None (manual testing)

**Step 1: Test with Gems of Divine Mysteries**

Run the app (`npm run web`), start recording, read paragraphs 32-34 of Gems of Divine Mysteries. Open browser console.

Expected behavior:
- First paragraph (32) locks on with no prediction (history empty)
- Second paragraph (33) adds to history, still no prediction (need 2+ entries)
- Third paragraph (34) triggers prediction for paragraph 35
- Console shows: `[MATCH] Temporal continuity detected: predicting gems-divine-mysteries paragraph 35`
- Candidate logs should show `nb=0.15` for exact paragraph 35, `nb=0.10` for paragraphs 32-37

**Step 2: Test escape from wrong lock**

Read a passage from a different document (e.g. Summons of the Lord of Hosts). Verify that if Gems was wrongly locked, the lack of sequential progression prevents prediction, and the correct document can win cleanly.

**Step 3: Observe console logs**

Look for:
- `[MATCH] Temporal continuity detected` lines showing when prediction activates
- Top candidates showing neighborhood bonus (`nb=`) when active
- Non-sequential jumps should still happen if a distant paragraph scores 0.2+ higher than predicted

**Step 4: Tune if needed**

If the bonus is too strong (can't escape wrong lock): reduce from 0.10/0.15 to 0.05/0.08.
If it's too weak (still jumping): increase to 0.12/0.18 or widen the distance range from ±3 to ±5.

Document any tuning changes:
```bash
git add utils/textMatcher.js
git commit -m "tune: adjust neighborhood bonus strength to [value]"
```
