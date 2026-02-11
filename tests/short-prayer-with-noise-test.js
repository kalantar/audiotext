/**
 * Test Case: Short Prayer with Noise
 *
 * Synthetic test with added noise to simulate speech-to-text errors.
 * Expected to match: prayers-meditations paragraph 1
 *
 * Run with: npm start, then in browser console:
 * import { runTest } from './tests/short-prayer-with-noise-test.js';
 * runTest(findBestMatch, searchIndex);
 */

export const testCase = {
  // Noisy transcribed text
  transcribedText: `by bahá’u’lláh`,

  // Expected correct match
  expectedMatch: {
    docId: 'prayers-meditations',
    section: 'I',
    paragraphNum: 1
  },

  // Actual paragraph text for reference
  correctParagraphText: `by Bahá’u’lláh`,

  // Progressive transcription stages (simulating real-time speech recognition)
  progressiveStages: [

  ]
};

/**
 * Run the test with a given findBestMatch function
 */
export function runTest(findBestMatch, searchIndex) {
  console.log('=== Short Prayer with Noise ===\n');
  console.log('Expected:', testCase.expectedMatch);
  console.log('Has synthetic noise:', true);
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
