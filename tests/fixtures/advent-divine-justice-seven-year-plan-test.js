/**
 * Test Case: Advent of Divine Justice "When this second stage..." Matching
 *
 * Real-world test case where the UI displayed a 2023 UHJ message instead of
 * The Advent of Divine Justice, even though the matcher correctly identified
 * the right document.
 *
 * Root cause: Two-part bug:
 * 1. Initial false positive: First 8 words matched wrong document (20231128_001)
 *    with high score (0.56) due to coincidental common words
 * 2. Stickiness blocks correction: Even when matcher correctly identified
 *    advent-divine-justice (score 0.48-0.53), App.js stickiness logic
 *    prevented UI update because score diff (-0.08 to -0.03) was below
 *    threshold (0.15)
 *
 * Key insight: textMatcher.js works correctly - the bug is in App.js
 * stickiness logic that blocks UI updates when trying to correct initial
 * false positives.
 *
 * Expected behavior: UI should update to show advent-divine-justice once
 * distinctive vocabulary appears ("Seven Year Plan", "American believers")
 *
 * Run with: node tests/run-tests.mjs advent-divine-justice-seven-year-plan-test.js
 */

export const adventDivineJusticeTestCase = {
  // Actual transcribed text from Vosk (with noise/errors)
  transcribedText: `when this second stage in the progressive unfold augment of teaching activities and enterprises under the seven year plan is reached and the machinery required for it's prosecution begins to operate the american believers the stout hearted pioneers of this mighty movement must guided by the unfeeling light of the hello and in strict accordance with the plan laid out by abdullah and acting under the direction of their national spiritual assembly and in assured of the aid of the inter american committee launch an offensive against the powers of darkness of corruption and ignorance and offensive that must extend to the utmost end of the southern continent`,

  // Expected correct match
  expectedMatch: {
    docId: 'advent-divine-justice',
    section: 'The Advent of Divine Justice',
    // Exact paragraph number varies - match by content
    contentIncludes: 'When this second stage in the progressive unfoldment'
  },

  // Incorrect match that occurred
  incorrectMatch: {
    docId: '20231128_001',
    section: 'Main',
    paragraphNum: 60,
    reason: 'False positive on generic words "second", "stage", "progress"'
  },

  // Correct paragraph text for reference
  correctParagraphText: `When this second stage in the progressive unfoldment of teaching activities and enterprises, under the Seven Year Plan, is reached, and the machinery required for its prosecution begins to operate, the American believers, the stout-hearted pioneers of this mighty movement, must, guided by the unfailing light of Bahá'u'lláh, and in strict accordance with the Plan laid out by 'Abdu'l‑Bahá, and acting under the direction of their National Spiritual Assembly, and assured of the aid of the Inter-America Committee, launch an offensive against the powers of darkness, of corruption, and of ignorance, an offensive that must extend to the uttermost end of the Southern continent, and embrace within its scope each of the twenty nations that compose it.`,

  // Progressive transcription stages (simulating real-time speech recognition)
  progressiveStages: {
    stage1_initial_false_positive: {
      words: 'when this second stage in the progress of',
      wordCount: 8,
      description: 'Initial 8 words - incorrectly matched 20231128_001',
      actualMatch: '20231128_001',
      actualScore: 0.56,
      tokenScore: 1.00,  // 100% overlap on generic words
      ngramScore: 0.20,
      problem: 'Generic words produced high token overlap with wrong document'
    },
    stage2_should_correct: {
      words: 'when this second stage in the progressive and augment of teaching',
      wordCount: 11,
      description: 'Matcher correctly identifies advent-divine-justice, but UI does not update',
      matcherReturns: 'advent-divine-justice',  // ✅ Matcher works correctly
      matcherScore: 0.48,
      uiDisplays: '20231128_001',  // ❌ UI stuck on wrong document
      uiReason: 'App.js stickiness logic blocks update (return statement)',
      correctScore: 0.48,
      incorrectScore: 0.56,
      scoreDiff: -0.08,
      stickinessThreshold: 0.15,
      problem: 'Score diff (-0.08) below threshold (0.15), UI update blocked by return statement'
    },
    stage3_clear_evidence: {
      words: 'when this second stage in the progressive unfold augment of teaching activities and enterprises under the seven year',
      wordCount: 18,
      description: 'Matcher identifies advent-divine-justice with higher confidence, but UI still blocked',
      distinctiveWords: ['progressive', 'unfoldment', 'teaching', 'enterprises', 'seven year plan'],
      matcherReturns: 'advent-divine-justice',  // ✅ Matcher works correctly
      matcherScore: 0.53,
      uiDisplays: '20231128_001',  // ❌ UI still stuck
      uiReason: 'App.js stickiness logic still blocks update',
      correctScore: 0.53,
      incorrectScore: 0.56,
      scoreDiff: -0.03,
      problem: 'Even with distinctive words and higher score, stickiness threshold prevents UI update'
    }
  },

  // Analysis of why this failed
  failureAnalysis: {
    rootCause: 'Two-part bug: Initial false positive + stickiness blocks correction',

    bug1_initial_false_positive: {
      component: 'textMatcher.js scoring',
      issue: 'First 8 words matched wrong document with high score (0.56)',
      causes: [
        'Token overlap weighted 50% but does not distinguish common vs. distinctive words',
        'Words "second", "stage", "this", "the", "in" are too common to be distinctive',
        'Small sample size (8 words) insufficient to distinguish documents',
        'Coincidental word overlap: "second pattern" vs "second stage", "process" vs "progress"'
      ]
    },

    bug2_stickiness_blocks_correction: {
      component: 'App.js stickiness logic (lines 380-387)',
      issue: 'UI update blocked even when matcher correctly identifies right document',
      causes: [
        'Stickiness threshold (0.15) requires new score to be significantly higher',
        'return statement exits without updating UI when threshold not met',
        'Conflates two concerns: preventing noise jumps vs. correcting initial errors',
        'No special handling for early matches that might be false positives'
      ],
      evidence: [
        'At 11 words: matcher returns advent-divine-justice (0.48), UI stays on 20231128_001 (0.56)',
        'At 18 words: matcher returns advent-divine-justice (0.53), UI still stuck',
        'Would need score ≥ 0.71 to overcome stickiness (0.56 + 0.15 threshold)'
      ]
    },

    expectedBehavior: [
      'UI should update when matcher identifies correct document with distinctive vocabulary',
      'Stickiness should prevent noise jumps but allow correction of false positives',
      'Possible fixes:',
      '  1. Lower stickiness threshold for early matches (first 2-3 iterations)',
      '  2. Allow override when distinctive n-grams strongly favor new document',
      '  3. Require more words (12-15) for initial match to reduce false positives',
      '  4. Add "confidence" flag to matches; low confidence = easier to override'
    ]
  }
};

