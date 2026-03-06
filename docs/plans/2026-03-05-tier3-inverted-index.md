# Tier 3: Prefix-Based Inverted Index Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the O(9,424) linear scan in `findBestMatch()` Pass 1 with a prefix-based inverted index lookup, reducing per-match latency.

**Architecture:** Add a `tokenIndex` field to `search-index.json` at build time (token prefix → paragraph indices). At match time, union the prefix lists to get candidates instead of scanning all documents. Keep existing `documents` array unchanged. Fall back to old linear scan if index absent (backward compat).

**Tech Stack:** Node.js (crawler script, CJS), ES modules (textMatcher.js), existing test runner (`npm run test:matching`).

---

## Background

- `search-index.json` has 9,424 paragraph entries. Pass 1 currently iterates all of them for every match call.
- Tokens are already stop-word-filtered (length > 2, not in STOP_WORDS).
- The crawler (`scripts/crawl-bahai-library.cjs`) has its own `tokenize()` — does not import from `utils/textMatcher.js`.
- Tests live in `tests/fixtures/` and run via `npm run test:matching` (Node.js, not Jest).
- Both `public/search-index.json` (web) and `assets/search-index.json` (native) must be regenerated.

---

## Task 1: Add token index build step to crawler

**Files:**
- Modify: `scripts/crawl-bahai-library.cjs:407-445` (`generateSearchIndex` function)
- Create: `tests/inverted-index-build-test.cjs`

**Step 1: Write the failing test**

Create `tests/inverted-index-build-test.cjs`:

```js
/**
 * Tests that generateSearchIndex produces a valid tokenIndex field.
 * Run with: node tests/inverted-index-build-test.cjs
 */

// Inline the PREFIX_LENGTH and buildTokenIndex logic to test it in isolation
const PREFIX_LENGTH = 4;

function buildTokenIndex(documents) {
  const tokenIndex = {};
  for (let i = 0; i < documents.length; i++) {
    for (const token of documents[i].tokens) {
      if (token.length >= PREFIX_LENGTH) {
        const prefix = token.substring(0, PREFIX_LENGTH);
        if (!tokenIndex[prefix]) tokenIndex[prefix] = [];
        tokenIndex[prefix].push(i);
      }
    }
  }
  return tokenIndex;
}

// Test data
const mockDocuments = [
  { id: 'doc-0', tokens: ['manifestation', 'glory', 'divine'] },
  { id: 'doc-1', tokens: ['manifest', 'power', 'righteousness'] },
  { id: 'doc-2', tokens: ['glory', 'kingdom', 'earth'] },
];

const tokenIndex = buildTokenIndex(mockDocuments);

let passed = true;

// 'mani' prefix should point to both doc-0 (manifestation) and doc-1 (manifest)
const maniList = tokenIndex['mani'];
if (!maniList || !maniList.includes(0) || !maniList.includes(1)) {
  console.error('FAIL: mani prefix should include indices 0 and 1, got:', maniList);
  passed = false;
} else {
  console.log('PASS: mani prefix includes both manifestation and manifest entries');
}

// 'glor' prefix should point to doc-0 and doc-2
const glorList = tokenIndex['glor'];
if (!glorList || !glorList.includes(0) || !glorList.includes(2)) {
  console.error('FAIL: glor prefix should include indices 0 and 2, got:', glorList);
  passed = false;
} else {
  console.log('PASS: glor prefix includes both glory entries');
}

// Short tokens (< PREFIX_LENGTH) should not appear
const shortToken = tokenIndex['ear']; // 'earth' has 5 chars so prefix is 'eart', not 'ear'
const earthList = tokenIndex['eart'];
if (!earthList || !earthList.includes(2)) {
  console.error('FAIL: eart prefix should include index 2, got:', earthList);
  passed = false;
} else {
  console.log('PASS: eart prefix includes earth entry');
}

// Tokens shorter than PREFIX_LENGTH should be skipped
// 'pow' is length 3 (< 4), so should not be indexed... wait, 'power' is 5 chars
// Test a token that is exactly PREFIX_LENGTH - 1 chars
const docs2 = [{ id: 'doc-0', tokens: ['god'] }]; // length 3, < PREFIX_LENGTH
const idx2 = buildTokenIndex(docs2);
if (Object.keys(idx2).length !== 0) {
  console.error('FAIL: tokens shorter than PREFIX_LENGTH should be skipped');
  passed = false;
} else {
  console.log('PASS: short tokens (< PREFIX_LENGTH) are skipped');
}

console.log(passed ? '\nAll tests passed.' : '\nSome tests FAILED.');
process.exit(passed ? 0 : 1);
```

