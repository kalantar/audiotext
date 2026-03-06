/**
 * Tests that findBestMatch uses tokenIndex when available and falls back
 * to linear scan when absent.
 * Run with: node tests/inverted-index-match-test.mjs
 */

import { findBestMatch } from '../utils/textMatcher.js';

const indexWithTokenIndex = {
  documents: [
    {
      id: 'doc-0',
      docId: 'kitab-i-aqdas',
      section: 'Main',
      paragraphNum: 1,
      preview: 'The first duty...',
      tokens: ['duty', 'prescribed', 'recognized', 'manifestation'],
      ngrams: ['first duty prescribed', 'duty prescribed unto', 'prescribed unto recognized']
    },
    {
      id: 'doc-1',
      docId: 'hidden-words',
      section: 'Main',
      paragraphNum: 1,
      preview: 'O Son of Spirit...',
      tokens: ['spirit', 'noble', 'good', 'deed'],
      ngrams: ['son of spirit', 'of spirit noble', 'spirit noble good']
    }
  ],
  metadata: {
    'kitab-i-aqdas': { title: 'Kitáb-i-Aqdas', author: "Bahá'u'lláh", url: 'https://bahai.org' },
    'hidden-words': { title: 'Hidden Words', author: "Bahá'u'lláh", url: 'https://bahai.org' }
  },
  tokenIndex: {
    'duty': [0],
    'mani': [0],
    'spir': [1],
  }
};

const indexWithoutTokenIndex = {
  documents: indexWithTokenIndex.documents,
  metadata: indexWithTokenIndex.metadata
};

let passed = true;

const words1 = 'duty prescribed unto thee recognized manifestation god glorious day'.split(' ');
const match1 = findBestMatch(words1, indexWithTokenIndex);
if (!match1 || match1.docId !== 'kitab-i-aqdas') {
  console.error('FAIL Test 1: expected kitab-i-aqdas, got:', match1?.docId);
  passed = false;
} else {
  console.log('PASS Test 1: tokenIndex path finds correct document');
}

const match2 = findBestMatch(words1, indexWithoutTokenIndex);
if (!match2 || match2.docId !== 'kitab-i-aqdas') {
  console.error('FAIL Test 2: fallback linear scan should find kitab-i-aqdas, got:', match2?.docId);
  passed = false;
} else {
  console.log('PASS Test 2: fallback linear scan finds correct document');
}

const words3 = 'son spirit noble good deeds righteous path light divine'.split(' ');
const match3 = findBestMatch(words3, indexWithTokenIndex);
if (!match3 || match3.docId !== 'hidden-words') {
  console.error('FAIL Test 3: expected hidden-words, got:', match3?.docId);
  passed = false;
} else {
  console.log('PASS Test 3: tokenIndex path finds hidden-words');
}

console.log(passed ? '\nAll tests passed.' : '\nSome tests FAILED.');
process.exit(passed ? 0 : 1);
