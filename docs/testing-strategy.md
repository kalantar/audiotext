# Testing Strategy

FollowAlong uses a hybrid testing approach to prevent UI regressions while maintaining fast feedback loops.

## Testing Layers

### 1. Text Matching Algorithm Tests (Custom Runner)

**What:** Pure function tests for fuzzy text matching logic
**Tool:** Custom Node.js test runner
**Location:** `tests/matching/`
**Run:** `npm run test:matching`

**Coverage:**
- Progressive word matching (8, 14, 25+ words)
- Disambiguation (common phrases)
- Temporal continuity (sequential paragraphs)
- Noise tolerance (speech-to-text errors)

**Why Custom Runner:**
- Lightweight: No framework overhead
- Fast: Runs in < 5 seconds
- Simple: Direct function calls with clear output
- Focused: Built specifically for matching algorithm testing

**Test Output:**
```
======================================================================
TEST: paragraph-67-test.js
======================================================================
Expected: gems-divine-mysteries p69
  [✓] 3 words: NO MATCH (expected)
  [✓] 6 words: NO MATCH (expected)
  [✓] 14 words: gems-divine-mysteries p69 (score: 0.573)
  [✓] 28 words: gems-divine-mysteries p69 (score: 0.650)

  ✓ Test Result: 4/4 stages passed
```

### 2. UI Component Tests (Jest + RNTL)

**What:** Component behavior, layout, and state management
**Tool:** Jest + React Native Testing Library
**Location:** `tests/ui/`
**Run:** `npm run test:ui`

**Coverage:**
- Layout & spacing (paragraph spacing, highlight rendering)
- Auto-scroll (trigger conditions, positioning)
- State management (loading, empty, content persistence)
- Integration (transcription → matching → UI update)

**Why Jest + RNTL:**
- Industry standard for React Native
- Fast execution (< 2 seconds)
- Good mocking capabilities
- Excellent component testing patterns

**Test Example:**
```javascript
test('highlighted text has background color only (marker-style)', () => {
  const { getByText } = renderWithTheme(
    <MatchedTextWidget
      fullContent="First paragraph. Second paragraph."
      highlightPosition={{ start: 0, end: 16 }}
    />
  );

  const highlighted = getByText(/First paragraph/);
  expect(highlighted.props.style).toEqual(
    expect.objectContaining({ backgroundColor: expect.any(String) })
  );
  expect(highlighted.props.style.fontSize).toBeUndefined();
});
```

### 3. AI UI Review (Development Tool)

**What:** Subjective quality assessment against design principles
**Tool:** Custom AI agent + screenshots
**Location:** `tests/ui-review/`
**Run:** `npm run ui-review`

**Coverage:**
- Visual consistency
- Marker-style highlighting
- Spacing feel (subjective)
- Design principle adherence

**Why AI Review:**
- Catches subjective quality issues ("spacing feels off")
- Verifies design principles from CLAUDE.md
- Complements automated tests
- Fast developer workflow

**When to Use:**
- Before committing UI changes
- After fixing visual bugs
- During UI feature development
- Not in CI (development-time tool)

## Test Data Strategy

**Shared Fixtures:** All tests use the same transcription samples from `tests/fixtures/`

**Benefits:**
- Single source of truth for test data
- New fixture → available to all test types
- Growing corpus improves matching + UI testing
- Real-world speech-to-text scenarios

**Fixture Structure:**
```javascript
export const testCase = {
  transcribedText: 'in this connection we were related...',
  expectedMatch: {
    docId: 'gems-divine-mysteries',
    section: 'Gems of Divine Mysteries',
    paragraphNum: 69
  },
  correctParagraphText: 'In this connection We will relate...',
  progressiveStages: [
    { words: 'in this connection', wordCount: 3 },
    { words: 'in this connection we were related', wordCount: 6 },
    // ... more stages
  ]
};
```

## Development Workflow

### TDD Cycle (UI Changes)

1. Write failing test in `tests/ui/`
2. Run `npm run test:ui:watch`
3. Implement minimal code to pass test
4. Verify test passes
5. Refactor if needed
6. Commit with test + implementation

**Example:**
```bash
# Terminal 1: Watch mode for instant feedback
npm run test:ui:watch

# Terminal 2: Make code changes
# Tests automatically re-run on save
```

### Before Committing UI Changes

1. Run `npm test` (all tests)
2. Run `npm run ui-review` (AI quality check)
3. Manually test in app (subjective feel)
4. Commit if all checks pass

### Adding Test Fixtures

1. Read passage aloud in app
2. Copy transcription from debug panel
3. Create fixture file in `tests/fixtures/`
4. Export `testCase` with standard structure
5. Fixture automatically available to all tests

**Benefits:**
- Easy to add new test cases
- Real-world data from actual usage
- Tests improve as corpus grows

## Mock Infrastructure

### MockVoskWebSocket

**Purpose:** Simulate Vosk server in tests without real WebSocket connection

**Features:**
- Progressive transcription stages
- Partial and final results
- Connection lifecycle (open, close, error)