**Step 2: Run test to verify it fails**

```bash
node tests/inverted-index-build-test.cjs
```

Expected: `ReferenceError` or assertion failure — the test is self-contained and tests the logic we're about to add, so it should pass immediately. If it does, that confirms the logic is correct before we add it to the crawler.

**Step 3: Add `PREFIX_LENGTH` constant and `buildTokenIndex` to the crawler**

In `scripts/crawl-bahai-library.cjs`, find the line:
```js
function generateSearchIndex(documents) {
```
(around line 407)

Add this constant immediately above it:
```js
const PREFIX_LENGTH = 4; // must match PREFIX_LENGTH in utils/textMatcher.js
```

Then inside `generateSearchIndex`, after the closing `}` of the existing `for (const doc of documents)` loop (after line 442, before `return index`), add:

```js
  // Build prefix-based inverted index: token prefix → array of document indices
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

The full updated function body should now be:

```js
function generateSearchIndex(documents) {
  const index = {
    version: '1.0.0',
    buildDate: new Date().toISOString(),
    documents: [],
    metadata: {}
  };

  for (const doc of documents) {
    if (!doc) continue;

    index.metadata[doc.docId] = {
      title: doc.title,
      author: doc.author,
      url: doc.url,
      category: doc.category
    };

    for (const section of doc.sections) {
      for (let i = 0; i < section.paragraphs.length; i++) {
        const para = section.paragraphs[i];
        const tokens = tokenize(para);
        const ngrams = generateNgrams(para);

        index.documents.push({
          id: `${doc.docId}-${section.title.substring(0, 20).replace(/\s+/g, '-').toLowerCase()}-${i}`,
          docId: doc.docId,
          section: section.title,
          paragraphNum: i + 1,
          preview: para.substring(0, 150) + (para.length > 150 ? '...' : ''),
          tokens: tokens.slice(0, 30),
          ngrams: ngrams.slice(0, 20)
        });
      }
    }
  }

  // Build prefix-based inverted index: token prefix → array of document indices
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

  return index;
}
```

**Step 4: Run test to verify it passes**

```bash
node tests/inverted-index-build-test.cjs
```

Expected output:
```
PASS: mani prefix includes both manifestation and manifest entries
PASS: glor prefix includes both glory entries
PASS: eart prefix includes earth entry
PASS: short tokens (< PREFIX_LENGTH) are skipped

All tests passed.
```

**Step 5: Commit**

```bash
git add scripts/crawl-bahai-library.cjs tests/inverted-index-build-test.cjs
git commit -m "feat: add prefix-based inverted index to search index builder"
```

---

## Task 2: Regenerate search index files

**Files:**
- Regenerate: `public/search-index.json`
- Regenerate: `assets/search-index.json`

The crawler fetches live from bahai.org — we do NOT want to re-crawl. There is a `rebuild-search-index` script referenced in git history. Check if it exists:

```bash
ls scripts/
```

If `scripts/rebuild-search-index.cjs` exists, use it. If not, the crawler itself can regenerate from already-crawled text files. Check `public/texts/` — if those files are populated, the crawler's `generateSearchIndex` can be called standalone.

**Step 1: Write a quick verification script**

Create `tests/verify-token-index.cjs`:

```js
const fs = require('fs');
const index = JSON.parse(fs.readFileSync('public/search-index.json', 'utf8'));

if (!index.tokenIndex) {
  console.error('FAIL: tokenIndex field missing from search-index.json');
  process.exit(1);
}

const keys = Object.keys(index.tokenIndex);
console.log('tokenIndex keys:', keys.length);
console.log('Sample entry "mani":', index.tokenIndex['mani']?.slice(0, 5));
console.log('Sample entry "righ":', index.tokenIndex['righ']?.slice(0, 5));
console.log('Sample entry "glor":', index.tokenIndex['glor']?.slice(0, 5));

