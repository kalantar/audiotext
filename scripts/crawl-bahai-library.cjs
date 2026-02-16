#!/usr/bin/env node
/**
 * Crawler script for Bahá'í Reference Library
 *
 * Automatically discovers and downloads all texts from bahai.org/library
 * Fetches the .xhtml version of each document (complete HTML in one file)
 *
 * Generates (writes to both locations):
 * - assets/search-index.json + public/search-index.json - lightweight search index
 * - assets/texts/{doc-id}.json + public/texts/{doc-id}.json - full document content
 *
 * Usage: node scripts/crawl-bahai-library.js
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

const BASE_URL = 'https://www.bahai.org';

// Output directories - write to both assets/ (native) and public/ (web)
const ASSETS_TEXTS_DIR = path.join(__dirname, '..', 'assets', 'texts');
const ASSETS_INDEX_FILE = path.join(__dirname, '..', 'assets', 'search-index.json');
const PUBLIC_TEXTS_DIR = path.join(__dirname, '..', 'public', 'texts');
const PUBLIC_INDEX_FILE = path.join(__dirname, '..', 'public', 'search-index.json');

// Rate limiting: delay between requests (ms)
const REQUEST_DELAY = 500;

// Categories to crawl
const CATEGORIES = [
  '/library/authoritative-texts/bahaullah/',
  // '/library/authoritative-texts/the-bab/',
  // '/library/authoritative-texts/abdul-baha/',
  // '/library/authoritative-texts/shoghi-effendi/',
  // '/library/authoritative-texts/the-universal-house-of-justice/',
  // '/library/authoritative-texts/compilations/',
  // '/library/authoritative-texts/prayers/',
  // '/library/other-literature/official-statements-commentaries/',
  // '/library/other-literature/publications-individual-authors/',
];

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
 * Fetch a URL and return the HTML content
 */
