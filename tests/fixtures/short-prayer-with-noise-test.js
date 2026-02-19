/**
 * Test Case: Short Prayer with Noise
 *
 * Synthetic test with added noise to simulate speech-to-text errors.
 * Expected to match: prayers-meditations paragraph 3
 *
 * Run with: npm start, then in browser console:
 * import { runTest } from './tests/short-prayer-with-noise-test.js';
 * runTest(findBestMatch, searchIndex);
 */

export const testCase = {
  // Noisy transcribed text
  transcribedText: `glorified art thou, o lord my god! every man of insight confesseth thy sovereignty and thy dominion, and every discerning eye perceiveth the greatness of thy majesty and the compelling power of thy might. the winds of tests are powerless to hold back them that enjoy near access to the from setting their faces towards the horizon of thy glory, and the tempests of trials must fail to draw away and hinder such as are wholly devoted to thy will from approaching thy court.`,

  // Expected correct match
  expectedMatch: {
    docId: 'prayers-meditations',
    section: 'Prayers and Meditations',
    paragraphNum: 3
  },

  // This prayer appears verbatim in multiple documents — either is a valid match
  acceptableMatches: [
    { docId: 'prayers-meditations', paragraphNum: 3 },
    { docId: 'bahai-prayers', paragraphNum: 721 }
  ],

  // Actual paragraph text for reference
  correctParagraphText: `Glorified art Thou, O Lord my God! Every man of insight confesseth Thy sovereignty and Thy dominion, and every discerning eye perceiveth the greatness of Thy majesty and the compelling power of Thy might. The winds of tests are powerless to hold back them that enjoy near access to Thee from setting their faces towards the horizon of Thy glory, and the tempests of trials must fail to draw away and hinder such as are wholly devoted to Thy will from approaching Thy court.`,

  // Progressive transcription stages (simulating real-time speech recognition)
  progressiveStages: [
    { words: 'glorified art you, o lord my', wordCount: 6, description: 'Below minimum threshold (< 8 words)' },
    { words: 'glorified art you, o lord my god! every man of', wordCount: 10, description: 'Just above minimum (10 words)' },
    { words: 'glorified art you, o lord my god! every man of insight confesseth thy sovereignty and thy', wordCount: 16, description: 'Good context for matching (16 words)' },
    { words: 'glorified art you, o lord my god! every man of insight confesseth thy sovereignty and thy dominion, and every discerning eye perceiveth the greatness of', wordCount: 25, description: 'Excellent context (25 words)' },
    { words: 'glorified art you, o lord my god! every man of insight confesseth thy sovereignty and thy dominion, and every discerning eye perceiveth the greatness of thy majesty and the compelling power of thy might. the winds of tests are powerless to hold back them that', wordCount: 45, description: 'Full sliding window (45 words)' }
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
