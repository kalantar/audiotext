# Text Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users search for a specific passage by typing a phrase, then display it in the reading surface.

**Architecture:** A new `searchQuery.js` utility runs keyword search over the existing `search-index.json` tokenIndex. A new `SearchModal` component renders a full-screen Portal modal with a search bar and results list. Selecting a result calls `fetchDocumentContent` and sets `matchState` via the same path used by speech matching — the reading surface (`MatchedTextWidget`) is untouched.

**Tech Stack:** React Native, react-native-paper (`Searchbar`, `List.Item`, `Modal`, `Portal`), existing `tokenIndex` in `search-index.json`, existing `tokenize` and `findHighlightPosition` exports from `utils/textMatcher.js`.

---

## Task 1: `utils/searchQuery.js` — keyword search algorithm (TDD)

**Files:**
- Create: `tests/ui/searchQuery.test.js`
- Create: `utils/searchQuery.js`

The module exports one function: `searchPassages(query, searchIndex)` which returns up to 15 ranked result objects.

Each result object:
```js
{
  docId,        // string — document id
  section,      // string — section name
  paragraphNum, // number — 1-indexed paragraph number
  score,        // number — ranking score
  snippet,      // string — ~80 char preview centred on first matching token
  title,        // string — from searchIndex.metadata
  author,       // string — from searchIndex.metadata
  url,          // string — from searchIndex.metadata
}
```

---

### Step 1: Write the failing tests

Create `tests/ui/searchQuery.test.js`:

```js
import { searchPassages } from '../../utils/searchQuery';

// Minimal mock index with 3 paragraphs
const mockIndex = {
  documents: [
    {
      docId: 'doc1', section: 'Chapter 1', paragraphNum: 2,
      preview: 'Verily the spirit of faith hath been breathed into the world',
      tokens: ['verily', 'spirit', 'faith', 'breathed'],
      ngrams: [
        'verily the spirit', 'the spirit of', 'spirit of faith',
        'of faith hath', 'faith hath been',
        'verily the spirit of', 'the spirit of faith', 'spirit of faith hath', 'of faith hath been',
        'verily the spirit of faith', 'the spirit of faith hath', 'spirit of faith hath been',
      ],
    },
    {
      docId: 'doc2', section: 'Main', paragraphNum: 3,
      preview: 'The love of God is manifest throughout creation',
      tokens: ['love', 'manifest', 'creation'],
      ngrams: [
        'the love of', 'love of god', 'of god is',
        'the love of god', 'love of god is', 'of god is manifest',
        'the love of god is', 'love of god is manifest',
      ],
    },
    {
      docId: 'doc3', section: 'Introduction', paragraphNum: 1,
      preview: 'Justice and equity shall prevail among all peoples',
      tokens: ['justice', 'equity', 'prevail', 'peoples'],
      ngrams: [
        'justice and equity', 'and equity shall', 'equity shall prevail',
        'justice and equity shall', 'and equity shall prevail',
        'justice and equity shall prevail',
      ],
    },
  ],
  metadata: {
    doc1: { title: 'Book One', author: 'Author A', url: 'https://example.com/1' },
    doc2: { title: 'Book Two', author: 'Author B', url: 'https://example.com/2' },
    doc3: { title: 'Book Three', author: 'Author C', url: 'https://example.com/3' },
  },
  tokenIndex: {
    'veri': [0], 'spir': [0], 'fait': [0], 'brea': [0],
    'love': [1], 'mani': [1], 'crea': [1],
    'just': [2], 'equi': [2], 'prev': [2], 'peop': [2],
  },
};

describe('searchPassages', () => {
  test('returns empty array for empty query', () => {
    expect(searchPassages('', mockIndex)).toEqual([]);
  });

  test('returns empty array when query has no tokens >= 3 chars', () => {
    expect(searchPassages('ab cd', mockIndex)).toEqual([]);
  });

  test('returns empty array when searchIndex is null', () => {
    expect(searchPassages('faith', null)).toEqual([]);
  });

  test('returns empty array when searchIndex has no tokenIndex', () => {
    expect(searchPassages('faith', { documents: [], metadata: {} })).toEqual([]);
  });

  test('finds passage by single keyword', () => {
    const results = searchPassages('spirit', mockIndex);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].docId).toBe('doc1');
  });

  test('includes title, author, url from metadata', () => {
    const results = searchPassages('spirit', mockIndex);
    expect(results[0].title).toBe('Book One');
    expect(results[0].author).toBe('Author A');
    expect(results[0].url).toBe('https://example.com/1');
  });

  test('includes docId, section, paragraphNum in result', () => {
    const results = searchPassages('spirit faith', mockIndex);
    expect(results[0].docId).toBe('doc1');
    expect(results[0].section).toBe('Chapter 1');
    expect(results[0].paragraphNum).toBe(2);
  });

  test('phrase match scores higher than single token match', () => {
    const results = searchPassages('spirit of faith', mockIndex);
    const doc1 = results.find(r => r.docId === 'doc1');
    const doc2 = results.find(r => r.docId === 'doc2');
    expect(doc1).toBeTruthy();
    // doc1 matches the phrase "spirit of faith"; doc2 does not — doc1 should rank higher
    if (doc2) expect(doc1.score).toBeGreaterThan(doc2.score);
  });

  test('returns at most 15 results', () => {
    const bigIndex = {
      documents: Array.from({ length: 20 }, (_, i) => ({
        docId: `doc${i}`, section: 'Main', paragraphNum: 1,
        preview: 'faith and justice among peoples',
        tokens: ['faith', 'justice'],
        ngrams: [],
      })),
      metadata: Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`doc${i}`, { title: `Book ${i}`, author: '', url: '' }])
      ),
      tokenIndex: { fait: Array.from({ length: 20 }, (_, i) => i) },
    };
    const results = searchPassages('faith', bigIndex);
    expect(results.length).toBeLessThanOrEqual(15);
  });

  test('snippet is a non-empty string', () => {
    const results = searchPassages('spirit', mockIndex);
    expect(typeof results[0].snippet).toBe('string');
    expect(results[0].snippet.length).toBeGreaterThan(0);
  });

  test('snippet contains text near the matched token', () => {
    const results = searchPassages('spirit', mockIndex);
    // preview contains "spirit" — snippet should include surrounding text
    expect(results[0].snippet.toLowerCase()).toMatch(/spirit/);
  });
});
```

