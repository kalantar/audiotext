# Test Cases for Text Matching Algorithm

This directory contains test cases for validating the text matching algorithm used in FollowAlong.

## Test Strategy: Hybrid Approach

We use a **hybrid testing strategy** combining synthetic generated tests with real-world transcription tests:

### 1. Synthetic Tests (Generated)

Automatically generated test cases from the corpus with progressive word stages:
- **`unique-opener-kitab-i-iqan-part-one-opening-test.js`** - Unique distinctive text that should match quickly
- **`common-phrase-o-son-of-arabic-1-test.js`** - Common phrase testing disambiguation
- **`long-text-gleanings-selection-i-test.js`** - Long passage with synthetic noise
- **`short-prayer-with-noise-test.js`** - Short prayer with speech-to-text errors

Generated using: `node scripts/generate-test-cases.js`

### 2. Real Transcription Tests

Test cases created from actual speech-to-text failures and edge cases:
- **`paragraph-67-test.js`** - Real-world failure case (short phrase early lock-in)

## Creating New Test Cases

### From Real Transcription

1. Open the app and read a passage aloud
2. Watch console logs for match results
3. Copy the transcribed text and logs
4. Create new test file using `paragraph-67-test.js` as template
5. Export `testCase` object and `runTest` function

### Generate Synthetic Tests

Run the test generator:
```bash
node scripts/generate-test-cases.js
```

This will:
- Generate 4 synthetic test cases
- Output 10 recommended passages for real transcription testing

## Running Tests

Tests are designed to run in the browser console alongside the app:

```javascript
import { runTest } from './tests/<test-name>.js';
import { findBestMatch } from './utils/textMatcher.js';

// After search index loads
runTest(findBestMatch, searchIndex);
```

## Recommended Passages for Real Transcription

Priority passages to test as you use the app:

| Priority | Document | Section | Para | Why |
|----------|----------|---------|------|-----|
| 1 | gems-divine-mysteries | Gems of Divine Mysteries | 67 | Already failed - validation needed |
| 2 | hidden-words | From the Arabic | 3 | Common "O Son of..." phrase - disambiguation |
| 3 | hidden-words | From the Persian | 3 | Another "O Son of..." - section handling |
| 4 | kitab-i-aqdas | Kitáb-i-Aqdas | 1 | Most important text |
| 5 | kitab-i-iqan | Part One | 2 | Unique opener, long text |
| 6 | gleanings-writings-bahaullah | I | 1 | Very long - 45-word window test |
| 7 | prayers-meditations | I | 2 | Short prayer - minimum threshold |
| 8 | call-divine-beloved | Introduction | 2 | Known false match case |
| 9 | epistle-son-wolf | Epistle to the Son of the Wolf | 50 | Temporal continuity test |
| 10 | kitab-i-aqdas | Kitáb-i-Aqdas | 10 | Mid-document continuity |

## Test Coverage Goals

- ✅ Unique openers
- ✅ Common phrases requiring disambiguation
- ✅ Long passages (45+ words)
- ✅ Short passages (< 15 words)
- ✅ Noisy transcription with errors
- ✅ Early lock-in prevention (8+ word minimum)
- ⏳ Sequential paragraph progression
- ⏳ Document switching
- ⏳ Near-duplicate text across documents

## Test File Format

Each test file should export:

```javascript
export const testCase = {
  transcribedText: '...',
  expectedMatch: { docId, section, paragraphNum },
  correctParagraphText: '...',
  progressiveStages: [
    { words: '...', wordCount: N, description: '...' }
  ]
};

export function runTest(findBestMatch, searchIndex) {
  // Test implementation
}
```

## Success Metrics

- Correct match on 14+ words: > 95%
- Correct match on 25+ words: > 99%
- No match on < 8 words: 100%
- No false matches from early lock-in
- Sequential continuity bonus working correctly
