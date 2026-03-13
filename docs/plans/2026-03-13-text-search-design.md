# Text Search Design

**Issue:** #36
**Date:** 2026-03-13
**Status:** Design approved, pending implementation

## Problem

A user who wants to read a passage aloud to others needs a way to find that passage first. The current app only surfaces text through speech recognition — there is no way to navigate to a passage manually. Search text may match anywhere within a paragraph, not necessarily at the start.

## Approach

A keyword/phrase search over the existing `search-index.json`. No semantic search, no new dependencies, no new navigation library. The search modal is a new entry point that populates the same `matchState` used by the speech matcher — the reading surface is unchanged.

Semantic search (e.g. Claude API or pre-computed embeddings) is explicitly deferred.

## UI

**Entry point:** A `magnify` icon button added to the topBar, to the left of the existing debug icon (both right-aligned). Disabled while recording is active; opening search while recording stops recording automatically.

**SearchModal:** Full-screen Portal modal (same pattern as the debug panel). Auto-focused search bar at the top. `FlatList` of results below. Closes on backdrop tap or ✕ button.

**Result row:** Book title (bold) + section (muted) + ~80-char snippet of the matching paragraph centered on the first query token hit.

**Empty state:** "No matching passages found. Try fewer or different words."
**Short query state:** "Type a few words to search." (shown for < 3 characters).

**Debug icon:** Remains in the topBar for now alongside the search icon. To be hidden or removed in a future pass.

## Data Flow

```
User types query
  → tokenize (lowercase, split, filter short words)
  → look up each token's 4-char prefix in tokenIndex → candidate paragraph indices
  → score candidates: phrase ngram match > scattered token hits
  → return top 15 results

User taps result
  → modal closes
  → fetchDocumentContent(docId, section, paragraphNum)   [existing function]
  → find query phrase within paragraph text → highlightPosition
  → setMatchState(...)   [same path as speech match]
  → MatchedTextWidget renders passage with phrase highlighted
```

## Search Algorithm

1. **Tokenize** query: lowercase, split on whitespace/punctuation, filter words < 3 chars.
2. **Candidate retrieval:** for each token, take its 4-char prefix, look up `tokenIndex[prefix]`. Union all result sets. Typically yields a few hundred candidates from 43k paragraphs.
3. **Scoring:** for each candidate paragraph, count query tokens present in `documents[i].tokens` (exact) and `documents[i].ngrams` (phrase). Phrase match scores higher than scattered tokens. Return top 15 by score.
4. **Snippet:** find the first query token in `documents[i].preview`, show ~80 chars centred on that position.
5. **Highlight on load:** after `fetchDocumentContent`, locate the query phrase within the paragraph text using substring/fuzzy match to set `highlightPosition.start` and `highlightPosition.end`.

**Known limitations (deferred):** no stemming (`flame` won't find `flames`), no synonyms, no semantic/concept matching.

## Error Handling

| Situation | Behaviour |
|---|---|
| No results | Empty state message in modal |
| Query < 3 chars | Hint message, no search triggered |
| Search index not yet loaded | Loading indicator in modal |
| Document fetch failure | Existing Snackbar via `onError` prop — no new handling needed |
| Recording active on search open | `stopRecording()` called before opening modal |

## Testing

**Unit tests** (`tests/matching/`): tokenization, candidate retrieval, scoring — exact phrase ranks first, partial matches rank lower, short query rejected, empty query returns nothing.

**UI tests** (`tests/ui/SearchModal.test.js`): typing a query shows results, tapping a result closes modal and populates reading surface, empty state renders on no results, short query shows hint.

## New Files

- `components/SearchModal.js` — modal component with search bar and results list
- `utils/searchQuery.js` — tokenize, candidate lookup, score, and snippet logic
- `tests/ui/SearchModal.test.js` — UI tests
- `tests/matching/searchQuery.test.js` — algorithm unit tests (or added to existing matching tests)

## Modified Files

- `App.js` — add search icon to topBar, wire `SearchModal`, handle recording stop on search open
- `utils/textMatcher.js` — expose or extract `findHighlightPosition` for reuse by search result loading
