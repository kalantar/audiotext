# Fix Author Metadata Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 591 documents showing `author: "Unknown"` by correcting the meta tag regex in the crawler, adding a `CATEGORY_AUTHOR_LABELS` fallback, and backfilling existing data.

**Architecture:** Two script changes (crawler + rebuild) share the same `CATEGORY_AUTHOR_LABELS` map. A one-time backfill script reads the existing search index for category info, updates all `public/texts/*.json` and `assets/texts/*.json` author fields, then regenerates both index files.

**Tech Stack:** Node.js CJS scripts (no transpilation). No Jest tests — verification is by running scripts and spot-checking output JSON.

---

### Task 1: Fix `extractMetadata()` in the crawler

**Files:**
- Modify: `scripts/crawl-bahai-library.cjs:171-193`

The xhtml files use `<meta content="J. E. Esslemont" name="author" />` (content-first),
but the regex on line 181 only matches name-first. Fix it to try both orderings.

**Step 1: Verify the current regex fails on the real format**

```bash
node -e "
const html = '<meta content=\"J. E. Esslemont\" name=\"author\" />';
const m = html.match(/<meta[^>]+name=\"author\"[^>]+content=\"([^\"]+)\"/i);
console.log('result:', m ? m[1] : 'NO MATCH — bug confirmed');
"
```

Expected: `result: NO MATCH — bug confirmed`

**Step 2: Replace the broken regex in `extractMetadata()`**

In `scripts/crawl-bahai-library.cjs`, find the `extractMetadata` function (line ~180)
and replace:

```js
  // Extract author from meta tag
  const authorMatch = html.match(/<meta[^>]+name="author"[^>]+content="([^"]+)"/i);
  if (authorMatch) {
    metadata.author = authorMatch[1].trim();
  }
```

With:

```js
  // Extract author from meta tag (handles both attribute orderings)
  const authorMatch = html.match(/<meta[^>]+name="author"[^>]+content="([^"]+)"/i)
                   || html.match(/<meta[^>]+content="([^"]+)"[^>]+name="author"/i);
  if (authorMatch) {
    metadata.author = authorMatch[1].trim();
  }
```

**Step 3: Verify the fix works for both orderings**

```bash
node -e "
const cases = [
  '<meta content=\"J. E. Esslemont\" name=\"author\" />',
  '<meta name=\"author\" content=\"Baha\\'ullah\" />',
];
for (const html of cases) {
  const m = html.match(/<meta[^>]+name=\"author\"[^>]+content=\"([^\"]+)\"/i)
          || html.match(/<meta[^>]+content=\"([^\"]+)\"[^>]+name=\"author\"/i);
  console.log(m ? m[1] : 'NO MATCH');
}
"
```

Expected:
```
J. E. Esslemont
Baha'ullah
```

**Step 4: Commit**

```bash
git add scripts/crawl-bahai-library.cjs
git commit -m "fix: handle content-first meta author tag in crawler extractMetadata"
```

---

### Task 2: Add `CATEGORY_AUTHOR_LABELS` to the crawler

**Files:**
- Modify: `scripts/crawl-bahai-library.cjs` — near top (after line 49), and line ~397

**Step 1: Add the constant after the `CATEGORIES` array (around line 49)**

```js
// Maps category URL path to display author label.
// Used as fallback when the xhtml has no <meta name="author"> tag.
const CATEGORY_AUTHOR_LABELS = {
  '/library/authoritative-texts/bahaullah/': "Bahá'u'lláh",
  '/library/authoritative-texts/the-bab/': 'The Báb',
  '/library/authoritative-texts/abdul-baha/': "\u2018Abdu\u2019l-Bah\u00e1",
  '/library/authoritative-texts/shoghi-effendi/': 'Shoghi Effendi',
  '/library/authoritative-texts/the-universal-house-of-justice/': 'Universal House of Justice',
  '/library/authoritative-texts/compilations/': 'Compilations',
  '/library/authoritative-texts/prayers/': 'Prayers',
  '/library/other-literature/official-statements-commentaries/': 'Official Statements',
  '/library/other-literature/publications-individual-authors/': 'Individual Authors',
};
```

**Step 2: Update author fallback in `fetchAndSaveDocument()` (line ~397)**

Find:
```js
      author: metadata.author || 'Unknown',
```

Replace with:
```js
      author: metadata.author || CATEGORY_AUTHOR_LABELS[doc.category] || 'Unknown',
```

**Step 3: Smoke test — simulate what the crawler would produce for a UHJ doc**