### Step 2: Run tests to confirm they fail

```bash
npm test -- --testPathPattern=searchQuery
```

Expected: FAIL — `Cannot find module '../../utils/searchQuery'`

### Step 3: Implement `utils/searchQuery.js`

```js
import { tokenize } from './textMatcher';

const PREFIX_LENGTH = 4;
const MAX_RESULTS = 15;

/**
 * Search the index for passages matching the query.
 * Returns up to MAX_RESULTS results ranked by relevance.
 *
 * Algorithm:
 * 1. Tokenize query (reuses textMatcher's tokenize — removes stop words, < 3 char words)
 * 2. Look up each token prefix in tokenIndex → candidate paragraph indices
 * 3. Score each candidate: token overlap + phrase bonus for ngram matches
 * 4. Return top MAX_RESULTS sorted by score
 */
export function searchPassages(query, searchIndex) {
  if (!searchIndex?.tokenIndex || !query) return [];

  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  // Candidate retrieval via tokenIndex (same prefix lookup as findBestMatch)
  const candidateCounts = new Map();
  for (const token of tokens) {
    if (token.length >= PREFIX_LENGTH) {
      const prefix = token.substring(0, PREFIX_LENGTH);
      const list = searchIndex.tokenIndex[prefix];
      if (list) {
        for (const i of list) {
          candidateCounts.set(i, (candidateCounts.get(i) || 0) + 1);
        }
      }
    }
  }

  if (candidateCounts.size === 0) return [];

  const results = [];
  for (const [i] of candidateCounts) {
    const doc = searchIndex.documents[i];
    if (!doc) continue;

    // Token overlap: fraction of query tokens present in doc tokens
    const exactHits = tokens.filter(t => doc.tokens.includes(t)).length;
    const tokenScore = exactHits / tokens.length;

    // Phrase bonus: any query ngram (3+ tokens) fully contained in a doc ngram
    const queryPhrase = tokens.join(' ');
    const phraseBonus = doc.ngrams.some(ng => ng.includes(queryPhrase)) ? 0.5 : 0;

    const score = tokenScore + phraseBonus;
    if (score <= 0) continue;

    const meta = searchIndex.metadata?.[doc.docId] || {};
    results.push({
      docId: doc.docId,
      section: doc.section,
      paragraphNum: doc.paragraphNum,
      score,
      snippet: buildSnippet(doc.preview, tokens),
      title: meta.title || doc.docId,
      author: meta.author || '',
      url: meta.url || '',
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}

/**
 * Build an ~80-char snippet from the paragraph preview centred on the first
 * matched token. Falls back to the start of the preview if no token is found.
 */
function buildSnippet(preview, tokens) {
  if (!preview) return '';
  const lower = preview.toLowerCase();
  for (const token of tokens) {
    const idx = lower.indexOf(token);
    if (idx !== -1) {
      const start = Math.max(0, idx - 30);
      const end = Math.min(preview.length, idx + 50);
      return (start > 0 ? '…' : '') + preview.substring(start, end) + (end < preview.length ? '…' : '');
    }
  }
  return preview.substring(0, 80) + (preview.length > 80 ? '…' : '');
}
```

