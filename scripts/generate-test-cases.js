#!/usr/bin/env node
/**
 * Test Case Generator
 *
 * Generates synthetic test cases from the corpus and recommends passages
 * for real transcription testing.
 *
 * Usage: node scripts/generate-test-cases.js
 */

const fs = require('fs');
const path = require('path');

// Load search index
const searchIndexPath = path.join(__dirname, '../public/search-index.json');
const searchIndex = JSON.parse(fs.readFileSync(searchIndexPath, 'utf8'));

// Load document metadata
const metadataCache = {};

function loadDocumentText(docId) {
  if (metadataCache[docId]) return metadataCache[docId];

  try {
    const docPath = path.join(__dirname, `../public/texts/${docId}.json`);
    const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));
    metadataCache[docId] = doc;
    return doc;
  } catch (err) {
    console.error(`Failed to load ${docId}:`, err.message);
    return null;
  }
}

function findParagraphText(docId, paragraphNum, sectionTitle = null) {
  const doc = loadDocumentText(docId);
  if (!doc) return null;

  // Find the matching entry in search index to get section
  const indexEntry = searchIndex.documents.find(d =>
    d.docId === docId && d.paragraphNum === paragraphNum &&
    (!sectionTitle || d.section === sectionTitle)
  );

  if (!indexEntry) {
    console.error(`Could not find index entry for ${docId} paragraph ${paragraphNum}`);
    return null;
  }

  // Find the matching section in the document
  for (const section of doc.sections || []) {
    if (section.title === indexEntry.section) {
      // paragraphNum is 1-indexed, array is 0-indexed
      const paraIndex = paragraphNum - 1;
      if (paraIndex >= 0 && paraIndex < section.paragraphs.length) {
        return section.paragraphs[paraIndex];
      }
    }
  }

  console.error(`Could not find paragraph ${paragraphNum} in section "${indexEntry.section}" of ${docId}`);
  return null;
}

