/**
 * Test Case: Common Phrase - "O Son of..." (Arabic #1)
 *
 * Synthetic test with clean text.
 * Expected to match: hidden-words paragraph 3
 *
 * Run with: npm start, then in browser console:
 * import { runTest } from './tests/common-phrase-o-son-of-arabic-1-test.js';
 * runTest(findBestMatch, searchIndex);
 */

export const testCase = {
  // Clean transcribed text
  transcribedText: `1 o son of spirit! my first counsel is this: possess a pure, kindly and radiant heart, that thine may be a sovereignty ancient, imperishable and everlasting.`,

  // Expected correct match
  expectedMatch: {
    docId: 'hidden-words',
    section: 'From the Arabic',
    paragraphNum: 3
  },

  // Actual paragraph text for reference
  correctParagraphText: `1 O Son of Spirit! My first counsel is this: Possess a pure, kindly and radiant heart, that thine may be a sovereignty ancient, imperishable and everlasting.`,

  // Progressive transcription stages (simulating real-time speech recognition)
  progressiveStages: [
    { words: '1 O Son of Spirit! My', wordCount: 6, description: 'Below minimum threshold (< 8 words)' },
    { words: '1 O Son of Spirit! My first counsel is this:', wordCount: 10, description: 'Just above minimum (10 words)' },
    { words: '1 O Son of Spirit! My first counsel is this: Possess a pure, kindly and radiant', wordCount: 16, description: 'Good context for matching (16 words)' },
    { words: '1 O Son of Spirit! My first counsel is this: Possess a pure, kindly and radiant heart, that thine may be a sovereignty ancient, imperishable', wordCount: 25, description: 'Excellent context (25 words)' }
  ]
};

/**
 * Run the test with a given findBestMatch function
 */
export function runTest(findBestMatch, searchIndex) {
  console.log('=== Common Phrase - "O Son of..." (Arabic #1) ===\n');
  console.log('Expected:', testCase.expectedMatch);
  console.log('Has synthetic noise:', false);
  console.log('\n');

  const results = [];
  let previousMatch = null;

  // Test each progressive stage
  for (const stage of testCase.progressiveStages) {
    const words = stage.words.split(/\s+/).filter(w => w.length > 0);

    console.log(`\n--- ${stage.description} (${words.length} words) ---`);

    // Create context from previous match
    const context = previousMatch ? {
      previousDocId: previousMatch.docId,
      previousParagraphNum: previousMatch.paragraphNum,
      previousSection: previousMatch.section,
      previousScore: previousMatch.score,
      matchHistory: []
    } : {};

    // Find best match
    const match = findBestMatch(words, searchIndex, context);

    if (match) {
      const isCorrect = match.docId === testCase.expectedMatch.docId &&
                       match.paragraphNum === testCase.expectedMatch.paragraphNum;

      console.log(`Match: ${match.docId} p${match.paragraphNum}, score: ${match.score.toFixed(3)}`);
      console.log(`Result: ${isCorrect ? '✓ CORRECT' : '✗ WRONG (expected ' + testCase.expectedMatch.docId + ' p' + testCase.expectedMatch.paragraphNum + ')'}`);

      results.push({
        words: words.length,
        match: `${match.docId} p${match.paragraphNum}`,
        score: match.score.toFixed(3),
        correct: isCorrect ? '✓' : '✗'
      });

      previousMatch = match;
    } else {
      console.log('No match found');
      results.push({
        words: words.length,
        match: 'NONE',
        score: '0.000',
        correct: stage.wordCount < 8 ? '✓ (expected)' : '✗'
      });
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  console.table(results);

  const correctCount = results.filter(r => r.correct === '✓' || r.correct === '✓ (expected)').length;
  console.log(`\nSuccess Rate: ${correctCount}/${results.length} (${(correctCount / results.length * 100).toFixed(1)}%)`);

  return {
    results,
    correctCount,
    totalCount: results.length,
    successRate: correctCount / results.length
  };
}
