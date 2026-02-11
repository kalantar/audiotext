/**
 * Test Case: Unique Text - Kitáb-i-Íqán Noah Story
 *
 * Synthetic test with clean text.
 * Expected to match: kitab-i-iqan paragraph 8
 *
 * Run with: npm start, then in browser console:
 * import { runTest } from './tests/unique-text-kit-b-i-q-n-noah-story-test.js';
 * runTest(findBestMatch, searchIndex);
 */

export const testCase = {
  // Clean transcribed text
  transcribedText: `among the prophets was noah. for nine hundred and fifty years he prayerfully exhorted his people and summoned them to the haven of security and peace. none, however, heeded his call. each day they inflicted on his blessed person such pain and suffering that no one believed he could survive. how frequently they denied him, how malevolently they hinted their suspicion against him! thus it hath been revealed: “and as often as a company of his people passed by him, they derided him. to them he said: ‘though ye scoff at us now, we will scoff at you hereafter even as ye scoff at us. in the end ye shall know.’” 3 long afterward, he several times promised victory to his companions and fixed the hour thereof. but when the hour struck, the divine promise was not fulfilled. this caused a few among the small number of his followers to turn away from him, and to this testify the records of the best-known books. these you must certainly have perused; if not, undoubtedly you will. finally, as stated in books and traditions, there remained with him only forty or seventy-two of his followers. at last from the depth of his being he cried aloud: “lord! leave not upon the land a single dweller from among the unbelievers.” 4`,

  // Expected correct match
  expectedMatch: {
    docId: 'kitab-i-iqan',
    section: 'Part One',
    paragraphNum: 8
  },

  // Actual paragraph text for reference
  correctParagraphText: `Among the Prophets was Noah. For nine hundred and fifty years He prayerfully exhorted His people and summoned them to the haven of security and peace. None, however, heeded His call. Each day they inflicted on His blessed person such pain and suffering that no one believed He could survive. How frequently they denied Him, how malevolently they hinted their suspicion against Him! Thus it hath been revealed: “And as often as a company of His people passed by Him, they derided Him. To them He said: ‘Though ye scoff at us now, we will scoff at you hereafter even as ye scoff at us. In the end ye shall know.’” 3 Long afterward, He several times promised victory to His companions and fixed the hour thereof. But when the hour struck, the divine promise was not fulfilled. This caused a few among the small number of His followers to turn away from Him, and to this testify the records of the best-known books. These you must certainly have perused; if not, undoubtedly you will. Finally, as stated in books and traditions, there remained with Him only forty or seventy-two of His followers. At last from the depth of His being He cried aloud: “Lord! Leave not upon the land a single dweller from among the unbelievers.” 4`,

  // Progressive transcription stages (simulating real-time speech recognition)
  progressiveStages: [
    { words: 'Among the Prophets was Noah. For', wordCount: 6, description: 'Below minimum threshold (< 8 words)' },
    { words: 'Among the Prophets was Noah. For nine hundred and fifty', wordCount: 10, description: 'Just above minimum (10 words)' },
    { words: 'Among the Prophets was Noah. For nine hundred and fifty years He prayerfully exhorted His people', wordCount: 16, description: 'Good context for matching (16 words)' },
    { words: 'Among the Prophets was Noah. For nine hundred and fifty years He prayerfully exhorted His people and summoned them to the haven of security and', wordCount: 25, description: 'Excellent context (25 words)' },
    { words: 'Among the Prophets was Noah. For nine hundred and fifty years He prayerfully exhorted His people and summoned them to the haven of security and peace. None, however, heeded His call. Each day they inflicted on His blessed person such pain and suffering that no', wordCount: 45, description: 'Full sliding window (45 words)' }
  ]
};

/**
 * Run the test with a given findBestMatch function
 */
export function runTest(findBestMatch, searchIndex) {
  console.log('=== Unique Text - Kitáb-i-Íqán Noah Story ===\n');
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