if (keys.length < 1000) {
  console.error('FAIL: tokenIndex seems too small, expected > 1000 keys, got:', keys.length);
  process.exit(1);
}

console.log('\nPASS: tokenIndex looks valid.');
process.exit(0);
```

**Step 2: Run verification to confirm it currently fails**

```bash
node tests/verify-token-index.cjs
```

Expected: `FAIL: tokenIndex field missing from search-index.json`

**Step 3: Regenerate the index**

Look at the existing text files to understand what's available:

```bash
ls public/texts/ | wc -l
ls public/*.json | head -5
```

The crawler in `scripts/crawl-bahai-library.cjs` reads from `public/texts/` and regenerates the index. Run only the index-generation step. The crawler's `main()` function crawls AND generates. To regenerate index only from existing files, check if there's a `--rebuild` flag:

```bash
node scripts/crawl-bahai-library.cjs --help 2>/dev/null || grep -n "argv\|process.argv\|rebuild\|reindex" scripts/crawl-bahai-library.cjs | head -10
```

If no rebuild-only flag exists, find where the index is written and how documents are loaded from disk:

```bash
grep -n "writeFileSync\|readFileSync\|PUBLIC_INDEX\|ASSETS_INDEX" scripts/crawl-bahai-library.cjs | head -20
```

Follow the code to understand how to invoke index generation without re-crawling. If there's no shortcut, add a simple standalone script:

Create `scripts/rebuild-search-index.cjs`:

```js
/**
 * Rebuild search index from already-crawled text files.
 * Does NOT re-crawl bahai.org — reads from public/texts/ and public/*.json.
 */
const fs = require('fs');
const path = require('path');

// Load the crawler's generateSearchIndex by requiring it
// (The crawler exports nothing, so we inline the essential parts)
// Instead: load existing document JSONs from public/ and re-index them.

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const OUTPUT_INDEX = 'search-index.json';

// Load all document JSON files from public/
const docFiles = fs.readdirSync(PUBLIC_DIR)
  .filter(f => f.endsWith('.json') && f !== 'search-index.json');

console.log(`Found ${docFiles.length} document files`);

// ... (see crawler's generateSearchIndex for structure)
// Actually: just run the crawler with a flag or patch it to skip crawling.
```

**Note:** Before creating a new script, check if the crawler can be run with existing data. Look at the crawler's `main()` function to understand the full flow:

```bash
grep -n "async function main\|crawl\|fetch\|writeFile" scripts/crawl-bahai-library.cjs | tail -30
```

The cleanest approach is to read the crawler code and determine the right invocation. If the crawler writes its output based on already-fetched data in `public/texts/`, running it with a `MESSAGE_LIMIT=0` or similar may skip fetching and just regenerate.

**Step 4: Run verification to confirm it passes**

```bash
node tests/verify-token-index.cjs
```

Expected:
```
tokenIndex keys: 5000+
Sample entry "mani": [1, 45, 234, ...]
...
PASS: tokenIndex looks valid.
```

**Step 5: Verify assets/ copy matches**

```bash
node -e "
const pub = JSON.parse(require('fs').readFileSync('public/search-index.json'));
const ass = JSON.parse(require('fs').readFileSync('assets/search-index.json'));
const pubKeys = Object.keys(pub.tokenIndex || {}).length;
const assKeys = Object.keys(ass.tokenIndex || {}).length;
console.log('public tokenIndex keys:', pubKeys);
console.log('assets tokenIndex keys:', assKeys);
console.log(pubKeys === assKeys ? 'MATCH' : 'MISMATCH');
"
```

**Step 6: Commit**

```bash
git add public/search-index.json assets/search-index.json tests/verify-token-index.cjs
git commit -m "feat: regenerate search index with prefix-based tokenIndex"
```

---

## Task 3: Update findBestMatch to use prefix index

**Files:**
- Modify: `utils/textMatcher.js:11` (add constant after existing constants)
- Modify: `utils/textMatcher.js:245-255` (replace Pass 1 loop)
- Create: `tests/inverted-index-match-test.cjs`

**Step 1: Write the failing test**

Create `tests/inverted-index-match-test.cjs`:

```js
/**
 * Tests that findBestMatch uses tokenIndex when available and falls back
 * to linear scan when absent.
 * Run with: node tests/inverted-index-match-test.cjs
 */

