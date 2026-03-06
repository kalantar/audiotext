#!/usr/bin/env node
/**
 * Test Runner for Text Matching Tests
 *
 * Usage: node tests/run-tests.mjs [test-file.js]
 *        node tests/run-tests.mjs  (runs all tests)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load search index
const searchIndexPath = path.join(__dirname, '../../public/search-index.json');
const searchIndex = JSON.parse(fs.readFileSync(searchIndexPath, 'utf8'));

// Import textMatcher
const textMatcherModule = await import('../../utils/textMatcher.js');
const { findBestMatch } = textMatcherModule;

// Test files to run
const specificTest = process.argv[2];
const testFiles = specificTest ? [specificTest] : [
  '../fixtures/paragraph-67-test.js',
  '../fixtures/unique-text-kit-b-i-q-n-noah-story-test.js',
  '../fixtures/common-phrase-o-son-of-arabic-1-test.js',
  '../fixtures/long-text-epistle-mid-paragraph-test.js',
  '../fixtures/short-prayer-with-noise-test.js',
  '../fixtures/iqan-paragraph-79-oscillation-test.js'
];

console.log('='.repeat(70));
console.log('TEXT MATCHING TEST RUNNER');
console.log('='.repeat(70));
console.log(`Search index: ${searchIndex.documents.length} documents\n`);

const allResults = [];
let totalTests = 0;

for (const testFile of testFiles) {
  const testPath = path.join(__dirname, testFile);

  if (!fs.existsSync(testPath)) {
    console.log(`⚠️  Skip: ${testFile} (not found)\n`);
    continue;
  }

  try {
    // Dynamic import of test module
    const testModule = await import(`file://${testPath}`);
    const testCase = testModule.testCase || testModule.paragraph67TestCase;

    if (!testCase) {
      console.log(`⚠️  Skip: ${testFile} (no testCase export)\n`);
      continue;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`TEST: ${testFile}`);
    console.log('='.repeat(70));
    const acceptable = testCase.acceptableMatches ||
      [{ docId: testCase.expectedMatch.docId, paragraphNum: testCase.expectedMatch.paragraphNum }];
    console.log(`Expected: ${acceptable.map(m => `${m.docId} p${m.paragraphNum}`).join(' or ')}`);
    console.log(`Stages: ${testCase.progressiveStages.length}\n`);

    totalTests++;
    let stagesPassed = 0;
    let stagesFailed = 0;
    let previousMatch = null;

    // Test each progressive stage
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

      let passed = false;
      let statusSymbol = '';

      if (match) {
        // Support acceptableMatches array for texts that appear in multiple documents
        const acceptable = testCase.acceptableMatches ||
          [{ docId: testCase.expectedMatch.docId, paragraphNum: testCase.expectedMatch.paragraphNum }];
        const isCorrect = acceptable.some(m => match.docId === m.docId && match.paragraphNum === m.paragraphNum);

        if (isCorrect) {
          passed = true;
          statusSymbol = '✓';
          stagesPassed++;
        } else {
          passed = false;
          statusSymbol = '✗';
          stagesFailed++;
        }

        console.log(`  [${statusSymbol}] ${stage.wordCount} words: ${match.docId} p${match.paragraphNum} (score: ${match.score.toFixed(3)})`);

        if (!isCorrect) {
          const expectedStr = acceptable.map(m => `${m.docId} p${m.paragraphNum}`).join(' or ');
          console.log(`      Expected: ${expectedStr}`);
        }

        allResults.push({
          test: testFile,
          stage: stage.wordCount,
          expected: acceptable.map(m => `${m.docId} p${m.paragraphNum}`).join(' or '),
          actual: `${match.docId} p${match.paragraphNum}`,
          passed: isCorrect
        });

        previousMatch = match;
      } else {
        // No match
        const expectedNoMatch = stage.wordCount < 8;

        if (expectedNoMatch) {
          passed = true;
          statusSymbol = '✓';
          stagesPassed++;
        } else {
          passed = false;
          statusSymbol = '✗';
          stagesFailed++;
        }

        console.log(`  [${statusSymbol}] ${stage.wordCount} words: NO MATCH ${expectedNoMatch ? '(expected)' : '(UNEXPECTED!)'}`);

        allResults.push({
          test: testFile,
          stage: stage.wordCount,
          expected: expectedNoMatch ? 'NO MATCH' : `${testCase.expectedMatch.docId} p${testCase.expectedMatch.paragraphNum}`,
          actual: 'NO MATCH',
          passed: expectedNoMatch
        });
      }
    }

    // Test summary
    const testPassed = stagesFailed === 0;
    const testSymbol = testPassed ? '✓' : '✗';
    console.log(`\n  ${testSymbol} Test Result: ${stagesPassed}/${testCase.progressiveStages.length} stages passed`);

  } catch (err) {
    console.log(`⚠️  Error running ${testFile}: ${err.message}`);
    console.error(err.stack);
  }
}

// Overall summary
console.log(`\n\n${'='.repeat(70)}`);
console.log('SUMMARY');
console.log('='.repeat(70));

const totalStages = allResults.length;
const passedStages = allResults.filter(r => r.passed).length;
const failedStages = totalStages - passedStages;

console.log(`Tests run: ${totalTests}`);
console.log(`Total stages: ${totalStages}`);
console.log(`Passed: ${passedStages} (${totalStages > 0 ? (passedStages/totalStages*100).toFixed(1) : 0}%)`);
console.log(`Failed: ${failedStages} (${totalStages > 0 ? (failedStages/totalStages*100).toFixed(1) : 0}%)`);

if (failedStages > 0) {
  console.log(`\nFailed stages:`);
  allResults.filter(r => !r.passed).forEach(r => {
    console.log(`  ✗ ${r.test} (${r.stage} words): expected ${r.expected}, got ${r.actual}`);
  });
  console.log('');
  process.exit(1);
} else {
  console.log(`\n✓ All tests passed!\n`);
  process.exit(0);
}