/**
 * Run the test with a given findBestMatch function
 *
 * NOTE: This test validates textMatcher.js behavior only.
 * The actual bug is in App.js stickiness logic that prevents UI updates
 * even when the matcher returns the correct document.
 *
 * To fully test the bug, you need to test both:
 * 1. textMatcher.js - does it return the correct document? (this test)
 * 2. App.js - does it update the UI when matcher returns correct document? (integration test needed)
 */
export function runAdventDivineJusticeTest(findBestMatch, searchIndex) {
  console.log('=== Advent of Divine Justice "Seven Year Plan" Matching Test ===\n');
  console.log('Expected:', adventDivineJusticeTestCase.expectedMatch);
  console.log('Incorrect match that occurred:', adventDivineJusticeTestCase.incorrectMatch);
  console.log('Total documents:', searchIndex.documents.length);
  console.log('\nNOTE: This tests textMatcher.js only. The UI bug is in App.js stickiness logic.\n');

  const results = [];
  let previousMatch = null;
  let context = {};

  // Test each progressive stage
  for (const [stageName, stage] of Object.entries(adventDivineJusticeTestCase.progressiveStages)) {
    const words = stage.words.split(/\s+/).filter(w => w.length > 0);

    console.log(`\n--- ${stageName}: ${stage.description} (${words.length} words) ---`);

    const match = findBestMatch(words, searchIndex, context);

    if (match) {
      console.log(`Matched: ${match.docId} (score: ${match.score.toFixed(3)}, token: ${match.tokenScore.toFixed(2)}, ngram: ${match.ngramScore.toFixed(2)})`);
      console.log(`Section: ${match.section}, Paragraph: ${match.paragraphNum}`);

      // Check if correct
      const isCorrect = match.docId === adventDivineJusticeTestCase.expectedMatch.docId;
      console.log(`Result: ${isCorrect ? '✅ CORRECT' : '❌ WRONG'}`);

      if (!isCorrect) {
        console.log(`Expected: ${adventDivineJusticeTestCase.expectedMatch.docId}`);
        console.log(`Problem: ${stage.problem || 'Unknown'}`);
      }

      // Update context for next iteration (simulate real app behavior)
      context = {
        previousDocId: match.docId,
        previousSection: match.section,
        previousParagraphNum: match.paragraphNum,
        previousScore: match.score
      };

      results.push({ stage: stageName, match, isCorrect });
    } else {
      console.log('No match found (score below threshold)');
      results.push({ stage: stageName, match: null, isCorrect: false });
    }
  }

  // Summary
  console.log('\n=== Test Summary ===');
  const correctCount = results.filter(r => r.isCorrect).length;
  const totalStages = results.length;
  console.log(`Correct: ${correctCount}/${totalStages}`);

  if (correctCount === totalStages) {
    console.log('✅ ALL STAGES PASSED');
  } else {
    console.log('❌ SOME STAGES FAILED');
    console.log('\nFailed stages:');
    results.filter(r => !r.isCorrect).forEach(r => {
      console.log(`  - ${r.stage}: ${r.match ? `matched ${r.match.docId}` : 'no match'}`);
    });
  }

  return results;
}

/**
 * Expected test results for textMatcher.js (this test):
 *
 * BEFORE fix to textMatcher.js:
 * - Stage 1 (8 words): Returns 20231128_001 (wrong) - false positive on generic words
 * - Stage 2 (11 words): Returns advent-divine-justice (correct!) - matcher works
 * - Stage 3 (18 words): Returns advent-divine-justice (correct!) - matcher works
 *
 * AFTER fix to textMatcher.js (reduce false positives):
 * - Stage 1 (8 words): Either no match (require more words) OR correct match
 * - Stage 2 (11 words): Returns advent-divine-justice (correct)
 * - Stage 3 (18 words): Returns advent-divine-justice (correct)
 *
 * Expected behavior for App.js UI updates (requires integration test):
 *
 * BEFORE fix to App.js stickiness:
 * - Stage 1 (8 words): UI shows 20231128_001 (matcher returned this)
 * - Stage 2 (11 words): UI still shows 20231128_001 (matcher returned advent-divine-justice, but App.js blocked update)
 * - Stage 3 (18 words): UI still shows 20231128_001 (matcher returned advent-divine-justice, but App.js blocked update)
 *
 * AFTER fix to App.js stickiness (allow correction of false positives):
 * - Stage 1 (8 words): UI shows whatever matcher returns
 * - Stage 2 (11 words): UI updates to advent-divine-justice (distinctive words overcome stickiness)
 * - Stage 3 (18 words): UI shows advent-divine-justice
 */
