# Bahá'í Library Crawler Guide

Comprehensive guide for crawling and indexing texts from bahai.org/library.

## Overview

The crawler (`scripts/crawl-bahai-library.cjs`) automatically discovers and downloads texts from the Bahá'í Reference Library at bahai.org, generating search indexes and full text content for the FollowAlong app.

## What It Does

1. **Discovers documents** from category pages on bahai.org/library
2. **Downloads .xhtml versions** (complete HTML in one file)
3. **Extracts content** - metadata, sections, paragraphs, verses
4. **Generates n-grams** (3, 4, 5-word sequences) for fuzzy matching
5. **Creates search index** with tokenized text (excludes stop words)
6. **Writes to dual locations**:
   - `assets/` - For native iOS/Android (bundled into app)
   - `public/` - For web (served as static files)

## Output Files

### Search Index
- **Location**: `assets/search-index.json` + `public/search-index.json`
- **Size**: ~11MB (8,833 documents as of 2026-01-14)
- **Structure**:
  ```json
  {
    "version": "1.0.0",
    "buildDate": "2026-02-16T...",
    "documents": [
      {
        "id": "kitab-i-aqdas-paragraph-1-...",
        "docId": "kitab-i-aqdas",
        "section": "Kitáb-i-Aqdas",
        "paragraphNum": 1,
        "preview": "First 150 characters...",
        "tokens": ["significant", "words", "..."],
        "ngrams": ["three word phrase", "four word phrase now", ...]
      }
    ],
    "metadata": {
      "kitab-i-aqdas": {
        "title": "The Kitáb-i-Aqdas",
        "author": "Bahá'u'lláh",
        "url": "https://www.bahai.org/library/...",
        "category": "/library/authoritative-texts/bahaullah/"
      }
    }
  }
  ```

### Individual Text Files
- **Location**: `assets/texts/{doc-id}.json` + `public/texts/{doc-id}.json`
- **One file per document** (e.g., `kitab-i-aqdas.json`, `hidden-words.json`)
- **Structure**:
  ```json
  {
    "docId": "kitab-i-aqdas",
    "title": "The Kitáb-i-Aqdas",
    "author": "Bahá'u'lláh",
    "url": "https://www.bahai.org/library/...",
    "xhtmlUrl": "https://www.bahai.org/library/.../kitab-i-aqdas.xhtml",
    "category": "/library/authoritative-texts/bahaullah/",
    "fetchDate": "2026-02-16T...",
    "sections": [
      {
        "title": "Kitáb-i-Aqdas",
        "paragraphs": [
          "The first Most Holy Book is this...",
          "We have enjoined obligatory prayer...",
          "..."
        ]
      }
    ]
  }
  ```

## Usage

### Basic Usage

```bash
node scripts/crawl-bahai-library.cjs
```

This will crawl all enabled categories (see Configuration below).

### Configuration

Edit `scripts/crawl-bahai-library.cjs` lines 28-37:

```javascript
const CATEGORIES = [
  '/library/authoritative-texts/bahaullah/',        // Bahá'u'lláh's Writings
  '/library/authoritative-texts/the-bab/',          // The Báb's Writings
  '/library/authoritative-texts/abdul-baha/',       // 'Abdu'l-Bahá's Writings
  '/library/authoritative-texts/shoghi-effendi/',   // Shoghi Effendi's Writings
  '/library/authoritative-texts/the-universal-house-of-justice/',  // UHJ
  '/library/authoritative-texts/compilations/',     // Compilations
  '/library/authoritative-texts/prayers/',          // Prayers
  '/library/other-literature/official-statements-commentaries/',   // Statements
  '/library/other-literature/publications-individual-authors/',    // Other
];
```

**Tip**: Comment out categories you've already crawled to avoid re-downloading.

### Rate Limiting

**Default**: 500ms delay between requests

To change, edit line 28:
```javascript
const REQUEST_DELAY = 500;  // milliseconds
```

**Recommendation**: Keep at 500ms or higher to be respectful to bahai.org servers.

## What Gets Crawled

### Currently Enabled (All Categories)

| Category | Description | Example Texts |
|----------|-------------|---------------|
| Bahá'u'lláh | Central prophet's writings | Kitáb-i-Aqdas, Kitáb-i-Íqán, Hidden Words, Gleanings |
| The Báb | Forerunner's writings | Selections from the Writings of the Báb |
| 'Abdu'l-Bahá | Son and interpreter | Some Answered Questions, Paris Talks |
| Shoghi Effendi | Guardian's writings | God Passes By, World Order of Bahá'u'lláh |
| Universal House of Justice | Governing body | Messages, letters |
| Compilations | Thematic collections | Peace, Women, Justice |
| Prayers | Prayer collections | Bahá'í Prayers |
| Official Statements | Public statements | Various statements |
| Publications | Individual authors | Study materials |

### What's Extracted

For each document:
- **Title** from `<title>` tag
- **Author** from `<meta name="author">` tag
- **Sections** from `<h1>`, `<h2>`, `<h3>` headers
- **Paragraphs** from `<p>` tags (minimum 10 characters)
- **Clean text** - HTML stripped, entities decoded

### What's Excluded

- Script and style tags
- Navigation elements
- Headers and footers
- Paragraphs < 10 characters
- Stop words (a, the, and, etc.) from search tokens

