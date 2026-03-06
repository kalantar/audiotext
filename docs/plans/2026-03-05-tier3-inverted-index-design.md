# Tier 3: Prefix-Based Inverted Index Design

**Date:** 2026-03-05
**Goal:** Eliminate the O(9,424) linear scan in `findBestMatch()` by replacing Pass 1 with a prefix-based inverted index lookup.

---

## Background

After Tier 1 and Tier 2 optimizations, the remaining latency bottleneck is Pass 1 of `findBestMatch()` in `utils/textMatcher.js`. Even with the two-pass approach, Pass 1 still iterates all 9,424 paragraph entries in `search-index.json` to compute a token signature overlap score for each one. This happens on every match call (every 250ms debounce during recording).

### What was considered and rejected

- **Lazy document loading**: The full document JSONs are fetched once and cached. Not a recurring cost.
- **Web Worker**: Moves computation off main thread but doesn't reduce actual work. Web-only — doesn't help iOS/Android.
- **Exact token inverted index**: Would miss transcription errors. With the small Vosk model, garbling is frequent, not exceptional.
- **Inverted index + full restructure (Option C)**: Valid future follow-on, but Option A is sufficient now.

---

## Design

### New index field: `tokenIndex`

Add a `tokenIndex` field to `search-index.json` alongside the existing `documents` array and `metadata`:

```json
{
  "version": "1.0.0",
  "buildDate": "...",
  "documents": [ ... ],
  "metadata": { ... },
  "tokenIndex": {
    "mani": [1, 2, 89, 445],
    "righ": [0, 45, 234, 891],
    ...
  }
}
```

**Keys** are 4-character prefixes of stop-word-filtered tokens (same tokenization as the existing `tokens` field). **Values** are integer indices into the `documents` array — compact and fast to union.

**Why 4-char prefixes (not exact tokens):**
Speech-to-text with the small Vosk model frequently garbles word endings ("manifestion" for "manifestation", "righteous" for "righteousness"). 4-char prefixes tolerate these errors — "mani" matches both — while being more selective than the current 2-char prefix approach, which produces too many false candidates.

**Why not 2-char (current approach):** "ma" matches "manifestation", "marriage", "making", "many" — too permissive, large candidate sets.

**Tunable:** `PREFIX_LENGTH = 4` is a named constant in both the build script and matcher. Adjust down (to 3) if matching degrades, up (to 5) if too many false candidates reach Pass 2.

**Estimated index size impact:** +2-4MB (10MB → 12-14MB). Still loaded once at startup before recording begins.

### Build changes: `scripts/crawl-bahai-library.cjs`

In `generateSearchIndex()`, after the `documents` array is populated, add:

```js
const PREFIX_LENGTH = 4;
const tokenIndex = {};
for (let i = 0; i < index.documents.length; i++) {
  for (const token of index.documents[i].tokens) {
    if (token.length >= PREFIX_LENGTH) {
      const prefix = token.substring(0, PREFIX_LENGTH);
      if (!tokenIndex[prefix]) tokenIndex[prefix] = [];
      tokenIndex[prefix].push(i);
    }
  }
}
index.tokenIndex = tokenIndex;
```

After rebuilding, regenerate both `public/search-index.json` and `assets/search-index.json`.

### Matcher changes: `utils/textMatcher.js`

Add `PREFIX_LENGTH` constant at top of file (must match build script). In `findBestMatch()`, replace the Pass 1 loop:

```js
const PREFIX_LENGTH = 4; // must match build script

// Pass 1: prefix index lookup
const candidateIndices = new Set();
for (const token of searchTokens) {
  if (token.length >= PREFIX_LENGTH) {
    const prefix = token.substring(0, PREFIX_LENGTH);
    const list = searchIndex.tokenIndex?.[prefix];
    if (list) list.forEach(i => candidateIndices.add(i));
  }
}

// Graceful fallback for old index files without tokenIndex
const candidates = candidateIndices.size > 0
  ? [...candidateIndices].map(i => searchIndex.documents[i])
  : searchIndex.documents.filter(doc => hasMinimalOverlap(searchSignature, doc.tokens, 0.10));
```

Pass 2 (fuzzy token + n-gram scoring) is unchanged.

The fallback ensures the app works with old index files — safe to deploy the code change before regenerating the index.

---

## Files Changed

| File | Change |
|------|--------|
| `scripts/crawl-bahai-library.cjs` | Add tokenIndex build step to `generateSearchIndex()` |
| `utils/textMatcher.js` | Replace Pass 1 linear scan with prefix index lookup |
| `public/search-index.json` | Regenerate with tokenIndex field |
| `assets/search-index.json` | Regenerate with tokenIndex field |

---

## Out of Scope

- Web Worker (web-only, doesn't reduce work, adds complexity)
- Lazy document loading (one-time cost, already cached)
- Full index restructure / removing `documents` array (Option C — valid future follow-on)
- N-gram inverted index (n-gram scoring already runs on small candidate set, not a bottleneck)
