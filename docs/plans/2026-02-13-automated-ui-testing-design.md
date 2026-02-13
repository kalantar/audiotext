# Automated UI Testing Design

## Overview

Add automated testing for React Native UI components to prevent regressions in layout, spacing, and auto-scroll behavior as the UI evolves. Uses a hybrid approach: Jest + React Native Testing Library for fast component tests, plus an AI review agent for subjective quality assessment.

## Problem Statement

As we enhance the UI, various aspects break: spacing between paragraphs, auto-scroll positioning, highlight rendering, and card layout. Currently we only test text matching logic (utils/textMatcher.js), with no automated UI testing. Manual testing catches issues late in the development cycle.

## Goals

1. **Prevent UI regressions** - Automated tests for layout/spacing and auto-scroll behavior
2. **Fast feedback** - Tests run in seconds, not minutes
3. **Reuse existing test data** - Leverage growing corpus of transcription samples
4. **Catch subjective issues** - AI agent reviews against CLAUDE.md design principles

## Non-Goals

- End-to-end testing with Detox (too slow for development feedback loop)
- Visual snapshot testing with pixel-perfect comparison (too brittle)
- Testing audio recording or WebSocket connection reliability (out of scope)

## Architecture

### Test Suite Structure

```
tests/
  ├── fixtures/                          (Shared test data - moved from root)
  │   ├── paragraph-67-test.js           (Existing transcription samples)
  │   ├── common-phrase-o-son-of-arabic-1-test.js
  │   ├── long-text-epistle-mid-paragraph-test.js
  │   ├── short-prayer-with-noise-test.js
  │   └── unique-text-kit-b-i-q-n-noah-story-test.js
  │
  ├── matching/                          (Text matching tests - renamed from root)
  │   └── run-tests.mjs                  (Imports from ../fixtures/)
  │
  ├── ui/                                (New: UI component tests)
  │   ├── setup.js                       (Jest + RNTL configuration)
  │   ├── App.test.js                    (Integration tests)
  │   ├── MatchedTextWidget.test.js      (Layout/spacing/auto-scroll tests)
  │   └── __mocks__/
  │       ├── mockWebSocket.js           (Simulates Vosk server)
  │       └── mockAudio.js               (Mocks expo-av recording)
  │
  └── ui-review/                         (New: AI quality agent)
      ├── capture-screenshots.js         (Generate UI screenshots from fixtures)
      └── review-ui.js                   (Invoke AI agent with design principles)
```

### Shared Test Data Strategy

All test fixtures export a standard `testCase` object:

```javascript
export const testCase = {
  transcribedText: '...',                // Full noisy transcription from Vosk
  expectedMatch: {
    docId,
    section,
    paragraphNum
  },
  correctParagraphText: '...',           // Clean reference text
  progressiveStages: [                   // Word-by-word buildup
    { words: '...', wordCount: N, description: '...' }
  ]
};
```

**Benefits:**
- Text matching tests use fixtures to validate algorithm accuracy
- UI tests use fixtures to simulate realistic WebSocket transcription
- AI review uses fixtures to generate screenshot scenarios
- New fixture → automatically available to all three test types

## Component Testing Strategy

### MatchedTextWidget.js (High Priority)

**Layout Tests:**
- Paragraph spacing uniform throughout document
- Highlighted paragraphs have identical spacing to unhighlighted
- Text inside highlights maintains same font/size/weight (marker-style)
- Growing highlight spans from first matched to current paragraph
- Card boundaries properly contain content (overflow hidden)
- Max width constraint applied for readability

**Auto-Scroll Tests:**
- `scrollToCurrentParagraph` called when `currentParagraphIndex` changes
- Scroll position calculated from paragraph `onLayout` measurements
- Scroll does not trigger before layout measurements available
- Scroll targets correct paragraph (not off-by-one)
- Animated scroll with smooth behavior

**State Tests:**
- Loading state shows ActivityIndicator in card layout
- Empty state shows "Ready to listen" message
- Content persists during loading (no flash to blank)
- Confidence bar updates correctly with match score

### App.js (Medium Priority)

**Integration Tests:**
- Transcription updates trigger debounced text matching
- Match result updates MatchedTextWidget props correctly
- Recording state changes FAB icon (microphone ↔ stop)
- Debug panel toggles and displays transcription + match logs

**Mock Strategy:**
- Mock WebSocket to feed progressive transcription from fixtures
- Mock `expo-av` Audio recording (stub start/stop)
- Mock `findBestMatch` to return controlled match results

## Mock WebSocket Implementation

Simulates Vosk server behavior using test fixtures:

```javascript
// tests/ui/__mocks__/mockWebSocket.js
class MockVoskWebSocket {
  constructor(testCase) {
    this.testCase = testCase;
    this.stageIndex = 0;
    this.readyState = 1; // OPEN
  }

  // Simulate progressive transcription (partial results)
  sendNextStage() {
    const stage = this.testCase.progressiveStages[this.stageIndex];
    if (stage) {
      this.onmessage({
        data: JSON.stringify({ partial: stage.words })
      });
      this.stageIndex++;
    }
  }

  // Simulate final transcription
  sendFinal() {
    this.onmessage({
      data: JSON.stringify({
        text: this.testCase.transcribedText
      })
    });
  }

  close() {
    this.readyState = 3; // CLOSED
  }
}
```

**Usage in Tests:**
```javascript
import { testCase as paragraph67 } from '../fixtures/paragraph-67-test.js';

test('auto-scrolls when match updates', async () => {
  const mockWS = new MockVoskWebSocket(paragraph67);
  const { getByTestId } = render(<App wsFactory={() => mockWS} />);

  // Simulate progressive stages
  act(() => mockWS.sendNextStage()); // 3 words - no match
  act(() => mockWS.sendNextStage()); // 6 words - no match
  act(() => mockWS.sendNextStage()); // 14 words - triggers match

  // Assert auto-scroll triggered
  await waitFor(() => {
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ y: expect.any(Number), animated: true })
    );
  });
});
```