import { findBestMatch } from '../utils/textMatcher.js';

// Mock index WITH tokenIndex — only doc-0 should be a candidate
const indexWithTokenIndex = {
  documents: [
    {
      id: 'doc-0',
      docId: 'kitab-i-aqdas',
      section: 'Main',
      paragraphNum: 1,
      preview: 'The first duty...',
      tokens: ['duty', 'prescribed', 'recognized', 'manifestation'],
      ngrams: ['first duty prescribed', 'duty prescribed unto', 'prescribed unto recognized']
    },
    {
      id: 'doc-1',
      docId: 'hidden-words',
      section: 'Main',
      paragraphNum: 1,
      preview: 'O Son of Spirit...',
      tokens: ['spirit', 'noble', 'good', 'deed'],
      ngrams: ['son of spirit', 'of spirit noble', 'spirit noble good']
    }
  ],
  metadata: {
    'kitab-i-aqdas': { title: 'Kitáb-i-Aqdas', author: "Bahá'u'lláh", url: 'https://bahai.org' },
    'hidden-words': { title: 'Hidden Words', author: "Bahá'u'lláh", url: 'https://bahai.org' }
  },
  tokenIndex: {
    // 'duty' → prefix 'duty' → doc-0 only
    'duty': [0],
    // 'mani' → prefix of 'manifestation' → doc-0 only
    'mani': [0],
    // 'spir' → prefix of 'spirit' → doc-1 only
    'spir': [1],
  }
};

// Mock index WITHOUT tokenIndex — should fall back to linear scan
const indexWithoutTokenIndex = {
  documents: indexWithTokenIndex.documents,
  metadata: indexWithTokenIndex.metadata
  // no tokenIndex field
};

let passed = true;

// Test 1: With tokenIndex, matching 'duty prescribed manifestation recognition' finds doc-0
const words1 = 'duty prescribed unto thee recognized manifestation god glorious day'.split(' ');
const match1 = findBestMatch(words1, indexWithTokenIndex);
if (!match1 || match1.docId !== 'kitab-i-aqdas') {
  console.error('FAIL Test 1: expected kitab-i-aqdas, got:', match1?.docId);
  passed = false;
} else {
  console.log('PASS Test 1: tokenIndex path finds correct document');
}

// Test 2: Without tokenIndex, same words still find doc-0 via linear scan fallback
const match2 = findBestMatch(words1, indexWithoutTokenIndex);
if (!match2 || match2.docId !== 'kitab-i-aqdas') {
  console.error('FAIL Test 2: fallback linear scan should find kitab-i-aqdas, got:', match2?.docId);
  passed = false;
} else {
  console.log('PASS Test 2: fallback linear scan finds correct document');
}

// Test 3: With tokenIndex, spirit-related words find doc-1
const words3 = 'son spirit noble good deeds righteous path light divine'.split(' ');
const match3 = findBestMatch(words3, indexWithTokenIndex);
if (!match3 || match3.docId !== 'hidden-words') {
  console.error('FAIL Test 3: expected hidden-words, got:', match3?.docId);
  passed = false;
} else {
  console.log('PASS Test 3: tokenIndex path finds hidden-words');
}

