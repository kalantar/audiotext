#!/usr/bin/env node
/**
 * Test Runner for Text Matching Tests
 *
 * Runs all test cases and reports results
 */

const fs = require('fs');
const path = require('path');

// Load modules
const searchIndexPath = path.join(__dirname, '../public/search-index.json');
const searchIndex = JSON.parse(fs.readFileSync(searchIndexPath, 'utf8'));

// Import textMatcher functions (need to handle ES6 modules in CommonJS)
const textMatcherPath = path.join(__dirname, '../utils/textMatcher.js');
const textMatcherCode = fs.readFileSync(textMatcherPath, 'utf8');

// Very basic ES6 module to CommonJS conversion for testing
// In production, you'd use a proper module loader or run in browser
eval(textMatcherCode.replace(/export /g, 'global.'));

const { findBestMatch } = global;

// Test cases to run
const testFiles = [
  'paragraph-67-test.js',
  'unique-opener-kit-b-i-q-n-part-one-opening-test.js',
  'common-phrase-o-son-of-arabic-1-test.js',
  'long-text-gleanings-selection-i-test.js',
  'short-prayer-with-noise-test.js'
];

console.log('='.repeat(70));
console.log('RUNNING ALL TEXT MATCHING TESTS');
console.log('='.repeat(70));
console.log(`Total documents in index: ${searchIndex.documents.length}\n`);

const allResults = [];

for (const testFile of testFiles) {
  const testPath = path.join(__dirname, testFile);

  if (!fs.existsSync(testPath)) {
    console.log(`⚠️  Test file not found: ${testFile}\n`);
    continue;
  }

  const testCode = fs.readFileSync(testPath, 'utf8');

  // Extract test case data (very basic parsing)
  const testCaseMatch = testCode.match(/export const (?:testCase|paragraph67TestCase) = ({[\s\S]+?});/);

  if (!testCaseMatch) {
    console.log(`⚠️  Could not parse test case from: ${testFile}\n`);
    continue;
  }

  let testCase;
  try {
    // Evaluate the test case object
    testCase = eval(`(${testCaseMatch[1]})`);
  } catch (err) {
    console.log(`⚠️  Error parsing test case from ${testFile}: ${err.message}\n`);
    continue;
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${testFile}`);
  console.log('='.repeat(70));
  console.log(`Expected: ${testCase.expectedMatch.docId} p${testCase.expectedMatch.paragraphNum}\n`);

  const results = [];
  let previousMatch = null;

  // Test progressive stages
  for (const stage of testCase.progressiveStages) {
    const words = stage.words.split(/\s+/).filter(w => w.length > 0);

    const context = previousMatch ? {
      previousDocId: previousMatch.docId,
      previousParagraphNum: previousMatch.paragraphNum,
      previousSection: previousMatch.section,
      previousScore: previousMatch.score,
      matchHistory: []
    } : {};

    const match = findBestMatch(words, searchIndex, context);

    let isCorrect, status;
    if (match) {
      isCorrect = match.docId === testCase.expectedMatch.docId &&
                 match.paragraphNum === testCase.expectedMatch.paragraphNum;
      status = isCorrect ? '✓' : '✗';

      console.log(`[${status}] ${stage.wordCount} words: ${match.docId} p${match.paragraphNum} (score: ${match.score.toFixed(3)})`);

      results.push({
        file: testFile,
        words: stage.wordCount,
        expected: `${testCase.expectedMatch.docId} p${testCase.expectedMatch.paragraphNum}`,
        actual: `${match.docId} p${match.paragraphNum}`,
        score: match.score.toFixed(3),
        status: isCorrect ? 'PASS' : 'FAIL'
      });

      previousMatch = match;
    } else {
      // No match - this is expected for < 8 words
      const expectedNoMatch = stage.wordCount < 8;
      status = expectedNoMatch ? '✓' : '✗';

      console.log(`[${status}] ${stage.wordCount} words: NO MATCH ${expectedNoMatch ? '(expected)' : '(unexpected!)'}`);

      results.push({
        file: testFile,
        words: stage.wordCount,
        expected: `${testCase.expectedMatch.docId} p${testCase.expectedMatch.paragraphNum}`,
        actual: 'NO MATCH',
        score: '0.000',
        status: expectedNoMatch ? 'PASS' : 'FAIL'
      });
    }
  }

  allResults.push(...results);
}

// Summary
console.log(`\n\n${'='.repeat(70)}`);
console.log('SUMMARY');
console.log('='.repeat(70));

const passed = allResults.filter(r => r.status === 'PASS').length;
const failed = allResults.filter(r => r.status === 'FAIL').length;
const total = allResults.length;

console.log(`Total stages tested: ${total}`);
console.log(`Passed: ${passed} (${(passed/total*100).toFixed(1)}%)`);
console.log(`Failed: ${failed} (${(failed/total*100).toFixed(1)}%)`);

if (failed > 0) {
  console.log(`\nFailed stages:`);
  allResults.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  - ${r.file}: ${r.words} words - expected ${r.expected}, got ${r.actual}`);
  });
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