## AI UI Review Agent

**Purpose:** Catch subjective quality issues that automated assertions miss (spacing feels off, highlighting looks wrong, design principle violations).

**Process:**
1. **Capture screenshots** - Render UI with various fixture scenarios
2. **AI analysis** - Agent reviews against CLAUDE.md design principles
3. **Generate report** - Findings with severity ratings and suggestions

**Design Principles to Check:**
- Visual Consistency: All body text uniform (size, weight, color, font)
- Marker-Style Highlighting: Background color only, text unchanged
- Consistent Spacing: Paragraph spacing uniform, no special spacing around highlights
- Layout Stability: Container size consistent regardless of content state
- Inline Content Flow: Highlights inline with text, not separate blocks

**Agent Prompt Structure:**
```javascript
const reviewPrompt = `
Review these UI screenshots against the design principles from CLAUDE.md:

Design Principles:
1. Visual Consistency - All body text must be uniform
2. Marker-Style Highlighting - Background color only, text unchanged
3. Consistent Spacing - No special spacing around interactive elements
4. Layout Stability - No layout jumps when content loads/changes
5. Inline Content Flow - Highlights inline with text flow

For each screenshot, report:
- ✓ What looks correct
- ⚠️ Potential issues (severity: minor/moderate/major)
- 💡 Suggestions for improvement

Fixtures tested: ${fixtureNames.join(', ')}
`;
```

**When to Use:**
- During UI feature development (before committing)
- After making spacing/layout changes
- When visual bugs are reported
- **Not in CI initially** (too slow, non-deterministic for build gates)

**Invocation:**
```bash
npm run ui-review                    # Review all fixture scenarios
npm run ui-review paragraph-67       # Review specific fixture
```

## Test Cases (Priority Order)

### Phase 1: Critical Path (MatchedTextWidget)

**Layout:**
- ✅ Paragraph spacing uniform throughout document
- ✅ Highlighted paragraphs have same spacing as unhighlighted
- ✅ Text inside highlights maintains same font/size/weight
- ✅ Growing highlight spans from first to current paragraph
- ✅ Card contains content (no overflow escape)

**Auto-Scroll:**
- ✅ Scrolls when `currentParagraphIndex` changes
- ✅ Scroll position calculated from paragraph layout measurements
- ✅ Does not scroll before layout measurements available
- ✅ Scrolls to correct paragraph (not off-by-one)

### Phase 2: Integration (App.js)
- ✅ Progressive transcription updates trigger matching
- ✅ Match result updates widget props correctly
- ✅ Loading state shows during matching
- ✅ Content persists when new match arrives (no flash)

### Phase 3: AI Review Scenarios
- paragraph-67-test → Check spacing around short matches
- long-text-epistle-mid-paragraph-test → Check long passage layout
- common-phrase-o-son-of-arabic-1-test → Check disambiguation UI
- short-prayer-with-noise-test → Check minimum threshold UX

## Development Workflow

**Writing Code:**
1. Make UI changes
2. Run `npm run test:ui` (fast feedback on layout/spacing)
3. Manually test in app (subjective feel)
4. Run `npm run ui-review` before committing (AI quality check)

**Adding Test Fixtures:**
1. Read passage aloud in app
2. Copy transcription from debug panel
3. Create fixture file in `tests/fixtures/`
4. Export `testCase` with transcribedText + expectedMatch
5. Fixture automatically available to all test types

**CI/CD Pipeline:**
```yaml
test:
  - npm test              # Runs matching + UI tests
  - npm run test:ui       # UI tests only (faster for UI PRs)

# ui-review is opt-in during development, not in CI initially
```

## Technology Stack

- **Jest** - Test runner
- **React Native Testing Library** - Component testing utilities
- **@testing-library/react-hooks** - Hook testing
- **@testing-library/jest-native** - Additional matchers for RN
- **AI Agent** - Superpowers infrastructure for UI review

## Success Metrics

- **Test execution time** - UI test suite completes in < 10 seconds
- **Coverage** - Critical UI components have > 80% branch coverage
- **Regression prevention** - UI tests catch layout/scroll issues before merge
- **Fixture reuse** - Text matching + UI tests share 100% of transcription data
- **AI review adoption** - Used before committing UI changes in 80%+ of PRs

## Migration Path

**Step 1: Setup**
- Install Jest + RNTL dependencies
- Create `tests/ui/setup.js` configuration
- Move existing test files to `tests/fixtures/`
- Update `tests/matching/run-tests.mjs` import paths

**Step 2: MatchedTextWidget Tests**
- Implement layout tests (spacing, highlighting, card containment)
- Implement auto-scroll tests (trigger conditions, positioning)
- Implement state tests (loading, empty, content persistence)

**Step 3: App Integration Tests**
- Create mock WebSocket and Audio
- Test transcription → matching → UI update flow
- Test recording state changes

**Step 4: AI Review Agent**
- Create screenshot capture script
- Implement AI agent with design principle prompts
- Test with fixture scenarios

**Step 5: CI Integration**
- Add `npm run test:ui` to CI pipeline
- Document AI review usage for developers
- Monitor test execution times and stability

## Open Questions

None - design approved and ready for implementation planning.

## References

- Existing text matching tests: `tests/run-tests.mjs`
- UI design principles: `CLAUDE.md` (sections: UI Design Principles, Component Usage Pattern)
- Test fixtures: `tests/paragraph-67-test.js` (example structure)