## After Crawling

### Update textAssets.js (Native Only)

When new texts are added, update `assets/textAssets.js` to include them:

```javascript
const textAssets = {
  'new-document-id': require('./texts/new-document-id.json'),
  // ... existing entries
};
```

**Why**: React Native doesn't support dynamic requires on native platforms.

**When**: Only needed when adding NEW documents that weren't there before.

**Script to generate** (future enhancement):
```bash
# Generate textAssets.js from assets/texts/ directory
node scripts/generate-text-assets.js
```

### Verify Output

```bash
# Check file counts
ls assets/texts/ | wc -l
ls public/texts/ | wc -l

# Check index size
du -h assets/search-index.json
du -h public/search-index.json

# View index summary
node -e "const idx = require('./assets/search-index.json'); console.log('Documents:', idx.documents.length, 'Metadata:', Object.keys(idx.metadata).length)"
```

### Test in App

```bash
# Start app
npm start

# Check console logs for:
# [MATCH] Search index loaded: XXXX entries
```

## Troubleshooting

### Error: MODULE_NOT_FOUND

**Problem**: Script uses CommonJS but package.json has `"type": "module"`

**Solution**: Script is named `.cjs` - use `node scripts/crawl-bahai-library.cjs`

### Error: HTTP 404 for document

**Problem**: Document URL structure changed or document removed

**Solution**: Script will log error and continue with other documents

### Error: ENOSPC (No space left)

**Problem**: Disk full - texts can be large

**Solution**: Free up space. Total size for all categories: ~50-100MB

### Rate Limiting / Blocking

**Problem**: Too many requests to bahai.org

**Solution**:
1. Increase `REQUEST_DELAY` to 1000ms or higher
2. Wait before retrying
3. Crawl categories one at a time

### Duplicate Documents

**Problem**: Same document appears in multiple categories

**Solution**: Script automatically deduplicates by document ID

### New Texts Not Showing in Native App

**Problem**: `textAssets.js` not updated

**Solution**: Add new document requires to `assets/textAssets.js`

## Performance

### Crawling Time

- **Bahá'u'lláh only** (16 docs): ~10 seconds
- **All categories** (~100+ docs): ~1-2 minutes
- **Rate limited** at 500ms per request

### Output Size

- **Search index**: ~11MB (compressed: ~1MB gzipped)
- **Individual texts**: 10KB - 1MB each
- **Total for all texts**: ~50-100MB

### App Performance Impact

- **Web**: No impact (static files loaded on-demand)
- **Native**: Bundle size increases (all texts bundled into app)
  - Consider: Only bundle frequently used texts
  - Load others dynamically from server (future enhancement)

## Maintenance

### When to Re-Crawl

- New texts published on bahai.org
- Text corrections/updates
- Category structure changes
- Adding new languages (requires script modification)

### Incremental Updates

**Current**: Re-downloads everything

**Future Enhancement**: Check `fetchDate` and only update if changed

**Workaround**: Comment out unchanged categories in `CATEGORIES` array

### Backup

Before re-crawling:
```bash
# Backup current texts
tar -czf backup-texts-$(date +%Y%m%d).tar.gz assets/texts/ public/texts/ assets/search-index.json public/search-index.json
```

## Architecture Notes

### Why Dual Output (assets/ + public/)?

**Web (public/):**
- Expo serves `public/` at root `/` for web builds
- Static files loaded via `fetch('/search-index.json')`
- **Optimal performance**: On-demand loading, not bundled

**Native (assets/):**
- React Native can't access filesystem at runtime
- Files must be bundled via `require()` at build time
- `textAssets.js` provides static mapping for dynamic access

### Why Not Use assets/ for Web?

**Performance**: Would require configuring bundler to serve assets/ as static files, which isn't guaranteed. Using `public/` is explicit and reliable.

### Why Separate Text Files?

- **On-demand loading**: Only load texts as user reads them
- **Smaller initial bundle**: Don't load all 100+ documents upfront
- **Easier updates**: Update individual texts without regenerating index

### Search Index Design

**Tokens**: Individual words (stop words removed) for fuzzy matching
**N-grams**: 3-5 word phrases for exact phrase matching
**Trade-off**: Larger index (~11MB) for better matching accuracy

## Future Enhancements

### Potential Improvements

1. **Progress bar** during crawling
2. **Incremental updates** (only changed documents)
3. **Auto-generate textAssets.js** from crawled texts
4. **Multi-language support** (Arabic, Persian, etc.)
5. **Document versioning** (track when text last updated)
6. **Selective bundling** for native (only common texts)
7. **CDN hosting** for texts (reduce app bundle size)
8. **Parallel downloading** (faster crawling)
9. **Cache etag/last-modified** headers

### Configuration File

**Current**: Edit script directly

**Proposed**: `crawler-config.json`
```json
{
  "categories": ["..."],
  "rateLimit": 500,
  "outputDir": "assets",
  "skipExisting": true
}
```

## Contributing

When modifying the crawler:

1. Test with one category first
2. Verify dual output (assets/ + public/)
3. Check file sizes (no corrupted JSON)
4. Test in app (web + native)
5. Update this documentation
6. Commit changes

## References

- bahai.org/library - Source of all texts
- Expo documentation - Static assets handling
- CLAUDE.md - Project overview and architecture
