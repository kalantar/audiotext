#!/usr/bin/env node
/**
 * Rebuild search index from all text files already on disk.
 * Does NOT crawl bahai.org — reads from public/texts/ only.
 *
 * Use this when:
 * - The search index is out of sync with the text files on disk
 * - You've added/changed text files manually
 * - You want to regenerate after changing index logic (e.g. tokenization)
 *
 * Usage: node scripts/rebuild-search-index.cjs
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_TEXTS_DIR = path.join(__dirname, '..', 'public', 'texts');
const ASSETS_TEXTS_DIR = path.join(__dirname, '..', 'assets', 'texts');
const PUBLIC_INDEX_FILE = path.join(__dirname, '..', 'public', 'search-index.json');
const ASSETS_INDEX_FILE = path.join(__dirname, '..', 'assets', 'search-index.json');

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'that', 'this',
  'these', 'those', 'it', 'its', 'he', 'she', 'they', 'them', 'his', 'her',
  'their', 'my', 'your', 'our', 'i', 'you', 'we', 'who', 'which', 'whom'
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

function generateNgrams(text, sizes = [3, 4, 5]) {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const ngrams = [];
  for (const size of sizes) {
    for (let i = 0; i <= words.length - size; i++) {
      const ngram = words.slice(i, i + size).join(' ');
      if (ngram.length > 5) ngrams.push(ngram);
    }
  }
  return [...new Set(ngrams)].slice(0, 50);
}

const PREFIX_LENGTH = 4; // must match PREFIX_LENGTH in utils/textMatcher.js

function generateSearchIndex(documents) {
  const index = {
    version: '1.0.0',
    buildDate: new Date().toISOString(),
    documents: [],
    metadata: {}
  };

  for (const doc of documents) {
    if (!doc || !doc.sections) continue;

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

  // Build prefix-based inverted index: token prefix → array of document indices.
  // Use a seen Set per document to avoid pushing the same index twice when a
  // document has multiple tokens sharing the same prefix (e.g. "manifest", "manifestation").
  const tokenIndex = {};
  for (let i = 0; i < index.documents.length; i++) {
    const seenPrefixes = new Set();
    for (const token of index.documents[i].tokens) {
      if (token.length >= PREFIX_LENGTH) {
        const prefix = token.substring(0, PREFIX_LENGTH);
        if (!seenPrefixes.has(prefix)) {
          seenPrefixes.add(prefix);
          if (!tokenIndex[prefix]) tokenIndex[prefix] = [];
          tokenIndex[prefix].push(i);
        }
      }
    }
  }
  index.tokenIndex = tokenIndex;

  return index;
}

function main() {
  console.log('Rebuilding search index from disk...');
  console.log('='.repeat(50));

  if (!fs.existsSync(PUBLIC_TEXTS_DIR)) {
    console.error(`Error: ${PUBLIC_TEXTS_DIR} does not exist`);
    process.exit(1);
  }

  const files = fs.readdirSync(PUBLIC_TEXTS_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} text files in ${PUBLIC_TEXTS_DIR}`);

  const documents = [];
  let errors = 0;

  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(PUBLIC_TEXTS_DIR, file), 'utf8'));
      if (content.docId && content.sections) {
        documents.push(content);
      } else {
        console.warn(`  Warning: skipping ${file} (missing docId or sections)`);
      }
    } catch (err) {
      console.error(`  Error reading ${file}: ${err.message}`);
      errors++;
    }
  }

  console.log(`Loaded ${documents.length} valid documents (${errors} errors)`);
  console.log('Generating index...');

  const index = generateSearchIndex(documents);
  const indexJson = JSON.stringify(index, null, 2);

  fs.writeFileSync(PUBLIC_INDEX_FILE, indexJson);
  console.log(`Written: ${PUBLIC_INDEX_FILE}`);

  // Also write to assets/ if it exists
  if (fs.existsSync(path.dirname(ASSETS_INDEX_FILE))) {
    // Sync assets/texts/ from public/texts/ for any files that are in public but not assets
    if (fs.existsSync(ASSETS_TEXTS_DIR)) {
      const assetsFiles = new Set(fs.readdirSync(ASSETS_TEXTS_DIR));
      for (const file of files) {
        if (!assetsFiles.has(file)) {
          fs.copyFileSync(
            path.join(PUBLIC_TEXTS_DIR, file),
            path.join(ASSETS_TEXTS_DIR, file)
          );
          console.log(`  Synced to assets: ${file}`);
        }
      }
    }
    fs.writeFileSync(ASSETS_INDEX_FILE, indexJson);
    console.log(`Written: ${ASSETS_INDEX_FILE}`);
  }

  console.log('\nComplete!');
  console.log(`  Documents: ${documents.length}`);
  console.log(`  Index entries: ${index.documents.length}`);

  // Show breakdown: named books vs date-format messages
  const isMsg = id => /^\d{8}_\d{3}$/.test(id);
  const msgCount = index.documents.filter(d => isMsg(d.docId)).length;
  const bookCount = index.documents.length - msgCount;
  console.log(`  Book paragraphs: ${bookCount}`);
  console.log(`  UHJ message paragraphs: ${msgCount}`);
}

main();
