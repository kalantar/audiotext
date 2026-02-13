/**
 * Test Case: Long Text - Epistle Mid-Paragraph
 *
 * Synthetic test with added noise to simulate speech-to-text errors.
 * Expected to match: epistle-son-wolf paragraph 10
 *
 * Run with: npm start, then in browser console:
 * import { runTest } from './tests/long-text-epistle-mid-paragraph-test.js';
 * runTest(findBestMatch, searchIndex);
 */

export const testCase = {
  // Noisy transcribed text
  transcribedText: `“i beseech thee, this very moment, by the mysteries of your book, and by the things hid in your knowledge, and by the pearls that lie concealed within the shells of the ocean of your mercy, to reckon me among such as you didst mention in your book and describe in your tablets. hast you decreed for me, o my god, any joy after this tribulation, or any relief to succeed this affliction, or any ease to follow this trouble? alas, alas! you hast ordained that every pulpit be set apart for your mention, and for the glorification of your word, and the revelation of your cause, but i have ascended it to proclaim the violation of your covenant, and have spoken unto your servants such words as have caused the dwellers of the tabernacles of your majesty and the denizens of the cities of your wisdom to lament. how often hast you sent down the food of thine utterance out of the heaven of your bounty, and i denied it; and how numerous the occasions on which you hast summoned me to the soft flowing waters of your mercy, and i have chosen to turn away therefrom, by reason of my having followed my own wish and desire! by your glory! i know not for which sin to beg your forgiveness and implore your pardon, nor from which of mine iniquities to turn aside unto the court of your bounteousness and the sanctuary of your favor. such are my sins and trespasses that no man can number them, nor pen describe them. i implore thee, o you that turnest darkness into light, and revealest your mysteries on the sinai of your revelation, to aid me, at all times, to put my trust in thee, and to commit mine affairs unto your care. make me, then, o my god, content with that which the finger of your decree has traced, and the pen of your ordinance has written. potent art you to do what pleaseth thee, and in your grasp are the reins of all that are in heaven and on earth. no god is there but thee, the all-knowing, the all-wise.”`,

  // Expected correct match
  expectedMatch: {
    docId: 'epistle-son-wolf',
    section: 'Epistle to the Son of the Wolf',
    paragraphNum: 10
  },

  // Actual paragraph text for reference
  correctParagraphText: `“I beseech Thee, this very moment, by the mysteries of Thy Book, and by the things hid in Thy knowledge, and by the pearls that lie concealed within the shells of the ocean of Thy mercy, to reckon me among such as Thou didst mention in Thy Book and describe in Thy Tablets. Hast Thou decreed for me, O my God, any joy after this tribulation, or any relief to succeed this affliction, or any ease to follow this trouble? Alas, alas! Thou hast ordained that every pulpit be set apart for Thy mention, and for the glorification of Thy Word, and the revelation of Thy Cause, but I have ascended it to proclaim the violation of Thy Covenant, and have spoken unto Thy servants such words as have caused the dwellers of the Tabernacles of Thy majesty and the denizens of the Cities of Thy wisdom to lament. How often hast Thou sent down the food of Thine utterance out of the heaven of Thy bounty, and I denied it; and how numerous the occasions on which Thou hast summoned me to the soft flowing waters of Thy mercy, and I have chosen to turn away therefrom, by reason of my having followed my own wish and desire! By Thy glory! I know not for which sin to beg Thy forgiveness and implore Thy pardon, nor from which of mine iniquities to turn aside unto the Court of Thy bounteousness and the Sanctuary of Thy favor. Such are my sins and trespasses that no man can number them, nor pen describe them. I implore Thee, O Thou that turnest darkness into light, and revealest Thy mysteries on the Sinai of Thy Revelation, to aid me, at all times, to put my trust in Thee, and to commit mine affairs unto Thy care. Make me, then, O my God, content with that which the finger of Thy decree hath traced, and the pen of Thy ordinance hath written. Potent art Thou to do what pleaseth Thee, and in Thy grasp are the reins of all that are in heaven and on earth. No God is there but Thee, the All-knowing, the All-Wise.”`,

  // Progressive transcription stages (simulating real-time speech recognition)
  progressiveStages: [
    { words: '“i beseech the, this very moment,', wordCount: 6, description: 'Below minimum threshold (< 8 words)' },
    { words: '“i beseech thee, this very moment, by the mysteries of', wordCount: 10, description: 'Just above minimum (10 words)' },
    { words: '“i beseech thee, this very moment, by the mysteries of thy book, and by the things', wordCount: 16, description: 'Good context for matching (16 words)' },
    { words: '“i beseech the, this very moment, by the mysteries of your book, and by the things hid in your knowledge, and by the pearls that', wordCount: 25, description: 'Excellent context (25 words)' },
    { words: '“i beseech thee, this very moment, by the mysteries of thy book, and by the things hid in thy knowledge, and by the pearls that lie concealed within the shells of the ocean of thy mercy, to reckon me among such as you didst mention', wordCount: 45, description: 'Full sliding window (45 words)' }
  ]
};

/**
 * Run the test with a given findBestMatch function
 */
export function runTest(findBestMatch, searchIndex) {
  console.log('=== Long Text - Epistle Mid-Paragraph ===\n');
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