```bash
node -e "
const CATEGORY_AUTHOR_LABELS = {
  '/library/authoritative-texts/the-universal-house-of-justice/': 'Universal House of Justice',
  '/library/authoritative-texts/bahaullah/': \"Bah\u00e1'\u0027u'll\u00e1h\",
};
const cases = [
  { metaAuthor: null, category: '/library/authoritative-texts/the-universal-house-of-justice/' },
  { metaAuthor: 'J. E. Esslemont', category: '/library/other-literature/publications-individual-authors/' },
  { metaAuthor: null, category: '/unknown/category/' },
];
for (const c of cases) {
  console.log(c.metaAuthor || CATEGORY_AUTHOR_LABELS[c.category] || 'Unknown');
}
"
```

Expected:
```
Universal House of Justice
J. E. Esslemont
Unknown
```

**Step 4: Commit**

```bash
git add scripts/crawl-bahai-library.cjs
git commit -m "fix: add CATEGORY_AUTHOR_LABELS fallback in crawler for future crawls"
```

---

### Task 3: Add `CATEGORY_AUTHOR_LABELS` to `rebuild-search-index.cjs`

**Files:**
- Modify: `scripts/rebuild-search-index.cjs` — near top and in `generateSearchIndex()`

The rebuild script reads `author` directly from each text file's JSON. Since the text
files still say `"Unknown"`, rebuilding would preserve "Unknown" in the index. Fix the
rebuild script so it applies the category map when the stored author is "Unknown".

**Step 1: Add the same constant near the top of the file (after line 32)**

```js
// Maps category URL path to display author label.
// Applied during index rebuild when a text file has author: 'Unknown'.
const CATEGORY_AUTHOR_LABELS = {
  '/library/authoritative-texts/bahaullah/': "Bahá'u'lláh",
  '/library/authoritative-texts/the-bab/': 'The Báb',
  '/library/authoritative-texts/abdul-baha/': "\u2018Abdu\u2019l-Bah\u00e1",
  '/library/authoritative-texts/shoghi-effendi/': 'Shoghi Effendi',
  '/library/authoritative-texts/the-universal-house-of-justice/': 'Universal House of Justice',
  '/library/authoritative-texts/compilations/': 'Compilations',
  '/library/authoritative-texts/prayers/': 'Prayers',
  '/library/other-literature/official-statements-commentaries/': 'Official Statements',
  '/library/other-literature/publications-individual-authors/': 'Individual Authors',
};
```

**Step 2: Update `generateSearchIndex()` to apply the map (line ~80)**

Find in `generateSearchIndex()`:
```js
    index.metadata[doc.docId] = {
      title: doc.title || 'Untitled',
      author: doc.author || 'Unknown',
      url: doc.url || '',
      category: doc.category || ''
    };
```

Replace with:
```js
    const resolvedAuthor = (doc.author && doc.author !== 'Unknown')
      ? doc.author
      : (CATEGORY_AUTHOR_LABELS[doc.category] || 'Unknown');

    index.metadata[doc.docId] = {
      title: doc.title || 'Untitled',
      author: resolvedAuthor,
      url: doc.url || '',
      category: doc.category || ''
    };
```

**Step 3: Commit**

```bash
git add scripts/rebuild-search-index.cjs
git commit -m "fix: apply CATEGORY_AUTHOR_LABELS in rebuild-search-index when author is Unknown"
```

---

### Task 4: Write the backfill script

**Files:**
- Create: `scripts/backfill-authors.cjs`

This one-time script fixes all 591 existing text files and regenerates the index.

**Step 1: Create `scripts/backfill-authors.cjs`**