### Step 4: Run tests to confirm they pass

```bash
npm test -- --testPathPattern=searchQuery
```

Expected: all tests PASS.

### Step 5: Run full suite to confirm no regressions

```bash
npm test
```

Expected: 49 + new tests all PASS.

### Step 6: Commit

```bash
git add utils/searchQuery.js tests/ui/searchQuery.test.js
git commit -m "feat: add searchPassages utility for keyword search over token index (issue #36)"
```

---

## Task 2: `components/SearchModal.js` — search UI (TDD)

**Files:**
- Create: `tests/ui/SearchModal.test.js`
- Create: `components/SearchModal.js`

The modal is self-contained: it wraps its own `<Portal><Modal>`. App.js controls visibility with a `visible` prop. It calls `onSelectResult(result, rawQuery)` when the user taps a result (passing raw query string so App.js can use it for highlight finding).

---

### Step 1: Write failing tests

Create `tests/ui/SearchModal.test.js`:

```js
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import SearchModal from '../../components/SearchModal';

// Mock searchPassages so tests don't depend on the real index
jest.mock('../../utils/searchQuery', () => ({
  searchPassages: jest.fn(),
}));
import { searchPassages } from '../../utils/searchQuery';

const mockResults = [
  {
    docId: 'kitab-i-iqan', section: 'Part One', paragraphNum: 45,
    score: 0.9, snippet: '…spirit of faith hath been breathed…',
    title: 'Kitáb-i-Íqán', author: "Bahá'u'lláh", url: 'https://example.com',
  },
  {
    docId: 'hidden-words', section: 'Arabic', paragraphNum: 3,
    score: 0.6, snippet: '…love of God is manifest…',
    title: 'Hidden Words', author: "Bahá'u'lláh", url: 'https://example.com/2',
  },
];

const mockIndex = { documents: [], metadata: {}, tokenIndex: {} };

const renderModal = (props = {}) =>
  render(
    <PaperProvider theme={MD3LightTheme}>
      <SearchModal
        visible={true}
        onDismiss={jest.fn()}
        searchIndex={mockIndex}
        onSelectResult={jest.fn()}
        {...props}
      />
    </PaperProvider>
  );

describe('SearchModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchPassages.mockReturnValue([]);
  });

  test('renders a search input when visible', () => {
    const { getByPlaceholderText } = renderModal();
    expect(getByPlaceholderText(/search/i)).toBeTruthy();
  });

  test('shows short-query hint when fewer than 3 chars typed', () => {
    const { getByPlaceholderText, getByText } = renderModal();
    fireEvent.changeText(getByPlaceholderText(/search/i), 'ab');
    expect(getByText(/type a few words/i)).toBeTruthy();
  });

  test('shows no-results message when query has 3+ chars and no matches', () => {
    searchPassages.mockReturnValue([]);
    const { getByPlaceholderText, getByText } = renderModal();
    fireEvent.changeText(getByPlaceholderText(/search/i), 'xyzzy');
    expect(getByText(/no matching passages/i)).toBeTruthy();
  });

  test('shows results list when matches are found', () => {
    searchPassages.mockReturnValue(mockResults);
    const { getByPlaceholderText, getByText } = renderModal();
    fireEvent.changeText(getByPlaceholderText(/search/i), 'spirit faith');
    expect(getByText('Kitáb-i-Íqán')).toBeTruthy();
    expect(getByText('Hidden Words')).toBeTruthy();
  });

  test('calls onSelectResult with result and raw query when result is tapped', () => {
    searchPassages.mockReturnValue(mockResults);
    const onSelectResult = jest.fn();
    const { getByPlaceholderText, getByText } = renderModal({ onSelectResult });
    fireEvent.changeText(getByPlaceholderText(/search/i), 'spirit faith');
    fireEvent.press(getByText('Kitáb-i-Íqán'));
    expect(onSelectResult).toHaveBeenCalledWith(mockResults[0], 'spirit faith');
  });

  test('calls onDismiss when result is tapped', () => {
    searchPassages.mockReturnValue(mockResults);
    const onDismiss = jest.fn();
    const { getByPlaceholderText, getByText } = renderModal({ onDismiss });
    fireEvent.changeText(getByPlaceholderText(/search/i), 'spirit');
    fireEvent.press(getByText('Kitáb-i-Íqán'));
    expect(onDismiss).toHaveBeenCalled();
  });

  test('does not render when visible is false', () => {
    const { queryByPlaceholderText } = renderModal({ visible: false });
    expect(queryByPlaceholderText(/search/i)).toBeFalsy();
  });
});
```

