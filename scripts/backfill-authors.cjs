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
  '/library/authoritative-texts/abdul-baha/': '\u2018Abdu\u2019l-Bah\u00e1',
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

  await fs.mkdir(ASSETS_TEXTS_DIR, { recursive: true });

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
