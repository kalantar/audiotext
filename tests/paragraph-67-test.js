/**
 * Test Case: Paragraph 67 Matching
 *
 * Real-world test case from user transcription that should match
 * gems-divine-mysteries paragraph 67, but was incorrectly matching
 * call-divine-beloved paragraph 2.
 *
 * Run with: npm start, then check console for test results
 * Or create a web test page to run in browser
 */

// This test is designed to be run in the browser alongside the app
// It validates the matching algorithm against real transcription data

export const paragraph67TestCase = {
  // Actual transcribed text from Vosk (with noise)
  transcribedText: `in this connection we were related to me that which was revealed of old concerning life that perchance it may turn the away from the promptings of south looper from the narrow confines of a prison in is gloomy plane an aide the to become of them that are guided or right in the darkness of this world he say if and he barely speak the truth shut the dead whom we have quickened and for whom we have ordained a light whereby he may walk amongst men be like him was likenesses in the darkness once he will not come for`,

  // Expected correct match
  expectedMatch: {
    docId: 'gems-divine-mysteries',
    section: 'Gems of Divine Mysteries',
    paragraphNum: 67
  },

  // Actual paragraph 67 text for reference
  correctParagraphText: `In this connection We will relate unto thee that which was revealed of old concerning "life", that perchance it may turn thee away from the promptings of self, deliver thee from the narrow confines of thy prison in this gloomy plane, and aid thee to become of them that are guided aright in the darkness of this world.`,

  // Progressive transcription stages (simulating real-time speech recognition)
  // Note: Minimum 8 words required for matching (prevents early lock-in)
  progressiveStages: [
    { words: 'in this connection', wordCount: 3, description: 'Too short (< 8 words), should return no match' },
    { words: 'in this connection we were related', wordCount: 6, description: 'Still too short (< 8 words)' },
    { words: 'in this connection we were related to me that which was revealed of old', wordCount: 14, description: 'Should match paragraph 67 (14 words)' },
    { words: 'in this connection we were related to me that which was revealed of old concerning life that perchance it may turn the away from the promptings', wordCount: 28, description: 'Should clearly match paragraph 67 (28 words)' }
  ],

  // Log breakdown from actual run (for analysis)
  actualLog: {
    stage1: {
      words: 'in this connection',
      matched: 'call-divine-beloved paragraph 2',
      score: 1.02,
      topCandidates: [
        { doc: 'call-divine-beloved', score: 1.02 },
        { doc: 'call-divine-beloved', score: 0.92 },
        { doc: 'call-divine-beloved', score: 0.92 }
      ]
    },
    stage2: {
      words: 'in this connection we were related',
      matched: 'call-divine-beloved paragraph 2 (stuck due to stickiness)',
      attemptedMatch: 'gems-divine-mysteries',
      attemptedScore: 0.61,
      currentScore: 1.02,
      scoreDiff: -0.41,
      stickinessThreshold: 0.15
    }
  }
};

/**
 * Run the test with a given findBestMatch function
 */
export function runParagraph67Test(findBestMatch, searchIndex) {
  console.log('=== Paragraph 67 Matching Test ===\n');
  console.log('Expected:', paragraph67TestCase.expectedMatch);
  console.log('Total documents:', searchIndex.documents.length);
  console.log('\n');

  const results = [];
  let previousMatch = null;

  // Test each progressive stage
  for (const stage of paragraph67TestCase.progressiveStages) {
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
      const isCorrect = match.docId === paragraph67TestCase.expectedMatch.docId &&
                       match.paragraphNum === paragraph67TestCase.expectedMatch.paragraphNum;

      console.log(`Match: ${match.docId} p${match.paragraphNum}, score: ${match.score.toFixed(3)}`);
      console.log(`Result: ${isCorrect ? '✓ CORRECT' : '✗ WRONG (expected gems-divine-mysteries p67)'}`);

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
        correct: '✗'
      });
    }
  }

  // Test full transcription
  console.log(`\n--- Full transcription (${paragraph67TestCase.transcribedText.split(/\s+/).length} words) ---`);
  const fullWords = paragraph67TestCase.transcribedText.split(/\s+/).filter(w => w.length > 0);
  const context = previousMatch ? {
    previousDocId: previousMatch.docId,
    previousParagraphNum: previousMatch.paragraphNum,
    previousSection: previousMatch.section,
    previousScore: previousMatch.score,
    matchHistory: []
  } : {};

  const finalMatch = findBestMatch(fullWords, searchIndex, context);
  if (finalMatch) {
    const isCorrect = finalMatch.docId === paragraph67TestCase.expectedMatch.docId &&
                     finalMatch.paragraphNum === paragraph67TestCase.expectedMatch.paragraphNum;

    console.log(`Match: ${finalMatch.docId} p${finalMatch.paragraphNum}, score: ${finalMatch.score.toFixed(3)}`);
    console.log(`Result: ${isCorrect ? '✓ CORRECT' : '✗ WRONG (expected gems-divine-mysteries p67)'}`);

    results.push({
      words: fullWords.length,
      match: `${finalMatch.docId} p${finalMatch.paragraphNum}`,
      score: finalMatch.score.toFixed(3),
      correct: isCorrect ? '✓' : '✗'
    });
  }

  // Summary
  console.log('\n=== Summary ===');
  console.table(results);

  const correctCount = results.filter(r => r.correct === '✓').length;
  console.log(`\nSuccess Rate: ${correctCount}/${results.length} (${(correctCount / results.length * 100).toFixed(1)}%)`);

  return {
    results,
    correctCount,
    totalCount: results.length,
    successRate: correctCount / results.length
  };
}
