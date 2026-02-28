#!/usr/bin/env node
/**
 * Rebuild search index from existing text files
 *
 * Reads all JSON files from public/texts/ and regenerates search-index.json
 * without re-downloading anything from the network.
 *
 * Usage: node scripts/rebuild-search-index.cjs
 */

const fs = require('fs').promises;
const path = require('path');

// Output paths
const PUBLIC_TEXTS_DIR = path.join(__dirname, '..', 'public', 'texts');
const PUBLIC_INDEX_FILE = path.join(__dirname, '..', 'public', 'search-index.json');
const ASSETS_TEXTS_DIR = path.join(__dirname, '..', 'assets', 'texts');
const ASSETS_INDEX_FILE = path.join(__dirname, '..', 'assets', 'search-index.json');

// Common stop words to exclude from token index
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

/**
 * Tokenize text into searchable words
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Generate n-grams from text
 */
function generateNgrams(text, sizes = [3, 4, 5]) {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const ngrams = [];

  for (const size of sizes) {
    for (let i = 0; i <= words.length - size; i++) {
      const ngram = words.slice(i, i + size).join(' ');
      if (ngram.length > 5) {
        ngrams.push(ngram);
      }
    }
  }

  return [...new Set(ngrams)].slice(0, 50);
}

/**
 * Generate search index from document objects
 */
function generateSearchIndex(documents) {
  const index = {
    version: '1.0.0',
    buildDate: new Date().toISOString(),
    documents: [],
    metadata: {}
  };

  for (const doc of documents) {
    if (!doc || !doc.docId || !doc.sections) continue;

    index.metadata[doc.docId] = {
      title: doc.title || 'Untitled',
      author: doc.author || 'Unknown',
      url: doc.url || '',
      category: doc.category || ''
    };

    for (const section of doc.sections) {
      if (!section.paragraphs) continue;

      for (let i = 0; i < section.paragraphs.length; i++) {
        const para = section.paragraphs[i];
        const tokens = tokenize(para);
        const ngrams = generateNgrams(para);

        index.documents.push({
          id: `${doc.docId}-${(section.title || 'untitled').substring(0, 20).replace(/\s+/g, '-').toLowerCase()}-${i}`,
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

  return index;
}

/**
 * Main execution
 */
async function main() {
  console.log('Rebuilding Search Index from Existing Files');
  console.log('='.repeat(50));
  console.log('');

  // Read all text files from public/texts/
  console.log(`Reading text files from: ${PUBLIC_TEXTS_DIR}`);
  const files = await fs.readdir(PUBLIC_TEXTS_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  console.log(`Found ${jsonFiles.length} text files\n`);

  const documents = [];
  let successCount = 0;
  let errorCount = 0;

  for (const file of jsonFiles) {
    try {
      const filePath = path.join(PUBLIC_TEXTS_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const doc = JSON.parse(content);

      if (doc.docId && doc.sections) {
        documents.push(doc);
        successCount++;

        if (successCount % 50 === 0) {
          console.log(`  Processed ${successCount} files...`);
        }
      } else {
        console.warn(`  Warning: ${file} missing docId or sections`);
        errorCount++;
      }
    } catch (err) {
      console.error(`  Error reading ${file}: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\nProcessed: ${successCount} documents, ${errorCount} errors`);
  console.log('='.repeat(50));

  // Generate search index
  console.log('Generating search index...');
  const searchIndex = generateSearchIndex(documents);
  const indexJson = JSON.stringify(searchIndex, null, 2);

  // Write to both public/ and assets/
  await fs.writeFile(PUBLIC_INDEX_FILE, indexJson);
  console.log(`  ✓ Written: ${PUBLIC_INDEX_FILE}`);

  await fs.mkdir(ASSETS_TEXTS_DIR, { recursive: true });
  await fs.writeFile(ASSETS_INDEX_FILE, indexJson);
  console.log(`  ✓ Written: ${ASSETS_INDEX_FILE}`);

  console.log('\n' + '='.repeat(50));
  console.log('Complete!');
  console.log(`  Documents indexed: ${documents.length}`);
  console.log(`  Search entries: ${searchIndex.documents.length}`);
  console.log(`  Metadata entries: ${Object.keys(searchIndex.metadata).length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