**Usage:**
```javascript
const mockWs = new MockVoskWebSocket(testCase);
mockWs.sendNextStage(); // Simulates partial result
mockWs.sendFinal();     // Simulates final result
```

### MockAudio (expo-av)

**Purpose:** Stub audio recording without real hardware

**Features:**
- Permission requests (always grants)
- Recording lifecycle (start, stop, getURI)
- No actual audio capture

**Configuration:**
```javascript
// jest.config.cjs
moduleNameMapper: {
  '^expo-av$': '<rootDir>/tests/ui/__mocks__/mockAudio.js',
}
```

## CI/CD Integration

### PR Checks (Automated)
```bash
npm run test:matching  # Text matching tests
npm run test:ui        # UI component tests
```

**GitHub Actions:**
```yaml
- name: Run tests
  run: npm test
```

**Success Criteria:**
- All matching tests pass (23/23 stages)
- All UI tests pass (24/24 tests)
- Total execution time < 10 seconds

### Pre-Commit (Manual)
```bash
npm run ui-review      # AI quality review (opt-in)
```

## Success Metrics

**Current Status:**
- ✅ Test execution time: < 7 seconds for full suite
- ✅ Coverage: 100% of critical UI components
- ✅ Fixture reuse: 100% shared between test types
- ✅ Regression prevention: Layout and matching issues caught before merge

**Coverage Goals:**
- Text matching algorithm: > 90% branch coverage (achieved)
- UI components (critical path): > 80% branch coverage (achieved)
- Integration flows: Key user journeys tested (partial, needs DI)

**Run Coverage:**
```bash
npm run test:ui:coverage
```

## Testing Philosophy

### What We Test

**Unit Level:**
- Pure functions (text matching algorithm)
- Component rendering and state
- User interactions (button clicks, scrolling)

**Integration Level:**
- Component integration (App → MatchedTextWidget)
- Mock WebSocket → UI updates
- State propagation across components

**Not Tested (Intentionally):**
- Implementation details (internal state, private methods)
- Styling values (use AI review instead)
- Platform-specific behavior (manual testing)

### Fast Feedback Loop

**Priority:** Speed over coverage

- Unit/integration tests: < 7 seconds total
- Watch mode for instant feedback
- CI runs same tests (no separate slow suite)

**Trade-offs:**
- No E2E tests (would add minutes to CI)
- No screenshot diffing (brittle, high maintenance)
- Limited platform-specific testing

**Rationale:** Fast tests enable TDD and prevent broken main branch

### Avoiding Test Smells

**Don't Test:**
- Implementation details (use public API)
- Trivial code (getters, setters)
- Third-party libraries (trust they work)

**Do Test:**
- User-facing behavior (what user sees/does)
- Business logic (matching algorithm)
- Edge cases (empty states, errors)

**Example - Good:**
```javascript
// Tests behavior, not implementation
test('shows empty state when no match', () => {
  const { getByText } = render(<MatchedTextWidget matchedDocument={null} />);
  expect(getByText(/ready to listen/i)).toBeTruthy();
});
```

**Example - Bad:**
```javascript
// Tests implementation detail
test('sets state.isEmpty to true when no match', () => {
  const wrapper = shallow(<MatchedTextWidget matchedDocument={null} />);
  expect(wrapper.state('isEmpty')).toBe(true);
});
```

## Future Enhancements

### Dependency Injection for App.js

**Current Limitation:** Cannot fully test WebSocket integration

**Proposed Solution:**
```javascript
export default function App({ wsFactory = (url) => new WebSocket(url) }) {
  const ws = wsFactory(WS_SERVER_URL);
}
```

**Benefits:**
- Full integration testing with mock WebSocket
- Test transcription → matching → UI flow end-to-end
- No need for real Vosk server in tests

**Tracking:** See `tests/KNOWN_ISSUES.md`

### E2E Testing (Optional)

**When to Add:**
- Regression rate increases despite unit tests
- Need to test platform-specific behavior
- Complex user flows not covered by integration tests

**Tool:** Detox (React Native E2E)

**Trade-offs:**
- Slower (minutes vs seconds)
- More maintenance (brittle, flaky)
- Complex setup (requires simulators/emulators)

**Decision:** Defer until regression rate indicates need

### Screenshot Diffing (Optional)

**When to Add:**
- Visual regressions not caught by tests or AI review
- Need pixel-perfect consistency

**Tool:** Pixelmatch or similar

**Trade-offs:**
- Brittle (breaks on minor styling changes)
- High maintenance (update snapshots frequently)
- Platform-specific (different renders on iOS/Android/Web)

**Decision:** AI review provides better subjective assessment without brittleness

## References

- Design principles: `CLAUDE.md` (UI Design Principles)
- Test fixtures: `tests/fixtures/`
- Test documentation: `tests/README.md`
- Known issues: `tests/KNOWN_ISSUES.md`
- Jest config: `jest.config.cjs`
- RNTL docs: https://callstack.github.io/react-native-testing-library/
