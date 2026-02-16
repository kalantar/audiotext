# FollowAlong Test Suite

Comprehensive testing for text matching algorithm and UI components.

## Test Structure

```
tests/
  ├── fixtures/           # Shared transcription test cases
  ├── matching/           # Text matching algorithm tests
  ├── ui/                 # React Native component tests (Jest + RNTL)
  └── ui-review/          # AI quality review agent
```

## Running Tests

### All Tests
```bash
npm test                    # Runs matching + UI tests
```

### Text Matching Tests
```bash
npm run test:matching       # Run all matching tests
node tests/matching/run-tests.mjs paragraph-67-test.js  # Specific test
```

### UI Component Tests
```bash
npm run test:ui             # Run all UI tests
npm run test:ui:watch       # Watch mode for development
npm run test:ui:coverage    # Generate coverage report
```

### AI UI Review
```bash
npm run ui-review           # Review all fixtures
npm run ui-review paragraph-67  # Review specific fixture
```

See `tests/ui-review/README.md` for screenshot capture workflow.

## Test Fixtures

Located in `tests/fixtures/`, these contain real transcription samples from Vosk:

- `paragraph-67-test.js` - Short phrase, early lock-in prevention
- `unique-text-kit-b-i-q-n-noah-story-test.js` - Unique distinctive text
- `common-phrase-o-son-of-arabic-1-test.js` - Disambiguation test
- `long-text-epistle-mid-paragraph-test.js` - Long passage with noise
- `short-prayer-with-noise-test.js` - Short prayer, minimum threshold

Each fixture exports a `testCase` object:
```javascript
export const testCase = {
  transcribedText: '...',           // Full noisy transcription
  expectedMatch: { docId, section, paragraphNum },
  correctParagraphText: '...',      // Clean reference text
  progressiveStages: [...]          // Word-by-word buildup
};
```

### Adding New Fixtures

1. Read passage aloud in app
2. Copy transcription from debug panel
3. Create new fixture in `tests/fixtures/`
4. Export `testCase` with structure above
5. Fixture automatically available to all test types

## Text Matching Tests

**What they test:** Core fuzzy matching algorithm

**Coverage:**
- Progressive word matching (8, 14, 25+ words)
- Disambiguation (common phrases like "O Son of...")
- Noise tolerance (speech-to-text errors)
- Temporal continuity (sequential paragraph detection)
- Stickiness prevention (0.15 threshold to switch documents)

**Results:** 23/23 stages passing (100%)

## UI Component Tests

**What they test:** React Native components for correct rendering, layout, and behavior

### MatchedTextWidget Tests (12 tests)

**Layout & Spacing:**
- Paragraph spacing uniform throughout
- Highlighted paragraphs have same spacing as unhighlighted
- Text inside highlights maintains same styling (marker-style)
- Growing highlight spans from first to current paragraph

**Auto-Scroll:**
- Scrolls when currentParagraphIndex changes
- Does not scroll when index unchanged
- Scroll position calculated from layout measurements

**State Management:**
- Loading state shows ActivityIndicator
- Empty state shows "Ready to listen"
- Content persists during loading (no flash)

### Mock Infrastructure (8 tests)

**MockVoskWebSocket:**
- Simulates progressive transcription stages
- Feeds partial and final results
- Tests WebSocket lifecycle

**MockAudio (expo-av):**
- Stubs audio recording without real hardware
- Tests permission requests
- Tests recording start/stop

### App Integration Tests (3 tests)

**Flow Testing:**
- Basic rendering of main UI components
- Placeholder for full transcription → matching flow (needs WebSocket DI)
- FAB icon state changes (needs testID props)

**Note:** Full integration tests require WebSocket dependency injection.
See `tests/ui/App.test.js` for proposed refactoring.

**Results:** 24/24 tests passing (100%)

## AI UI Review Agent

**What it does:** Developer tool for subjective quality assessment

**Coverage:**
- Visual consistency checks
- Marker-style highlighting verification
- Spacing and layout feel
- Design principle adherence (from CLAUDE.md)

**Not automated** - invoked manually with screenshots for human review.

See `tests/ui-review/README.md` for usage instructions.

## Development Workflow

### Making UI Changes

1. Write/update UI code
2. Run `npm run test:ui:watch` (fast feedback)
3. Manually test in app
4. Run `npm run ui-review` before committing

### Adding Test Cases

For **text matching**:
- Add fixture to `tests/fixtures/`
- Test automatically included in `npm run test:matching`

For **UI testing**:
- Import fixture from `tests/fixtures/`
- Create test in `tests/ui/` using fixture data
- Mock WebSocket feeds progressive stages

### TDD Cycle (UI Changes)

1. Write failing test in `tests/ui/`
2. Run `npm run test:ui:watch`
3. Implement minimal code to pass test
4. Verify test passes
5. Refactor if needed
6. Commit with test + implementation

## CI/CD

Tests run automatically on PR:
```yaml
- npm run test:matching
- npm run test:ui
```

AI review is opt-in during development (not in CI).

## Test Coverage Goals

- Text matching algorithm: > 90% branch coverage
- UI components (critical path): > 80% branch coverage
- Integration flows: Key user journeys tested

Run coverage report:
```bash
npm run test:ui:coverage
```

## Success Metrics

**Current Status:**
- ✅ Text matching: 23/23 stages (100%)
- ✅ UI components: 24/24 tests (100%)
- ✅ Test execution: < 7 seconds total
- ✅ Fixture reuse: 100% shared between test types

**Coverage:**
- ✅ Unique openers
- ✅ Common phrases requiring disambiguation
- ✅ Long passages (45+ words)
- ✅ Short passages (< 15 words)
- ✅ Noisy transcription with errors
- ✅ Early lock-in prevention (8+ word minimum)
- ✅ UI layout consistency
- ✅ Auto-scroll behavior
- ✅ State management
- ⏳ Full WebSocket integration (needs DI)
- ⏳ Sequential paragraph progression
- ⏳ Document switching

## References

- Text matching algorithm: `utils/textMatcher.js`
- UI design principles: `CLAUDE.md` (UI Design Principles section)
- Testing strategy: `docs/testing-strategy.md`
- Jest config: `jest.config.cjs`
- RNTL docs: https://callstack.github.io/react-native-testing-library/