function fetchPage(urlPath) {
  return new Promise((resolve, reject) => {
    const fullUrl = urlPath.startsWith('http') ? urlPath : BASE_URL + urlPath;
    console.log(`  Fetching: ${fullUrl}`);

    https.get(fullUrl, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        const redirectUrl = res.headers.location;
        fetchPage(redirectUrl).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${fullUrl}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract document links from a category page
 * Returns array of { path, title }
 */
function extractDocumentLinks(html, categoryPath) {
  const links = [];

  // Match links that look like document pages (not downloads, search, etc.)
  // Pattern: /library/authoritative-texts/author/document-name/
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    const title = match[2].trim();

    // Filter for document links:
    // - Must be under the current category
    // - Must not be a download, search, or navigation link
    // - Must have a deeper path than the category itself
    if (href.startsWith(categoryPath) &&
        href !== categoryPath &&
        !href.includes('/downloads') &&
        !href.includes('/search') &&
        !href.includes('.pdf') &&
        !href.includes('.docx') &&
        !href.includes('.xhtml') &&
        !href.includes('#') &&
        title.length > 0) {

      // Only include if it's a direct child (document page)
      const relativePath = href.slice(categoryPath.length);
      const pathParts = relativePath.split('/').filter(p => p.length > 0);

      if (pathParts.length === 1) {
        links.push({ path: href, title });
      }
    }
  }

  // Remove duplicates
  const seen = new Set();
  return links.filter(link => {
    if (seen.has(link.path)) return false;
    seen.add(link.path);
    return true;
  });
}

/**
 * Get the .xhtml URL for a document
 * Document path like /library/.../document-name/ -> /library/.../document-name/document-name.xhtml
 */
function getXhtmlUrl(documentPath) {
  // Remove trailing slash and get the document slug
  const cleanPath = documentPath.replace(/\/$/, '');
  const slug = cleanPath.split('/').pop();
  return `${cleanPath}/${slug}.xhtml`;
}

/**
 * Extract document ID from path
 */
function getDocumentId(documentPath) {
  return documentPath.replace(/\/$/, '').split('/').pop();
}

/**
 * Extract metadata from the xhtml document
 */
function extractMetadata(html) {
  const metadata = {};

  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  // Extract author from meta tag
  const authorMatch = html.match(/<meta[^>]+name="author"[^>]+content="([^"]+)"/i);
  if (authorMatch) {
    metadata.author = authorMatch[1].trim();
  }

  // Extract document-id from meta tag
  const docIdMatch = html.match(/<meta[^>]+name="document-id"[^>]+content="([^"]+)"/i);
  if (docIdMatch) {
    metadata.documentId = docIdMatch[1].trim();
  }

  return metadata;
}

/**
 * Extract sections and paragraphs from xhtml content
 */
function extractContent(html) {
  const sections = [];
  let currentSection = { title: 'Main', paragraphs: [] };

  // Remove script, style, nav, header, footer
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');

  // Find section headers (h1, h2, h3) and paragraphs
  const elementPattern = /<(h[1-3]|p)[^>]*>([\s\S]*?)<\/\1>/gi;

  let match;
  while ((match = elementPattern.exec(cleanHtml)) !== null) {
    const tag = match[1].toLowerCase();
    let content = match[2]
      .replace(/<[^>]+>/g, ' ')  // Remove nested tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&lsquo;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (content.length < 3) continue;

    if (tag.startsWith('h')) {
      // New section
      if (currentSection.paragraphs.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: content, paragraphs: [] };
    } else if (tag === 'p' && content.length > 10) {
      currentSection.paragraphs.push(content);
    }
  }

  // Don't forget the last section
  if (currentSection.paragraphs.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Tokenize text for search index
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
 * Discover all documents from category pages
 */
async function discoverDocuments() {
  console.log('Discovering documents...\n');
  const allDocuments = [];

  for (const category of CATEGORIES) {
    console.log(`Category: ${category}`);
    try {
      const html = await fetchPage(category);
      const documents = extractDocumentLinks(html, category);
      console.log(`  Found ${documents.length} documents\n`);

      for (const doc of documents) {
        allDocuments.push({
          ...doc,
          category,
          id: getDocumentId(doc.path),
          xhtmlUrl: getXhtmlUrl(doc.path)
        });
      }

      await sleep(REQUEST_DELAY);
    } catch (err) {
      console.error(`  Error fetching category: ${err.message}\n`);
    }
  }

  // Remove duplicates (same document might appear in multiple places)
  const seen = new Set();
  return allDocuments.filter(doc => {
    if (seen.has(doc.id)) return false;
    seen.add(doc.id);
    return true;
  });
}

/**
 * Crawl a single document
 */
async function crawlDocument(doc) {
  console.log(`\nCrawling: ${doc.title} (${doc.id})`);

  try {
    const html = await fetchPage(doc.xhtmlUrl);
    const metadata = extractMetadata(html);
    const sections = extractContent(html);

    const totalParagraphs = sections.reduce((sum, s) => sum + s.paragraphs.length, 0);
    console.log(`  Extracted ${sections.length} sections, ${totalParagraphs} paragraphs`);

    return {
      docId: doc.id,
      title: metadata.title || doc.title,
      author: metadata.author || 'Unknown',
      url: BASE_URL + doc.path,
      xhtmlUrl: BASE_URL + doc.xhtmlUrl,
      category: doc.category,
      fetchDate: new Date().toISOString(),
      sections
    };
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    return null;
  }
}

/**
 * Generate search index from crawled documents
 */
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

  return index;
}

/**
 * Main execution
 */
async function main() {
  console.log('Bahá\'í Library Crawler');
  console.log('='.repeat(50));
  console.log('');

  // Ensure output directories exist (both assets/ and public/)
  await fs.mkdir(ASSETS_TEXTS_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_TEXTS_DIR, { recursive: true });

  // Discover all documents
  const documents = await discoverDocuments();
  console.log(`\nTotal documents to crawl: ${documents.length}`);
  console.log('='.repeat(50));

  const crawledDocs = [];

  for (const doc of documents) {
    try {
      const content = await crawlDocument(doc);
      if (content) {
        crawledDocs.push(content);

        // Save full document to both locations
        const contentJson = JSON.stringify(content, null, 2);
        const assetsPath = path.join(ASSETS_TEXTS_DIR, `${doc.id}.json`);
        const publicPath = path.join(PUBLIC_TEXTS_DIR, `${doc.id}.json`);

        await fs.writeFile(assetsPath, contentJson);
        await fs.writeFile(publicPath, contentJson);
        console.log(`  Saved: ${doc.id}.json (assets + public)`);
      }

      // Rate limit
      await sleep(REQUEST_DELAY);
    } catch (err) {
      console.error(`Error crawling ${doc.id}:`, err.message);
    }
  }

  // Generate and save search index to both locations
  console.log('\n' + '='.repeat(50));
  console.log('Generating search index...');
  const searchIndex = generateSearchIndex(crawledDocs);
  const indexJson = JSON.stringify(searchIndex, null, 2);

  await fs.writeFile(ASSETS_INDEX_FILE, indexJson);
  await fs.writeFile(PUBLIC_INDEX_FILE, indexJson);

  console.log(`\nComplete!`);
  console.log(`  Documents crawled: ${crawledDocs.length}`);
  console.log(`  Index entries: ${searchIndex.documents.length}`);
  console.log(`  Assets: ${ASSETS_INDEX_FILE}`);
  console.log(`  Public: ${PUBLIC_INDEX_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