### Step 2: Run tests to confirm they fail

```bash
npm test -- --testPathPattern=SearchModal
```

Expected: FAIL — `Cannot find module '../../components/SearchModal'`

### Step 3: Implement `components/SearchModal.js`

```js
import React, { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import {
  Modal,
  Portal,
  Searchbar,
  List,
  Text as PaperText,
  Divider,
} from 'react-native-paper';
import { searchPassages } from '../utils/searchQuery';

export default function SearchModal({ visible, onDismiss, searchIndex, onSelectResult }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleQueryChange = useCallback((text) => {
    setQuery(text);
    if (text.length < 3) {
      setResults([]);
      return;
    }
    setResults(searchPassages(text, searchIndex));
  }, [searchIndex]);

  const handleSelect = useCallback((result) => {
    const rawQuery = query;
    setQuery('');
    setResults([]);
    onSelectResult(result, rawQuery);
    onDismiss();
  }, [query, onSelectResult, onDismiss]);

  const renderResult = useCallback(({ item }) => (
    <List.Item
      title={item.title}
      description={`${item.section} · ${item.snippet}`}
      descriptionNumberOfLines={2}
      onPress={() => handleSelect(item)}
    />
  ), [handleSelect]);

  const renderBody = () => {
    if (!searchIndex) {
      return <PaperText style={styles.hint}>Loading index…</PaperText>;
    }
    if (query.length > 0 && query.length < 3) {
      return <PaperText style={styles.hint}>Type a few words to search.</PaperText>;
    }
    if (query.length >= 3 && results.length === 0) {
      return (
        <PaperText style={styles.hint}>
          No matching passages found. Try fewer or different words.
        </PaperText>
      );
    }
    return (
      <FlatList
        data={results}
        keyExtractor={(item) => `${item.docId}-${item.section}-${item.paragraphNum}`}
        renderItem={renderResult}
        ItemSeparatorComponent={() => <Divider />}
      />
    );
  };

  if (!visible) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <Searchbar
          placeholder="Search passages…"
          value={query}
          onChangeText={handleQueryChange}
          autoFocus
          style={styles.searchbar}
        />
        {renderBody()}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: '#fdfaf5',
    margin: 0,
    flex: 1,
    paddingTop: 50, // clear status bar
  },
  searchbar: {
    margin: 16,
    borderRadius: 8,
  },
  hint: {
    margin: 16,
    color: '#666',
  },
});
```

### Step 4: Run tests to confirm they pass

```bash
npm test -- --testPathPattern=SearchModal
```

Expected: all PASS.

### Step 5: Run full suite

```bash
npm test
```

Expected: all tests PASS.

### Step 6: Commit

```bash
git add components/SearchModal.js tests/ui/SearchModal.test.js
git commit -m "feat: add SearchModal component with keyword search UI (issue #36)"
```

---

## Task 3: Wire into `App.js`

**Files:**
- Modify: `App.js`