function addSyntheticNoise(text) {
  // Common speech-to-text errors in religious texts
  const substitutions = [
    [/\bthee\b/g, 'the'],
    [/\bthou\b/g, 'you'],
    [/\bhath\b/g, 'has'],
    [/\bdoth\b/g, 'does'],
    [/\bthy\b/g, 'your'],
    [/\bthine\b/g, 'your'],
    [/\byea\b/g, 'yeah'],
    [/\bverily\b/g, 'very'],
    [/\bbahá'u'lláh\b/gi, 'bahaullah'],
    [/\b'\b/g, ''], // Remove apostrophes
  ];

  let noisy = text.toLowerCase();

  // Apply random substitutions (50% chance for each)
  for (const [pattern, replacement] of substitutions) {
    if (Math.random() > 0.5) {
      noisy = noisy.replace(pattern, replacement);
    }
  }

  return noisy;
}

function generateProgressiveStages(text, includeNoise = false) {
  const words = text.split(/\s+/);
  const stages = [];

  // Stage 1: Below minimum (6 words)
  if (words.length > 6) {
    const snippet = words.slice(0, 6).join(' ');
    stages.push({
      words: includeNoise ? addSyntheticNoise(snippet) : snippet,
      wordCount: 6,
      description: 'Below minimum threshold (< 8 words)'
    });
  }

  // Stage 2: Just above minimum (10 words)
  if (words.length > 10) {
    const snippet = words.slice(0, 10).join(' ');
    stages.push({
      words: includeNoise ? addSyntheticNoise(snippet) : snippet,
      wordCount: 10,
      description: 'Just above minimum (10 words)'
    });
  }

  // Stage 3: Good context (16 words)
  if (words.length > 16) {
    const snippet = words.slice(0, 16).join(' ');
    stages.push({
      words: includeNoise ? addSyntheticNoise(snippet) : snippet,
      wordCount: 16,
      description: 'Good context for matching (16 words)'
    });
  }

  // Stage 4: Excellent context (25 words)
  if (words.length > 25) {
    const snippet = words.slice(0, 25).join(' ');
    stages.push({
      words: includeNoise ? addSyntheticNoise(snippet) : snippet,
      wordCount: 25,
      description: 'Excellent context (25 words)'
    });
  }

  // Stage 5: Full sliding window (45 words)
  if (words.length > 45) {
    const snippet = words.slice(0, 45).join(' ');
    stages.push({
      words: includeNoise ? addSyntheticNoise(snippet) : snippet,
      wordCount: 45,
      description: 'Full sliding window (45 words)'
    });
  }

  return stages;
}

function generateTestCase(docId, section, paragraphNum, testName, includeNoise = false) {
  const fullText = findParagraphText(docId, paragraphNum, section);
  if (!fullText) {
    console.error(`Could not find paragraph ${paragraphNum} in section "${section}" of ${docId}`);
    return null;
  }

  const stages = generateProgressiveStages(fullText, includeNoise);

  return {
    testName,
    transcribedText: includeNoise ? addSyntheticNoise(fullText) : fullText.toLowerCase(),
    expectedMatch: {
      docId,
      section,
      paragraphNum
    },
    correctParagraphText: fullText,
    progressiveStages: stages,
    hasNoise: includeNoise
  };
}

function writeTestFile(testCase, filename) {
  const template = `/**
 * Test Case: ${testCase.testName}
 *
 * ${testCase.hasNoise ? 'Synthetic test with added noise to simulate speech-to-text errors.' : 'Synthetic test with clean text.'}
 * Expected to match: ${testCase.expectedMatch.docId} paragraph ${testCase.expectedMatch.paragraphNum}
 *
 * Run with: npm start, then in browser console:
 * import { runTest } from './tests/${filename}';
 * runTest(findBestMatch, searchIndex);
 */

export const testCase = {
  // ${testCase.hasNoise ? 'Noisy' : 'Clean'} transcribed text
  transcribedText: \`${testCase.transcribedText}\`,

  // Expected correct match
  expectedMatch: {
    docId: '${testCase.expectedMatch.docId}',
    section: '${testCase.expectedMatch.section}',
    paragraphNum: ${testCase.expectedMatch.paragraphNum}
  },

  // Actual paragraph text for reference
  correctParagraphText: \`${testCase.correctParagraphText}\`,

  // Progressive transcription stages (simulating real-time speech recognition)
  progressiveStages: [
${testCase.progressiveStages.map(stage => `    { words: '${stage.words}', wordCount: ${stage.wordCount}, description: '${stage.description}' }`).join(',\n')}
  ]
};

/**
 * Run the test with a given findBestMatch function
 */
export function runTest(findBestMatch, searchIndex) {
  console.log('=== ${testCase.testName} ===\\n');
  console.log('Expected:', testCase.expectedMatch);
  console.log('Has synthetic noise:', ${testCase.hasNoise});
  console.log('\\n');

  const results = [];
  let previousMatch = null;

  // Test each progressive stage
  for (const stage of testCase.progressiveStages) {
    const words = stage.words.split(/\\s+/).filter(w => w.length > 0);

    console.log(\`\\n--- \${stage.description} (\${words.length} words) ---\`);

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

      console.log(\`Match: \${match.docId} p\${match.paragraphNum}, score: \${match.score.toFixed(3)}\`);
      console.log(\`Result: \${isCorrect ? '✓ CORRECT' : '✗ WRONG (expected ' + testCase.expectedMatch.docId + ' p' + testCase.expectedMatch.paragraphNum + ')'}\`);

      results.push({
        words: words.length,
        match: \`\${match.docId} p\${match.paragraphNum}\`,
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
  console.log('\\n=== Summary ===');
  console.table(results);

  const correctCount = results.filter(r => r.correct === '✓' || r.correct === '✓ (expected)').length;
  console.log(\`\\nSuccess Rate: \${correctCount}/\${results.length} (\${(correctCount / results.length * 100).toFixed(1)}%)\`);

  return {
    results,
    correctCount,
    totalCount: results.length,
    successRate: correctCount / results.length
  };
}
`;

  const outputPath = path.join(__dirname, `../tests/${filename}`);
  fs.writeFileSync(outputPath, template, 'utf8');
  console.log(`✓ Generated: tests/${filename}`);
}

// ============================================================
// SYNTHETIC TEST CASES
// ============================================================

console.log('Generating synthetic test cases...\n');

const syntheticTests = [
  {
    docId: 'kitab-i-iqan',
    section: 'Part One',
    paragraphNum: 8,
    testName: 'Unique Text - Kitáb-i-Íqán Noah Story',
    includeNoise: false
  },
  {
    docId: 'hidden-words',
    section: 'From the Arabic',
    paragraphNum: 3,
    testName: 'Common Phrase - "O Son of..." (Arabic #1)',
    includeNoise: false
  },
  {
    docId: 'epistle-son-wolf',
    section: 'Epistle to the Son of the Wolf',
    paragraphNum: 10,
    testName: 'Long Text - Epistle Mid-Paragraph',
    includeNoise: true
  },
  {
    docId: 'prayers-meditations',
    section: 'Prayers and Meditations',
    paragraphNum: 3,
    testName: 'Short Prayer with Noise',
    includeNoise: true
  }
];

for (const test of syntheticTests) {
  const testCase = generateTestCase(
    test.docId,
    test.section,
    test.paragraphNum,
    test.testName,
    test.includeNoise
  );

  if (testCase) {
    const filename = test.testName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-test.js';
    writeTestFile(testCase, filename);
  }
}

// ============================================================
// RECOMMENDED PASSAGES FOR REAL TRANSCRIPTION
// ============================================================

console.log('\n\n' + '='.repeat(70));
console.log('RECOMMENDED PASSAGES FOR REAL TRANSCRIPTION TESTING');
console.log('='.repeat(70) + '\n');

const recommendations = [
  {
    priority: 1,
    docId: 'gems-divine-mysteries',
    paragraphNum: 67,
    section: 'Gems of Divine Mysteries',
    reason: 'ALREADY FAILED - Fix validation',
    text: findParagraphText('gems-divine-mysteries', 67, 'Gems of Divine Mysteries')
  },
  {
    priority: 2,
    docId: 'hidden-words',
    paragraphNum: 3,
    section: 'From the Arabic',
    reason: 'Very common opening "O Son of Spirit!" - tests disambiguation (Arabic #1)',
    text: findParagraphText('hidden-words', 3, 'From the Arabic')
  },
  {
    priority: 3,
    docId: 'hidden-words',
    paragraphNum: 3,
    section: 'From the Persian',
    reason: 'Another "O Son of..." - different section, tests section handling (Persian #1)',
    text: findParagraphText('hidden-words', 3, 'From the Persian')
  },
  {
    priority: 4,
    docId: 'kitab-i-aqdas',
    paragraphNum: 1,
    section: 'Kitáb-i-Aqdas',
    reason: "Most important Bahá'í text - likely to be read often",
    text: findParagraphText('kitab-i-aqdas', 1, 'Kitáb-i-Aqdas')
  },
  {
    priority: 5,
    docId: 'kitab-i-iqan',
    paragraphNum: 2,
    section: 'Part One',
    reason: 'Unique distinctive opening, long philosophical text',
    text: findParagraphText('kitab-i-iqan', 2, 'Part One')
  },
  {
    priority: 6,
    docId: 'gleanings-writings-bahaullah',
    paragraphNum: 1,
    section: 'I',
    reason: 'Very long passage, tests 45-word sliding window',
    text: findParagraphText('gleanings-writings-bahaullah', 1, 'I')
  },
  {
    priority: 7,
    docId: 'prayers-meditations',
    paragraphNum: 2,
    section: 'I',
    reason: 'Short devotional prayer - tests minimum word threshold',
    text: findParagraphText('prayers-meditations', 2, 'I')
  },
  {
    priority: 8,
    docId: 'call-divine-beloved',
    paragraphNum: 2,
    section: 'Introduction',
    reason: 'KNOWN FALSE MATCH - Was incorrectly matched instead of gems-divine-mysteries p67',
    text: findParagraphText('call-divine-beloved', 2, 'Introduction')
  },
  {
    priority: 9,
    docId: 'epistle-son-wolf',
    paragraphNum: 50,
    section: 'Epistle to the Son of the Wolf',
    reason: 'Mid-document paragraph, tests temporal continuity from p48-49-50-51',
    text: findParagraphText('epistle-son-wolf', 50, 'Epistle to the Son of the Wolf')
  },
  {
    priority: 10,
    docId: 'kitab-i-aqdas',
    paragraphNum: 10,
    section: 'Kitáb-i-Aqdas',
    reason: 'Mid-paragraph in most important text, tests temporal continuity',
    text: findParagraphText('kitab-i-aqdas', 10, 'Kitáb-i-Aqdas')
  }
];

recommendations.forEach((rec, idx) => {
  console.log(`${idx + 1}. [Priority ${rec.priority}] ${rec.section} - Paragraph ${rec.paragraphNum}`);
  console.log(`   Document ID: ${rec.docId}`);
  console.log(`   Why: ${rec.reason}`);

  // Try to get preview from search index
  const indexEntry = searchIndex.documents.find(d =>
    d.docId === rec.docId &&
    d.paragraphNum === rec.paragraphNum &&
    d.section === rec.section
  );

  if (indexEntry && indexEntry.preview) {
    console.log(`   Preview: "${indexEntry.preview.substring(0, 120)}${indexEntry.preview.length > 120 ? '...' : ''}"`);
  }
  console.log('');
});

console.log('\nHow to use these recommendations:');
console.log('1. Open the app and start reading one of these passages aloud');
console.log('2. Watch the console logs for match results');
console.log('3. Copy the transcribed text and match logs');
console.log('4. Create a new test case file using paragraph-67-test.js as a template');
console.log('5. Share interesting failures or edge cases for further optimization\n');