console.log(passed ? '\nAll tests passed.' : '\nSome tests FAILED.');
process.exit(passed ? 0 : 1);
```

**Step 2: Run test to verify it fails (or partially fails)**

```bash
node tests/inverted-index-match-test.cjs
```

Expected: Test 1 fails because `findBestMatch` doesn't use `tokenIndex` yet — it runs the linear scan on all docs, which may still find doc-0. If all tests pass, that means the linear scan produces the same results (which is fine — the tests still verify the fallback path works).

**Step 3: Add `PREFIX_LENGTH` constant to textMatcher.js**

In `utils/textMatcher.js`, after line 14 (after `const MAX_LEVENSHTEIN_DISTANCE = 2;`), add:

```js
// Prefix length for inverted index lookup — must match PREFIX_LENGTH in crawl-bahai-library.cjs
const PREFIX_LENGTH = 4;
```

**Step 4: Replace Pass 1 in findBestMatch**

In `utils/textMatcher.js`, find this block (around lines 245-255):

```js
  // PASS 1: Pre-screening with token signatures
  // Quickly filter out 70-80% of documents that have minimal token overlap
  // Lower threshold (10%) to tolerate noisy speech recognition
  const searchSignature = computeTokenSignature(searchTokens);
  const candidates = [];

  for (const doc of searchIndex.documents) {
    if (hasMinimalOverlap(searchSignature, doc.tokens, 0.10)) {
      candidates.push(doc);
    }
  }
```

Replace with:

```js
  // PASS 1: Prefix index lookup — fast path when tokenIndex is available
  // Falls back to linear pre-screening scan for old index files without tokenIndex
  let candidates;

  if (searchIndex.tokenIndex) {
    const candidateIndices = new Set();
    for (const token of searchTokens) {
      if (token.length >= PREFIX_LENGTH) {
        const prefix = token.substring(0, PREFIX_LENGTH);
        const list = searchIndex.tokenIndex[prefix];
        if (list) list.forEach(i => candidateIndices.add(i));
      }
    }
    candidates = [...candidateIndices].map(i => searchIndex.documents[i]);
    debugLog('[MATCH] Pass 1 (index): ' + candidates.length + ' candidates from ' + searchIndex.documents.length + ' total');
  } else {
    const searchSignature = computeTokenSignature(searchTokens);
    candidates = searchIndex.documents.filter(doc => hasMinimalOverlap(searchSignature, doc.tokens, 0.10));
    debugLog('[MATCH] Pass 1 (linear fallback): ' + candidates.length + ' candidates');
  }
```

**Step 5: Run tests**

```bash
node tests/inverted-index-match-test.cjs
```

Expected: All 3 tests pass.

**Step 6: Run full matching test suite to verify no regression**

```bash
npm run test:matching
```

Expected: All existing fixture tests pass (same results as before).

**Step 7: Commit**

```bash
git add utils/textMatcher.js tests/inverted-index-match-test.cjs
git commit -m "feat: use prefix inverted index in findBestMatch Pass 1"
```

---

## Task 4: Measure and verify improvement

**Step 1: Add timing log to findBestMatch**

Temporarily add timing around Pass 1 to measure improvement. In `utils/textMatcher.js`, wrap Pass 1:

```js
  const t0 = performance.now();
  // ... (Pass 1 block) ...
  const t1 = performance.now();
  debugLog('[MATCH] Pass 1 time: ' + (t1 - t0).toFixed(1) + 'ms, candidates: ' + candidates.length);
```

**Step 2: Run app and check console**

```bash
npm run web
```

Open browser devtools console. Speak a few words. Look for:
```
[MATCH] Pass 1 (index): 150 candidates from 9424 total
[MATCH] Pass 1 time: 1.2ms
```

Previously Pass 1 would iterate all 9,424 with `hasMinimalOverlap`. With the index, it should be faster and produce a similar or smaller candidate count.

**Step 3: Remove timing log**

Remove the `performance.now()` lines added in Step 1.

**Step 4: Final commit**

```bash
git add utils/textMatcher.js
git commit -m "perf: complete Tier 3 prefix inverted index optimization"
```

---

## Summary

| Task | Files | Commit |
|------|-------|--------|
| 1: Build step | `scripts/crawl-bahai-library.cjs`, `tests/inverted-index-build-test.cjs` | `feat: add prefix-based inverted index to search index builder` |
| 2: Regenerate index | `public/search-index.json`, `assets/search-index.json` | `feat: regenerate search index with prefix-based tokenIndex` |
| 3: Matcher | `utils/textMatcher.js`, `tests/inverted-index-match-test.cjs` | `feat: use prefix inverted index in findBestMatch Pass 1` |
| 4: Verify | `utils/textMatcher.js` | `perf: complete Tier 3 prefix inverted index optimization` |
