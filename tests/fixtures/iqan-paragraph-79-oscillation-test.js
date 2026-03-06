/**
 * Test Case: Kitáb-i-Íqán Part Two Paragraph 79 — Sliding Window Oscillation
 *
 * Real-world bug: while reading paragraph 79, the sliding window near the p79/p80
 * boundary temporarily matched paragraph 80 (boosted by temporal continuity), then
 * correctly re-locked to paragraph 79. App.js treated the p80→p79 correction as a
 * "non-sequential jump" and reset the highlight start — unhighlighting the first
 * paragraph. Fixed by treating a one-paragraph backward correction as a valid progression.
 *
 * The same text appears in bahai-sacred-writings (p154 = kitab-i-iqan p79,
 * p155 = kitab-i-iqan p80), so those are also valid matches.
 *
 * Run with: npm run test:matching
 * Or: node tests/matching/run-tests.mjs ../fixtures/iqan-paragraph-79-oscillation-test.js
 */

export const testCase = {
  transcribedText: `o my beloved immeasurably exalted is the celestial melody above the strivings of human ear to hear or mind to grasp its mystery how can the helpless ant step into the court of the all glorious and yet feeble souls through lack of understanding reject these abstruse utterances`,

  expectedMatch: {
    docId: 'kitab-i-iqan',
    section: 'Part Two',
    paragraphNum: 79
  },

  // bahai-sacred-writings contains verbatim selections from the Íqán:
  //   p154 = kitab-i-iqan p79 ("O my beloved! Immeasurably exalted...")
  //   p155 = kitab-i-iqan p80 ("How strange! These people...")
  // Both are valid matches. Oscillation between p79/p80 (or p154/p155) near the
  // paragraph boundary is expected — the bug was App.js resetting the highlight.
  acceptableMatches: [
    { docId: 'kitab-i-iqan', paragraphNum: 79 },
    { docId: 'kitab-i-iqan', paragraphNum: 80 },
    { docId: 'bahai-sacred-writings', paragraphNum: 154 },  // same text as p79
    { docId: 'bahai-sacred-writings', paragraphNum: 155 },  // same text as p80
  ],

  correctParagraphText: `O my beloved! Immeasurably exalted is the celestial Melody above the strivings of human ear to hear or mind to grasp its mystery! How can the helpless ant step into the court of the All-Glorious? And yet, feeble souls, through lack of understanding, reject these abstruse utterances, and question the truth of such traditions. Nay, none can comprehend them save those that are possessed of an understanding heart. Say, He is that End for Whom no end in all the universe can be imagined, and for Whom no beginning in the world of creation can be conceived. Behold, O concourse of the earth, the splendors of the End, revealed in the Manifestations of the Beginning!`,

  // 45-word sliding windows at different positions as the reader progresses through p79.
  // Stages 3-6 simulate the sliding window moving forward through the paragraph.
  // Stage 5 is the p79→p80 transition that triggered the original oscillation bug.
  progressiveStages: [
    {
      words: 'o my beloved immeasurably exalted is',
      wordCount: 6,
      description: 'Below minimum threshold (< 8 words)'
    },
    {
      words: 'o my beloved immeasurably exalted is the celestial melody above the strivings of human ear',
      wordCount: 15,
      description: 'Start of p79 — should match p79 / bahai-sacred-writings p154 (15 words)'
    },
    {
      // 45-word window: early in p79
      words: 'o my beloved immeasurably exalted is the celestial melody above the strivings of human ear to hear or mind to grasp its mystery how can the helpless ant step into the court of the all glorious and yet feeble souls through lack of understanding reject these',
      wordCount: 45,
      description: 'Sliding window early in p79 (45 words)'
    },
    {
      // 45-word window: mid p79
      words: 'ear to hear or mind to grasp its mystery how can the helpless ant step into the court of the all glorious and yet feeble souls through lack of understanding reject these abstruse utterances and question the truth of such traditions nay none can comprehend them save',
      wordCount: 45,
      description: 'Sliding window mid p79 (45 words)'
    },
    {
      // 45-word window: p79/p80 transition — contains end of p79 + start of p80.
      // This is the window that triggered the bug: temporal continuity boosts p80,
      // so the match may be p80/p155. Both p79 and p80 (and their bahai-sacred-writings
      // equivalents) are acceptable here.
      words: 'nay none can comprehend them save those that are possessed of an understanding heart say he is that end for whom no end in all the universe can be imagined how strange these people with one hand cling to those verses of the quran and those traditions',
      wordCount: 45,
      description: 'Sliding window at p79/p80 boundary — p79 or p80 acceptable'
    },
    {
      // 45-word window: back in solid p79 territory. With previous context of p80/p155,
      // this window should re-lock to p79/p154 without treating it as a jump.
      words: 'o my beloved immeasurably exalted is the celestial melody above the strivings of human ear to hear or mind to grasp its mystery how can the helpless ant step into the court of the all glorious and yet feeble souls through lack of understanding reject these',
      wordCount: 45,
      description: 'Back in p79 — re-lock should preserve highlight start (not reset)'
    },
  ]
};