```js
#!/usr/bin/env node
/**
 * Backfill author metadata for existing text files.
 *
 * Reads public/search-index.json for category info, updates author field in
 * all public/texts/*.json files using CATEGORY_AUTHOR_LABELS, mirrors changes
 * to assets/texts/, then regenerates both index files via rebuild-search-index.cjs.
 *
 * Usage: node scripts/backfill-authors.cjs
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const PUBLIC_TEXTS_DIR = path.join(__dirname, '..', 'public', 'texts');
const ASSETS_TEXTS_DIR = path.join(__dirname, '..', 'assets', 'texts');
const PUBLIC_INDEX_FILE = path.join(__dirname, '..', 'public', 'search-index.json');

const CATEGORY_AUTHOR_LABELS = {
  '/library/authoritative-texts/bahaullah/': "Bahá'u'lláh",
  '/library/authoritative-texts/the-bab/': 'The Báb',
  '/library/authoritative-texts/abdul-baha/': "\u2018Abdu\u2019l-Bah\u00e1",
  '/library/authoritative-texts/shoghi-effendi/': 'Shoghi Effendi',
  '/library/authoritative-texts/the-universal-house-of-justice/': 'Universal House of Justice',
  '/library/authoritative-texts/compilations/': 'Compilations',
  '/library/authoritative-texts/prayers/': 'Prayers',
  '/library/other-literature/official-statements-commentaries/': 'Official Statements',
  '/library/other-literature/publications-individual-authors/': 'Individual Authors',
};

async function main() {
  console.log('Backfilling author metadata');
  console.log('='.repeat(50));

  // Load existing index for category info
  const indexJson = await fs.readFile(PUBLIC_INDEX_FILE, 'utf-8');
  const index = JSON.parse(indexJson);
  const categoryByDocId = {};
  for (const [docId, meta] of Object.entries(index.metadata)) {
    categoryByDocId[docId] = meta.category || '';
  }
  console.log(`Loaded categories for ${Object.keys(categoryByDocId).length} documents\n`);

  // Update text files
  const files = (await fs.readdir(PUBLIC_TEXTS_DIR)).filter(f => f.endsWith('.json'));
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(PUBLIC_TEXTS_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const doc = JSON.parse(content);

    const category = categoryByDocId[doc.docId] || doc.category || '';
    const correctAuthor = CATEGORY_AUTHOR_LABELS[category] || doc.author;

    if (correctAuthor && correctAuthor !== doc.author) {
      doc.author = correctAuthor;
      const updatedJson = JSON.stringify(doc, null, 2);
      await fs.writeFile(filePath, updatedJson);

      // Mirror to assets/texts/
      const assetsPath = path.join(ASSETS_TEXTS_DIR, file);
      await fs.writeFile(assetsPath, updatedJson);

      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`Updated: ${updated} files`);
  console.log(`Skipped: ${skipped} files (already correct or no mapping)`);
  console.log('\nRegenerating search index...');

  execSync('node ' + path.join(__dirname, 'rebuild-search-index.cjs'), { stdio: 'inherit' });

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

**Step 2: Run a dry-run spot check before running for real**

```bash
node -e "
const fs = require('fs');
const index = JSON.parse(fs.readFileSync('public/search-index.json'));
// Show category for a known UHJ doc and a Bahaullah doc
const uhj = Object.entries(index.metadata).find(([,m]) => m.category.includes('universal-house'));
const baha = Object.entries(index.metadata).find(([,m]) => m.category.includes('bahaullah'));
console.log('UHJ sample:', uhj[0], uhj[1].category);
console.log('Bahaullah sample:', baha[0], baha[1].category);
"
```

Expected: two docIds printed with their category paths.

**Step 3: Commit the script before running it**

```bash
git add scripts/backfill-authors.cjs
git commit -m "feat: add backfill-authors.cjs to fix author metadata in existing text files"
```

---

### Task 5: Run the backfill and verify

**Step 1: Run the backfill**

```bash
node scripts/backfill-authors.cjs
```

Expected output:
```
Backfilling author metadata
==================================================
Loaded categories for 591 documents

Updated: 591 files
Skipped: 0 files (already correct or no mapping)

Regenerating search index...
[rebuild output...]

Done.
```

**Step 2: Spot-check a UHJ doc**

```bash
node -e "
const doc = JSON.parse(require('fs').readFileSync('public/texts/19630430_001.json'));
console.log('author:', doc.author);
"
```

Expected: `author: Universal House of Justice`

**Step 3: Spot-check a Bahá'u'lláh doc**

```bash
node -e "
const fs = require('fs');
const index = JSON.parse(fs.readFileSync('public/search-index.json'));
const baha = Object.entries(index.metadata).find(([,m]) => m.category.includes('/bahaullah/'));
console.log(baha[0], '->', baha[1].author);
"
```

Expected: a docId followed by `-> Bahá'u'lláh`

**Step 4: Verify index metadata has no remaining "Unknown" authors**

```bash
node -e "
const index = JSON.parse(require('fs').readFileSync('public/search-index.json'));
const unknowns = Object.entries(index.metadata).filter(([,m]) => m.author === 'Unknown');
console.log('Remaining Unknown:', unknowns.length);
if (unknowns.length > 0) unknowns.slice(0,5).forEach(([id,m]) => console.log(' ', id, m.category));
"
```

Expected: `Remaining Unknown: 0`

**Step 5: Commit the regenerated data files**

```bash
git add public/search-index.json assets/search-index.json
# Stage a sample of changed text files to show the diff (all 591 would be noisy)
git add public/texts/ assets/texts/
git commit -m "fix: backfill author metadata in all text files and regenerate search index (#41)"
```
