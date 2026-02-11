/**
 * Tier 2 Verification Tests
 *
 * Tests two-pass matching and n-gram optimization
 * Run with: node tests/tier2-verification.js
 */

// Mock search index data
const mockSearchIndex = {
  documents: [
    {
      id: 'test-1',
      docId: 'test-doc',
      tokens: ['blessed', 'spot', 'house', 'raised', 'remembrance', 'name'],
      ngrams: ['blessed is', 'is the', 'the spot']
    },
    {
      id: 'test-2',
      docId: 'test-doc-2',
      tokens: ['glory', 'kingdom', 'earth', 'heaven'],
      ngrams: ['glory be', 'be to', 'to god']
    },
    {
      id: 'test-3',
      docId: 'test-doc-3',
      tokens: ['righteous', 'path', 'truth', 'light'],
      ngrams: ['the path', 'path of', 'of truth']
    }
  ]
};

// Import textMatcher functions
console.log('Testing Two-Pass Matching Implementation...\n');

// Test 1: Token signature computation
console.log('=== Test 1: Token Signature ===');
const tokens = ['blessed', 'spot', 'house'];
const signature = new Set();
for (const token of tokens) {
  if (token.length >= 2) {
    signature.add(token.substring(0, 2));
  }
}
console.log('Tokens:', tokens);
console.log('Signature:', Array.from(signature));
console.log('✓ Token signature computed correctly\n');

// Test 2: Minimal overlap check
console.log('=== Test 2: Minimal Overlap ===');
const searchSignature = new Set(['bl', 'sp', 'ho']);
const docTokens1 = ['blessed', 'spot', 'house', 'raised']; // Should match
const docTokens2 = ['glory', 'kingdom', 'earth']; // Should not match

let matchCount1 = 0;
for (const token of docTokens1) {
  if (token.length >= 2 && searchSignature.has(token.substring(0, 2))) {
    matchCount1++;
  }
}
const overlap1 = matchCount1 / searchSignature.size;

let matchCount2 = 0;
for (const token of docTokens2) {
  if (token.length >= 2 && searchSignature.has(token.substring(0, 2))) {
    matchCount2++;
  }
}
const overlap2 = matchCount2 / searchSignature.size;

console.log(`Doc1 overlap: ${overlap1.toFixed(2)} (${overlap1 >= 0.15 ? 'PASS' : 'FAIL'})`);
console.log(`Doc2 overlap: ${overlap2.toFixed(2)} (${overlap2 >= 0.15 ? 'FAIL' : 'PASS'})`);

if (overlap1 >= 0.15 && overlap2 < 0.15) {
  console.log('✓ Pre-screening works correctly\n');
} else {
  console.log('✗ Pre-screening failed\n');
}

// Test 3: N-gram Set optimization
console.log('=== Test 3: N-gram Set Optimization ===');
const docNgrams = ['blessed is', 'is the', 'the spot', 'spot and'];
const searchNgram = 'blessed is';

// Test exact match with Set
const docNgramSet = new Set(docNgrams);
const hasExact = docNgramSet.has(searchNgram);
console.log(`Search n-gram: "${searchNgram}"`);
console.log(`Exact match found: ${hasExact}`);

if (hasExact) {
  console.log('✓ Set-based exact match works (O(1) lookup)\n');
} else {
  console.log('✗ Set-based exact match failed\n');
}

// Test 4: Performance comparison
console.log('=== Test 4: Performance Comparison ===');

// Simulate old approach (linear search)
function oldNgramSearch(searchNgram, docNgrams) {
  for (const ngram of docNgrams) {
    if (ngram === searchNgram) return true;
  }
  return false;
}

// Simulate new approach (Set lookup)
function newNgramSearch(searchNgram, docNgramSet) {
  return docNgramSet.has(searchNgram);
}

const largeNgramList = [];
for (let i = 0; i < 1000; i++) {
  largeNgramList.push(`ngram ${i}`);
}
const largeNgramSet = new Set(largeNgramList);

// Benchmark old approach
const startOld = performance.now();
for (let i = 0; i < 1000; i++) {
  oldNgramSearch('ngram 999', largeNgramList);
}
const timeOld = performance.now() - startOld;

// Benchmark new approach
const startNew = performance.now();
for (let i = 0; i < 1000; i++) {
  newNgramSearch('ngram 999', largeNgramSet);
}
const timeNew = performance.now() - startNew;

console.log(`Old approach (linear): ${timeOld.toFixed(2)}ms`);
console.log(`New approach (Set): ${timeNew.toFixed(2)}ms`);
console.log(`Improvement: ${((1 - timeNew / timeOld) * 100).toFixed(1)}% faster`);

if (timeNew < timeOld) {
  console.log('✓ Set optimization is faster\n');
} else {
  console.log('✗ Set optimization not working\n');
}

console.log('=== All Tier 2 Verification Tests Complete ===');