Three changes:
1. Import `SearchModal` and `findHighlightPosition` + `tokenize`
2. Add `showSearchPanel` state + search icon in `topBar`
3. Add `handleSearchResult` callback that loads the passage and sets `matchState`

---

### Step 1: Add imports to App.js

Add to the existing `textMatcher` import line:

```js
// Before (line ~6):
import { findBestMatch, findHighlightPosition, getDocumentMetadata, debounce } from './utils/textMatcher';
// Note: findHighlightPosition is already imported but unused — it will now be used.
```

Add after the `MatchedTextWidget` import:

```js
import SearchModal from './components/SearchModal';
```

### Step 2: Add `showSearchPanel` state

Add alongside the existing `showDebugPanel` state (around line 86):

```js
const [showSearchPanel, setShowSearchPanel] = useState(false);
```

### Step 3: Add `handleSearchResult` callback

Add after the `stopRecording` function (around line 545):

```js
const handleSearchResult = useCallback(async (result, rawQuery) => {
  const content = await fetchDocumentContent(result.docId, result.section, result.paragraphNum);
  if (!content) return;

  const paragraphIdx = result.paragraphNum - 1;
  const paragraphStart = content.paragraphOffsets[paragraphIdx] || 0;
  const nextOffset = content.paragraphOffsets[paragraphIdx + 1];
  const paragraphEnd = nextOffset !== undefined ? nextOffset - 2 : content.text.length;
  const paragraphText = content.text.substring(paragraphStart, paragraphEnd);

  // Find the query phrase within the paragraph for precise highlighting
  const queryWords = rawQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const relativePos = findHighlightPosition(paragraphText, queryWords);

  const highlightPosition = {
    start: paragraphStart + relativePos.start,
    end: paragraphStart + relativePos.end,
    currentStart: paragraphStart,
    currentEnd: paragraphEnd,
    contextStart: 0,
    contextEnd: content.text.length,
    firstParagraphNum: result.paragraphNum,
  };

  const metadata = getDocumentMetadata(searchIndexRef.current, result.docId);
  setMatchState({
    isLoading: false,
    matchedDocument: {
      ...content,
      title: metadata?.title || content.title,
      author: metadata?.author || content.author,
      url: metadata?.url || content.url,
    },
    matchedContent: content.text,
    highlightPosition,
    confidence: result.score,
  });
}, [fetchDocumentContent]);
```

### Step 4: Add search icon to topBar and render SearchModal

In the JSX, update the `topBar` View:

```jsx
<View style={styles.topBar}>
  <IconButton
    icon="magnify"
    size={20}
    onPress={() => {
      if (isRecording) stopRecording();
      setShowSearchPanel(true);
    }}
    style={styles.searchButton}
  />
  <IconButton
    icon="bug"
    size={20}
    onPress={() => setShowDebugPanel(true)}
    style={styles.debugButton}
  />
</View>
```

Add `SearchModal` after the existing `<Portal>` block (before `</PaperProvider>`):

```jsx
<SearchModal
  visible={showSearchPanel}
  onDismiss={() => setShowSearchPanel(false)}
  searchIndex={searchIndexRef.current}
  onSelectResult={handleSearchResult}
/>
```

Add `searchButton` style alongside `debugButton`:

```js
searchButton: {
  margin: 0,
},
```

### Step 5: Run full test suite

```bash
npm test
```

Expected: all tests PASS. Check in particular that `App.test.js` still passes — the new `showSearchPanel` state and icon should not affect existing tests.

### Step 6: Commit

```bash
git add App.js
git commit -m "feat: wire SearchModal into App — search icon in topBar, handleSearchResult sets matchState (issue #36)"
```

---

## Final verification

Manually test on simulator or device:
1. Tap the magnify icon → modal opens with search bar focused
2. Type 2 chars → "Type a few words to search." hint appears
3. Type a known phrase (e.g. "flames of the love") → results list appears with title + snippet
4. Tap a result → modal closes, reading surface shows the passage with phrase highlighted
5. Tap Record while modal is open → (not applicable, modal opened from idle state) — if recording is active when search icon tapped, recording stops before modal opens
6. Type a nonsense phrase → "No matching passages found." message appears

```bash
npm test
```

Expected: all tests PASS.

```bash
git log --oneline -5
```

Expected: 3 new commits on top of the feature branch.
