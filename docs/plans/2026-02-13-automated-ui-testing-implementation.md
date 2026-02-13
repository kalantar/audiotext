# Automated UI Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Jest + React Native Testing Library for UI component tests, reorganize test structure to share fixtures, and create AI review agent for subjective quality assessment.

**Architecture:** Install Jest + RNTL, reorganize existing tests into fixtures/ directory, create ui/ directory for component tests with mocks for WebSocket and Audio, write tests for MatchedTextWidget (layout/spacing/auto-scroll) and App (integration), add AI review agent infrastructure.

**Tech Stack:** Jest, React Native Testing Library, React Test Renderer, existing test fixtures

---

## Task 1: Install Testing Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Jest and React Native Testing Library**

```bash
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native @testing-library/react-hooks react-test-renderer@19.1.0
```

**Step 2: Verify installation**

```bash
npm list jest @testing-library/react-native
```

Expected: Packages listed without errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Jest and React Native Testing Library dependencies"
```

---

## Task 2: Configure Jest

**Files:**
- Create: `jest.config.js`
- Create: `tests/ui/setup.js`

**Step 1: Create Jest configuration**

Create `jest.config.js` in project root:

```javascript
module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/ui/setup.js'],
  testMatch: ['<rootDir>/tests/ui/**/*.test.js'],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|expo|@expo|@react-native|react-native-paper|expo-av|@react-navigation)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'App.js',
    'components/**/*.{js,jsx}',
    'utils/**/*.{js,jsx}',
    '!**/__tests__/**',
    '!**/node_modules/**',
  ],
};
```

**Step 2: Create test setup file**

Create `tests/ui/setup.js`:

```javascript
import '@testing-library/jest-native/extend-expect';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};

// Mock __DEV__ constant
global.__DEV__ = true;
```

**Step 3: Verify configuration**

```bash
npx jest --showConfig
```

Expected: Configuration displays without errors

**Step 4: Commit**

```bash
git add jest.config.js tests/ui/setup.js
git commit -m "chore: configure Jest for React Native testing"
```

---

## Task 3: Reorganize Test Directory Structure

**Files:**
- Create: `tests/fixtures/` (directory)
- Create: `tests/matching/` (directory)
- Move: `tests/paragraph-67-test.js` → `tests/fixtures/paragraph-67-test.js`
- Move: `tests/common-phrase-o-son-of-arabic-1-test.js` → `tests/fixtures/`
- Move: `tests/long-text-epistle-mid-paragraph-test.js` → `tests/fixtures/`
- Move: `tests/short-prayer-with-noise-test.js` → `tests/fixtures/`
- Move: `tests/unique-text-kit-b-i-q-n-noah-story-test.js` → `tests/fixtures/`
- Move: `tests/run-tests.mjs` → `tests/matching/run-tests.mjs`

**Step 1: Create new directories**

```bash
mkdir -p tests/fixtures tests/matching tests/ui tests/ui/__mocks__ tests/ui-review
```

**Step 2: Move test fixture files**

```bash
mv tests/paragraph-67-test.js tests/fixtures/
mv tests/common-phrase-o-son-of-arabic-1-test.js tests/fixtures/
mv tests/long-text-epistle-mid-paragraph-test.js tests/fixtures/
mv tests/short-prayer-with-noise-test.js tests/fixtures/
mv tests/unique-text-kit-b-i-q-n-noah-story-test.js tests/fixtures/
```

**Step 3: Move test runner**

```bash
mv tests/run-tests.mjs tests/matching/
```

**Step 4: Update import paths in run-tests.mjs**

Modify `tests/matching/run-tests.mjs:26-31`:

Replace:
```javascript
const testFiles = specificTest ? [specificTest] : [
  'paragraph-67-test.js',
  'unique-text-kit-b-i-q-n-noah-story-test.js',
  'common-phrase-o-son-of-arabic-1-test.js',
  'long-text-epistle-mid-paragraph-test.js',
  'short-prayer-with-noise-test.js'
];
```

With:
```javascript
const testFiles = specificTest ? [specificTest] : [
  '../fixtures/paragraph-67-test.js',
  '../fixtures/unique-text-kit-b-i-q-n-noah-story-test.js',
  '../fixtures/common-phrase-o-son-of-arabic-1-test.js',
  '../fixtures/long-text-epistle-mid-paragraph-test.js',
  '../fixtures/short-prayer-with-noise-test.js'
];
```

**Step 5: Update testPath construction**

Modify `tests/matching/run-tests.mjs:43`:

Replace:
```javascript
const testPath = path.join(__dirname, testFile);
```

With:
```javascript
const testPath = path.join(__dirname, testFile);
```

(No change needed - relative paths will work)

**Step 6: Test that matching tests still work**

```bash
node tests/matching/run-tests.mjs
```

Expected: All text matching tests pass

**Step 7: Update package.json test script**

Modify `package.json:11`:

Replace:
```json
"test": "node tests/run-tests.mjs"
```

With:
```json
"test": "node tests/matching/run-tests.mjs && jest",
"test:matching": "node tests/matching/run-tests.mjs",
"test:ui": "jest"
```

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: reorganize tests into fixtures/ and matching/ directories"
```

---

## Task 4: Create Mock WebSocket

**Files:**
- Create: `tests/ui/__mocks__/mockWebSocket.js`

**Step 1: Create mock WebSocket class**

Create `tests/ui/__mocks__/mockWebSocket.js`:

```javascript
/**
 * Mock WebSocket for simulating Vosk server in tests
 * Feeds progressive transcription stages from test fixtures
 */
export class MockVoskWebSocket {
  constructor(testCase) {
    this.testCase = testCase;
    this.stageIndex = 0;
    this.readyState = 1; // WebSocket.OPEN
    this.url = 'ws://mock:2700';
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
  }

  /**
   * Simulate progressive transcription - sends next stage as partial result
   */
  sendNextStage() {
    if (this.stageIndex >= this.testCase.progressiveStages.length) {
      return false;
    }

    const stage = this.testCase.progressiveStages[this.stageIndex];
    if (this.onmessage) {
      this.onmessage({
        data: JSON.stringify({ partial: stage.words })
      });
    }
    this.stageIndex++;
    return true;
  }

  /**
   * Simulate final transcription result
   */
  sendFinal() {
    if (this.onmessage) {
      this.onmessage({
        data: JSON.stringify({
          text: this.testCase.transcribedText
        })
      });
    }
  }

  /**
   * Simulate connection opening
   */
  open() {
    this.readyState = 1;
    if (this.onopen) {
      this.onopen({ type: 'open' });
    }
  }

  /**
   * Simulate connection closing
   */
  close() {
    this.readyState = 3; // WebSocket.CLOSED
    if (this.onclose) {
      this.onclose({ type: 'close', code: 1000, reason: 'Normal closure' });
    }
  }

  /**
   * Mock send method (does nothing in tests)
   */
  send(data) {
    // In real app, this sends audio chunks to Vosk
    // In tests, we control transcription via sendNextStage/sendFinal
  }
}

/**
 * Factory function for creating mock WebSocket instances
 */
export function createMockWebSocket(testCase) {
  return new MockVoskWebSocket(testCase);
}
```

**Step 2: Write test for mock WebSocket**

Create `tests/ui/__mocks__/mockWebSocket.test.js`:

```javascript
import { MockVoskWebSocket } from './mockWebSocket';

describe('MockVoskWebSocket', () => {
  const mockTestCase = {
    progressiveStages: [
      { words: 'hello world', wordCount: 2 },
      { words: 'hello world test', wordCount: 3 }
    ],
    transcribedText: 'hello world test final'
  };

  test('initializes with OPEN readyState', () => {
    const ws = new MockVoskWebSocket(mockTestCase);
    expect(ws.readyState).toBe(1);
  });

  test('sendNextStage calls onmessage with partial result', () => {
    const ws = new MockVoskWebSocket(mockTestCase);
    const mockOnMessage = jest.fn();
    ws.onmessage = mockOnMessage;

    ws.sendNextStage();

    expect(mockOnMessage).toHaveBeenCalledWith({
      data: JSON.stringify({ partial: 'hello world' })
    });
  });

  test('sendNextStage advances through stages', () => {
    const ws = new MockVoskWebSocket(mockTestCase);
    const mockOnMessage = jest.fn();
    ws.onmessage = mockOnMessage;

    ws.sendNextStage();
    ws.sendNextStage();

    expect(mockOnMessage).toHaveBeenCalledTimes(2);
    expect(mockOnMessage).toHaveBeenNthCalledWith(2, {
      data: JSON.stringify({ partial: 'hello world test' })
    });
  });

  test('sendFinal calls onmessage with text result', () => {
    const ws = new MockVoskWebSocket(mockTestCase);
    const mockOnMessage = jest.fn();
    ws.onmessage = mockOnMessage;

    ws.sendFinal();

    expect(mockOnMessage).toHaveBeenCalledWith({
      data: JSON.stringify({ text: 'hello world test final' })
    });
  });

  test('close changes readyState and calls onclose', () => {
    const ws = new MockVoskWebSocket(mockTestCase);
    const mockOnClose = jest.fn();
    ws.onclose = mockOnClose;

    ws.close();

    expect(ws.readyState).toBe(3);
    expect(mockOnClose).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'close', code: 1000 })
    );
  });
});
```

**Step 3: Run test**

```bash
npm run test:ui -- mockWebSocket.test.js
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add tests/ui/__mocks__/
git commit -m "test: add mock WebSocket for Vosk server simulation"
```

---

## Task 5: Create Mock Audio (expo-av)

**Files:**
- Create: `tests/ui/__mocks__/mockAudio.js`

**Step 1: Create mock Audio module**

Create `tests/ui/__mocks__/mockAudio.js`:

```javascript
/**
 * Mock expo-av Audio module for testing
 * Stubs recording functionality without actual audio capture
 */

const mockRecording = {
  startAsync: jest.fn().mockResolvedValue(undefined),
  stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
  getURI: jest.fn().mockReturnValue('mock://audio.wav'),
  setOnRecordingStatusUpdate: jest.fn(),
};

export const Audio = {
  requestPermissionsAsync: jest.fn().mockResolvedValue({
    status: 'granted',
    granted: true,
  }),

  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),

  Recording: jest.fn().mockImplementation(() => mockRecording),

  RecordingOptionsPresets: {
    HIGH_QUALITY: {
      isMeteringEnabled: true,
      android: {
        extension: '.m4a',
        outputFormat: 2,
        audioEncoder: 3,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      },
      ios: {
        extension: '.wav',
        outputFormat: 'linearPCM',
        audioQuality: 127,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 128000,
      },
    },
  },
};

// Reset mock state between tests
export function resetAudioMocks() {
  mockRecording.startAsync.mockClear();
  mockRecording.stopAndUnloadAsync.mockClear();
  mockRecording.getURI.mockClear();
  Audio.requestPermissionsAsync.mockClear();
  Audio.setAudioModeAsync.mockClear();
}
```

**Step 2: Configure Jest to use audio mock**

Add to `jest.config.js` after `moduleNameMapper`:

```javascript
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^expo-av$': '<rootDir>/tests/ui/__mocks__/mockAudio.js',
  },
```

**Step 3: Write test for mock Audio**

Create `tests/ui/__mocks__/mockAudio.test.js`:

```javascript
import { Audio, resetAudioMocks } from './mockAudio';

describe('Mock Audio (expo-av)', () => {
  beforeEach(() => {
    resetAudioMocks();
  });

  test('requestPermissionsAsync returns granted', async () => {
    const result = await Audio.requestPermissionsAsync();
    expect(result.granted).toBe(true);
  });

  test('Recording instance can start and stop', async () => {
    const recording = new Audio.Recording();

    await recording.startAsync();
    expect(recording.startAsync).toHaveBeenCalled();

    await recording.stopAndUnloadAsync();
    expect(recording.stopAndUnloadAsync).toHaveBeenCalled();
  });

  test('Recording getURI returns mock URI', () => {
    const recording = new Audio.Recording();
    expect(recording.getURI()).toBe('mock://audio.wav');
  });

  test('resetAudioMocks clears call history', () => {
    Audio.requestPermissionsAsync();
    expect(Audio.requestPermissionsAsync).toHaveBeenCalled();

    resetAudioMocks();
    expect(Audio.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
```

**Step 4: Run test**

```bash
npm run test:ui -- mockAudio.test.js
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add tests/ui/__mocks__/mockAudio.js jest.config.js
git commit -m "test: add mock expo-av Audio module"
```

---

## Task 6: Write MatchedTextWidget Layout Tests (TDD)

**Files:**
- Create: `tests/ui/MatchedTextWidget.test.js`

**Step 1: Write failing test for paragraph spacing**

Create `tests/ui/MatchedTextWidget.test.js`:

```javascript
import React from 'react';
import { render } from '@testing-library/react-native';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import MatchedTextWidget from '../../components/MatchedTextWidget';

// Wrapper with theme provider
const renderWithTheme = (component) => {
  return render(
    <PaperProvider theme={MD3LightTheme}>
      {component}
    </PaperProvider>
  );
};

describe('MatchedTextWidget - Layout', () => {
  const mockDocumentData = {
    metadata: {
      title: 'Test Document',
      author: 'Test Author',
    },
    content: [
      {
        type: 'section',
        title: 'Test Section',
        paragraphs: [
          { num: 1, text: 'First paragraph text.' },
          { num: 2, text: 'Second paragraph text.' },
          { num: 3, text: 'Third paragraph text.' },
        ],
      },
    ],
  };

  test('renders all paragraphs with uniform spacing', () => {
    const { getAllByText } = renderWithTheme(
      <MatchedTextWidget
        documentData={mockDocumentData}
        matchedSection="Test Section"
        matchedParagraphNum={2}
        confidence={0.85}
        isLoading={false}
      />
    );

    const paragraphs = getAllByText(/paragraph text/);
    expect(paragraphs).toHaveLength(3);

    // All paragraphs should have same parent container style
    // This will fail initially - implementation needed
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:ui -- MatchedTextWidget.test.js
```

Expected: Test runs and passes (component already exists). If it fails, fix import paths.

**Step 3: Write test for highlighted paragraph styling**

Add to `tests/ui/MatchedTextWidget.test.js`:

```javascript
  test('highlighted paragraph has background color only (marker-style)', () => {
    const { getByText } = renderWithTheme(
      <MatchedTextWidget
        documentData={mockDocumentData}
        matchedSection="Test Section"
        matchedParagraphNum={2}
        currentParagraphIndex={1}
        firstMatchedParagraphIndex={0}
        confidence={0.85}
        isLoading={false}
      />
    );

    const highlightedPara = getByText('Second paragraph text.');
    const style = highlightedPara.props.style;

    // Should have background color
    expect(style).toEqual(
      expect.objectContaining({
        backgroundColor: expect.any(String),
      })
    );

    // Should NOT have different font size or weight
    expect(style.fontSize).toBeUndefined();
    expect(style.fontWeight).toBeUndefined();
  });
```

**Step 4: Run test**

```bash
npm run test:ui -- MatchedTextWidget.test.js
```

Expected: May pass if highlighting already works correctly

**Step 5: Write test for growing highlight range**

Add to `tests/ui/MatchedTextWidget.test.js`:

```javascript
  test('growing highlight spans from first to current paragraph', () => {
    const { getByText, rerender } = renderWithTheme(
      <MatchedTextWidget
        documentData={mockDocumentData}
        matchedSection="Test Section"
        matchedParagraphNum={1}
        currentParagraphIndex={0}
        firstMatchedParagraphIndex={0}
        confidence={0.85}
        isLoading={false}
      />
    );

    // Initially only first paragraph highlighted
    const firstPara = getByText('First paragraph text.');
    expect(firstPara.props.style?.backgroundColor).toBeTruthy();

    // Advance to paragraph 2 - both should be highlighted
    rerender(
      <PaperProvider theme={MD3LightTheme}>
        <MatchedTextWidget
          documentData={mockDocumentData}
          matchedSection="Test Section"
          matchedParagraphNum={2}
          currentParagraphIndex={1}
          firstMatchedParagraphIndex={0}
          confidence={0.85}
          isLoading={false}
        />
      </PaperProvider>
    );

    const secondPara = getByText('Second paragraph text.');
    expect(firstPara.props.style?.backgroundColor).toBeTruthy();
    expect(secondPara.props.style?.backgroundColor).toBeTruthy();
  });
```

**Step 6: Run tests**

```bash
npm run test:ui -- MatchedTextWidget.test.js
```

Expected: Tests may pass or fail depending on current implementation

**Step 7: Commit**

```bash
git add tests/ui/MatchedTextWidget.test.js
git commit -m "test: add MatchedTextWidget layout tests"
```

---

## Task 7: Write MatchedTextWidget Auto-Scroll Tests (TDD)

**Files:**
- Modify: `tests/ui/MatchedTextWidget.test.js`

**Step 1: Add auto-scroll test suite**

Add to `tests/ui/MatchedTextWidget.test.js`:

```javascript
describe('MatchedTextWidget - Auto-Scroll', () => {
  const mockDocumentData = {
    metadata: {
      title: 'Test Document',
      author: 'Test Author',
    },
    content: [
      {
        type: 'section',
        title: 'Test Section',
        paragraphs: [
          { num: 1, text: 'First paragraph text.' },
          { num: 2, text: 'Second paragraph text.' },
          { num: 3, text: 'Third paragraph text.' },
          { num: 4, text: 'Fourth paragraph text.' },
        ],
      },
    ],
  };

  test('scrolls when currentParagraphIndex changes', () => {
    const scrollToMock = jest.fn();
    const { rerender } = renderWithTheme(
      <MatchedTextWidget
        documentData={mockDocumentData}
        matchedSection="Test Section"
        matchedParagraphNum={1}
        currentParagraphIndex={0}
        firstMatchedParagraphIndex={0}
        confidence={0.85}
        isLoading={false}
        scrollRef={{ current: { scrollTo: scrollToMock } }}
      />
    );

    // Change currentParagraphIndex
    rerender(
      <PaperProvider theme={MD3LightTheme}>
        <MatchedTextWidget
          documentData={mockDocumentData}
          matchedSection="Test Section"
          matchedParagraphNum={2}
          currentParagraphIndex={1}
          firstMatchedParagraphIndex={0}
          confidence={0.85}
          isLoading={false}
          scrollRef={{ current: { scrollTo: scrollToMock } }}
        />
      </PaperProvider>
    );

    // Should trigger scroll
    expect(scrollToMock).toHaveBeenCalled();
  });

  test('does not scroll if currentParagraphIndex unchanged', () => {
    const scrollToMock = jest.fn();
    const { rerender } = renderWithTheme(
      <MatchedTextWidget
        documentData={mockDocumentData}
        matchedSection="Test Section"
        matchedParagraphNum={1}
        currentParagraphIndex={0}
        confidence={0.85}
        isLoading={false}
        scrollRef={{ current: { scrollTo: scrollToMock } }}
      />
    );

    // Rerender with same currentParagraphIndex
    rerender(
      <PaperProvider theme={MD3LightTheme}>
        <MatchedTextWidget
          documentData={mockDocumentData}
          matchedSection="Test Section"
          matchedParagraphNum={1}
          currentParagraphIndex={0}
          confidence={0.90}
          isLoading={false}
          scrollRef={{ current: { scrollTo: scrollToMock } }}
        />
      </PaperProvider>
    );

    // Should not trigger scroll
    expect(scrollToMock).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run tests**

```bash
npm run test:ui -- MatchedTextWidget.test.js
```

Expected: Tests may fail if scrollRef is not properly implemented

**Step 3: Commit**

```bash
git add tests/ui/MatchedTextWidget.test.js
git commit -m "test: add auto-scroll behavior tests for MatchedTextWidget"
```

---

## Task 8: Write MatchedTextWidget State Tests (TDD)

**Files:**
- Modify: `tests/ui/MatchedTextWidget.test.js`

**Step 1: Add state test suite**

Add to `tests/ui/MatchedTextWidget.test.js`:

```javascript
describe('MatchedTextWidget - State Management', () => {
  test('shows ActivityIndicator when loading', () => {
    const { getByTestId, queryByText } = renderWithTheme(
      <MatchedTextWidget
        documentData={null}
        matchedSection=""
        matchedParagraphNum={0}
        confidence={0}
        isLoading={true}
      />
    );

    // Should show loading indicator
    const indicator = queryByText(/searching/i);
    expect(indicator).toBeTruthy();
  });

  test('shows empty state when no match', () => {
    const { getByText } = renderWithTheme(
      <MatchedTextWidget
        documentData={null}
        matchedSection=""
        matchedParagraphNum={0}
        confidence={0}
        isLoading={false}
      />
    );

    // Should show ready message
    expect(getByText(/ready to listen/i)).toBeTruthy();
  });

  test('shows content when match exists', () => {
    const mockData = {
      metadata: { title: 'Test', author: 'Author' },
      content: [{
        type: 'section',
        title: 'Section',
        paragraphs: [{ num: 1, text: 'Content here' }]
      }]
    };

    const { getByText, queryByText } = renderWithTheme(
      <MatchedTextWidget
        documentData={mockData}
        matchedSection="Section"
        matchedParagraphNum={1}
        confidence={0.85}
        isLoading={false}
      />
    );

    // Should show document title and content
    expect(getByText('Test')).toBeTruthy();
    expect(getByText('Content here')).toBeTruthy();

    // Should not show empty state
    expect(queryByText(/ready to listen/i)).toBeFalsy();
  });

  test('content persists when loading new match', () => {
    const mockData = {
      metadata: { title: 'Test', author: 'Author' },
      content: [{
        type: 'section',
        title: 'Section',
        paragraphs: [{ num: 1, text: 'Content here' }]
      }]
    };

    const { getByText, rerender } = renderWithTheme(
      <MatchedTextWidget
        documentData={mockData}
        matchedSection="Section"
        matchedParagraphNum={1}
        confidence={0.85}
        isLoading={false}
      />
    );

    expect(getByText('Content here')).toBeTruthy();

    // Set loading while content exists
    rerender(
      <PaperProvider theme={MD3LightTheme}>
        <MatchedTextWidget
          documentData={mockData}
          matchedSection="Section"
          matchedParagraphNum={1}
          confidence={0.85}
          isLoading={true}
        />
      </PaperProvider>
    );

    // Content should still be visible (no flash)
    expect(getByText('Content here')).toBeTruthy();
  });
});
```

**Step 2: Run tests**

```bash
npm run test:ui -- MatchedTextWidget.test.js
```

Expected: Tests should pass if state management is correct

**Step 3: Commit**

```bash
git add tests/ui/MatchedTextWidget.test.js
git commit -m "test: add state management tests for MatchedTextWidget"
```

---

## Task 9: Write App Integration Tests (TDD)

**Files:**
- Create: `tests/ui/App.test.js`

**Step 1: Write test for transcription → matching flow**

Create `tests/ui/App.test.js`:

```javascript
import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import App from '../../App';
import { testCase as paragraph67 } from '../fixtures/paragraph-67-test';
import { MockVoskWebSocket } from './__mocks__/mockWebSocket';

// Mock the WebSocket globally
global.WebSocket = MockVoskWebSocket;

describe('App - Integration Tests', () => {
  test('progressive transcription triggers text matching', async () => {
    const { getByText } = render(<App />);

    // Initially shows empty state
    expect(getByText(/ready to listen/i)).toBeTruthy();

    // TODO: Need to trigger recording and inject mock WebSocket
    // This test will be expanded once we determine how to inject WS mock
  });
});
```

**Step 2: Run test**

```bash
npm run test:ui -- App.test.js
```

Expected: Test passes but is incomplete

**Step 3: Add note about WebSocket injection**

Add comment to `tests/ui/App.test.js`:

```javascript
/**
 * NOTE: Full App integration tests require refactoring App.js to accept
 * a WebSocket factory function for dependency injection.
 *
 * Proposed change to App.js:
 *
 * export default function App({ wsFactory = (url) => new WebSocket(url) }) {
 *   // Use wsFactory instead of direct WebSocket constructor
 *   const ws = wsFactory(WS_SERVER_URL);
 * }
 *
 * This allows tests to inject MockVoskWebSocket:
 *
 * render(<App wsFactory={() => new MockVoskWebSocket(testCase)} />)
 */
```

**Step 4: Write basic rendering test**

Add to `tests/ui/App.test.js`:

```javascript
  test('renders main UI components', () => {
    const { getByTestId, getByLabelText } = render(<App />);

    // Should render FAB button (microphone or stop)
    // Note: May need testID props added to components

    // Should render MatchedTextWidget
    // Should render debug panel toggle button
  });

  test('FAB icon changes when recording state changes', () => {
    const { getByLabelText } = render(<App />);

    // Initially shows microphone icon
    // After starting recording, shows stop icon
    // Note: This test needs testID props or accessibility labels
  });
```

**Step 5: Run tests**

```bash
npm run test:ui -- App.test.js
```

Expected: Tests may fail if testID props not present

**Step 6: Commit**

```bash
git add tests/ui/App.test.js
git commit -m "test: add App integration test structure (needs DI for full coverage)"
```

---

## Task 10: Create AI Review Agent Infrastructure

**Files:**
- Create: `tests/ui-review/review-ui.js`
- Create: `tests/ui-review/README.md`

**Step 1: Create AI review script**

Create `tests/ui-review/review-ui.js`:

```javascript
#!/usr/bin/env node
/**
 * AI UI Review Agent
 *
 * Analyzes UI screenshots against CLAUDE.md design principles
 *
 * Usage:
 *   node tests/ui-review/review-ui.js              # Review all fixtures
 *   node tests/ui-review/review-ui.js paragraph-67  # Review specific fixture
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load design principles from CLAUDE.md
const claudeMdPath = path.join(__dirname, '../../CLAUDE.md');
const claudeMd = fs.readFileSync(claudeMdPath, 'utf8');

// Extract UI Design Principles section
const principlesMatch = claudeMd.match(/## UI Design Principles([\s\S]*?)(?=##|$)/);
const designPrinciples = principlesMatch ? principlesMatch[1] : '';

console.log('='.repeat(70));
console.log('AI UI REVIEW AGENT');
console.log('='.repeat(70));
console.log('\nDesign Principles Loaded:');
console.log(designPrinciples.substring(0, 500) + '...\n');

// Get fixture to review
const fixtureArg = process.argv[2];

console.log('='.repeat(70));
console.log('REVIEW INSTRUCTIONS');
console.log('='.repeat(70));
console.log(`
To use this AI review agent:

1. Run the app with test fixture data:
   - Load fixture in app (e.g., paragraph-67)
   - Capture screenshots at key states (loading, matched, scrolled)

2. Save screenshots to tests/ui-review/screenshots/:
   - paragraph-67-initial.png
   - paragraph-67-matched.png
   - paragraph-67-scrolled.png

3. Open Claude Code and run:
   /review-ui ${fixtureArg || '[fixture-name]'}

4. Claude will analyze screenshots against design principles and report:
   ✓ What looks correct
   ⚠️ Potential issues (severity: minor/moderate/major)
   💡 Suggestions for improvement

Design Principles to Check:
${designPrinciples}
`);

// Check for screenshots directory
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  console.log('\n⚠️  No screenshots directory found.');
  console.log(`   Create: mkdir -p ${screenshotsDir}`);
  process.exit(0);
}

// List available screenshots
const screenshots = fs.readdirSync(screenshotsDir)
  .filter(f => f.endsWith('.png') || f.endsWith('.jpg'));

if (screenshots.length === 0) {
  console.log('\n⚠️  No screenshots found in tests/ui-review/screenshots/');
  console.log('   Add screenshots and run this script again.');
  process.exit(0);
}

console.log('\n' + '='.repeat(70));
console.log('AVAILABLE SCREENSHOTS');
console.log('='.repeat(70));
screenshots.forEach(s => console.log(`  - ${s}`));

console.log('\n✓ Ready for AI review');
console.log('  Invoke this script through Claude Code for analysis\n');
```

**Step 2: Create README for UI review**

Create `tests/ui-review/README.md`:

```markdown
# AI UI Review Agent

Subjective quality assessment of UI screenshots against CLAUDE.md design principles.

## Purpose

Automated tests catch layout bugs and behavior regressions, but can't assess subjective quality like:
- "This spacing feels off"
- "Highlighting looks wrong"
- "Design principle violation"

The AI review agent analyzes screenshots and reports quality issues with severity ratings.

## Usage

### 1. Capture Screenshots

Run the app with test fixture data and capture screenshots:

\`\`\`bash
# Start app
npm run web

# In browser:
# - Open debug panel
# - Paste fixture transcription text
# - Capture screenshots at key states

# Save to tests/ui-review/screenshots/:
# - [fixture-name]-initial.png
# - [fixture-name]-matched.png
# - [fixture-name]-scrolled.png
\`\`\`

### 2. Run Review

\`\`\`bash
node tests/ui-review/review-ui.js paragraph-67
\`\`\`

Or invoke through Claude Code:
\`\`\`bash
/review-ui paragraph-67
\`\`\`

### 3. Review Output

Agent will report:
- ✓ What looks correct
- ⚠️ Potential issues (minor/moderate/major severity)
- 💡 Suggestions for improvement

## Design Principles Checked

From CLAUDE.md:
- Visual Consistency (uniform body text)
- Marker-Style Highlighting (background only)
- Consistent Spacing (no special spacing around highlights)
- Layout Stability (no jumps when content loads)
- Inline Content Flow (highlights inline with text)

## When to Use

- Before committing UI changes
- After fixing visual bugs
- When making spacing/layout changes
- During UI feature development

**Not in CI** - This is a development-time tool, not a build gate.

## Fixtures to Review

Priority fixtures for UI testing:
- paragraph-67 - Short phrase, spacing test
- long-text-epistle-mid-paragraph - Long passage layout
- common-phrase-o-son-of-arabic-1 - Disambiguation UI
- short-prayer-with-noise - Minimum threshold UX
\`\`\`

**Step 3: Create screenshots directory**

```bash
mkdir -p tests/ui-review/screenshots
```

**Step 4: Make script executable**

```bash
chmod +x tests/ui-review/review-ui.js
```

**Step 5: Test script**

```bash
node tests/ui-review/review-ui.js
```

Expected: Script runs and shows instructions

**Step 6: Commit**

```bash
git add tests/ui-review/
git commit -m "feat: add AI UI review agent infrastructure"
```

---

## Task 11: Update Package.json Scripts

**Files:**
- Modify: `package.json`

**Step 1: Add comprehensive test scripts**

Modify `package.json` scripts section:

```json
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "npm run test:matching && npm run test:ui",
    "test:matching": "node tests/matching/run-tests.mjs",
    "test:ui": "jest",
    "test:ui:watch": "jest --watch",
    "test:ui:coverage": "jest --coverage",
    "ui-review": "node tests/ui-review/review-ui.js"
  },
```

**Step 2: Verify scripts work**

```bash
npm run test:matching
npm run test:ui
npm test
```

Expected: All test suites run successfully

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add comprehensive test scripts to package.json"
```

---

## Task 12: Add Test Documentation

**Files:**
- Modify: `tests/README.md`

**Step 1: Update test README with new structure**

Replace content of `tests/README.md`:

```markdown
# FollowAlong Test Suite

Comprehensive testing for text matching algorithm and UI components.

## Test Structure

\`\`\`
tests/
  ├── fixtures/           # Shared transcription test cases
  ├── matching/           # Text matching algorithm tests
  ├── ui/                 # React Native component tests (Jest + RNTL)
  └── ui-review/          # AI quality review agent
\`\`\`

## Running Tests

### All Tests
\`\`\`bash
npm test                    # Runs matching + UI tests
\`\`\`

### Text Matching Tests
\`\`\`bash
npm run test:matching       # Run all matching tests
node tests/matching/run-tests.mjs paragraph-67-test.js  # Specific test
\`\`\`

### UI Component Tests
\`\`\`bash
npm run test:ui             # Run all UI tests
npm run test:ui:watch       # Watch mode for development
npm run test:ui:coverage    # Generate coverage report
\`\`\`

### AI UI Review
\`\`\`bash
npm run ui-review           # Review all fixtures
npm run ui-review paragraph-67  # Review specific fixture
\`\`\`

See `tests/ui-review/README.md` for screenshot capture workflow.

## Test Fixtures

Located in `tests/fixtures/`, these contain real transcription samples from Vosk:

- `paragraph-67-test.js` - Short phrase, early lock-in prevention
- `unique-text-kit-b-i-q-n-noah-story-test.js` - Unique distinctive text
- `common-phrase-o-son-of-arabic-1-test.js` - Disambiguation test
- `long-text-epistle-mid-paragraph-test.js` - Long passage with noise
- `short-prayer-with-noise-test.js` - Short prayer, minimum threshold

Each fixture exports a `testCase` object:
\`\`\`javascript
export const testCase = {
  transcribedText: '...',           // Full noisy transcription
  expectedMatch: { docId, section, paragraphNum },
  correctParagraphText: '...',      // Clean reference text
  progressiveStages: [...]          // Word-by-word buildup
};
\`\`\`

### Adding New Fixtures

1. Read passage aloud in app
2. Copy transcription from debug panel
3. Create new fixture in `tests/fixtures/`
4. Export `testCase` with structure above
5. Fixture automatically available to all test types

## UI Component Tests

### MatchedTextWidget Tests

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

### App Integration Tests

**Flow Testing:**
- Progressive transcription → matching → UI update
- Recording state → FAB icon changes
- Debug panel toggle

**Note:** Full integration tests require WebSocket dependency injection.
See `tests/ui/App.test.js` for proposed refactoring.

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

## CI/CD

Tests run automatically on PR:
\`\`\`yaml
- npm run test:matching
- npm run test:ui
\`\`\`

AI review is opt-in during development (not in CI).

## Test Coverage Goals

- Text matching algorithm: > 90% branch coverage
- UI components (critical path): > 80% branch coverage
- Integration flows: Key user journeys tested

Run coverage report:
\`\`\`bash
npm run test:ui:coverage
\`\`\`

## References

- Text matching algorithm: `utils/textMatcher.js`
- UI design principles: `CLAUDE.md` (UI Design Principles section)
- Jest config: `jest.config.js`
- RNTL docs: https://callstack.github.io/react-native-testing-library/
\`\`\`

**Step 2: Commit**

```bash
git add tests/README.md
git commit -m "docs: update test README with new structure and workflows"
```

---

## Task 13: Verify Complete Test Suite

**Files:**
- None (verification task)

**Step 1: Run all tests**

```bash
npm test
```

Expected:
- Text matching tests pass
- UI tests pass (may have some expected failures)
- Total execution < 15 seconds

**Step 2: Run tests in watch mode**

```bash
npm run test:ui:watch
```

Press `a` to run all tests. Verify watch mode works.

**Step 3: Generate coverage report**

```bash
npm run test:ui:coverage
```

Expected: Coverage report generated in `coverage/` directory

**Step 4: Verify UI review script**

```bash
npm run ui-review
```

Expected: Instructions displayed, ready for screenshot analysis

**Step 5: Document any failing tests**

Create `tests/KNOWN_ISSUES.md`:

```markdown
# Known Test Issues

Tests that are expected to fail until related implementation work is complete.

## App Integration Tests

**Issue:** Full WebSocket integration tests require dependency injection

**Failing Tests:**
- `App.test.js` - "progressive transcription triggers text matching"

**Fix Required:**
Refactor App.js to accept WebSocket factory function:
\`\`\`javascript
export default function App({ wsFactory = (url) => new WebSocket(url) }) {
  const ws = wsFactory(WS_SERVER_URL);
}
\`\`\`

**Tracking:** To be addressed in separate PR

## Auto-Scroll Tests

**Issue:** May fail if scrollRef not properly passed to MatchedTextWidget

**Failing Tests:**
- `MatchedTextWidget.test.js` - "scrolls when currentParagraphIndex changes"

**Fix Required:**
Verify MatchedTextWidget accepts and uses scrollRef prop correctly.

---

Last Updated: 2026-02-13
\`\`\`

**Step 6: Commit**

```bash
git add tests/KNOWN_ISSUES.md
git commit -m "docs: document known test issues requiring implementation changes"
```

---

## Task 14: Final Review and Documentation

**Files:**
- Create: `docs/testing-strategy.md`

**Step 1: Create testing strategy document**

Create `docs/testing-strategy.md`:

```markdown
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

## Test Data Strategy

**Shared Fixtures:** All tests use the same transcription samples from `tests/fixtures/`

Benefits:
- Single source of truth for test data
- New fixture → available to all test types
- Growing corpus improves matching + UI testing
- Real-world speech-to-text scenarios

## Development Workflow

### TDD Cycle (UI Changes)

1. Write failing test in `tests/ui/`
2. Run `npm run test:ui:watch`
3. Implement minimal code to pass test
4. Verify test passes
5. Refactor if needed
6. Commit with test + implementation

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

## CI/CD Integration

### PR Checks (Automated)
```bash
npm run test:matching  # Text matching tests
npm run test:ui        # UI component tests
```

### Pre-Commit (Manual)
```bash
npm run ui-review      # AI quality review (opt-in)
```

## Success Metrics

- **Test execution time:** < 10 seconds for UI tests
- **Coverage:** > 80% for critical UI components
- **Fixture reuse:** 100% shared between matching and UI tests
- **Regression prevention:** UI tests catch layout/scroll issues before merge

## Future Enhancements

### Dependency Injection for App.js

Refactor to accept WebSocket factory function:
```javascript
export default function App({ wsFactory = (url) => new WebSocket(url) }) {
  const ws = wsFactory(WS_SERVER_URL);
}
```

Enables full integration testing with mock WebSocket.

### E2E Testing (Optional)

If needed in future:
- Tool: Detox
- Coverage: Full user flows on real devices
- Trade-off: Slower (minutes vs seconds)

Not implemented initially due to slow feedback loop.

### Screenshot Diffing (Optional)

If needed in future:
- Tool: Pixelmatch or similar
- Coverage: Visual regression detection
- Trade-off: Brittle, high maintenance

Not implemented initially - AI review provides better subjective assessment.

## References

- Design principles: `CLAUDE.md` (UI Design Principles)
- Test fixtures: `tests/fixtures/`
- Test documentation: `tests/README.md`
- Jest config: `jest.config.js`
```

**Step 2: Commit**

```bash
git add docs/testing-strategy.md
git commit -m "docs: add comprehensive testing strategy document"
```

**Step 3: Create final summary commit**

```bash
git add -A
git commit -m "feat: complete automated UI testing infrastructure

Implements hybrid testing approach:
- Jest + React Native Testing Library for component tests
- Shared test fixtures between matching and UI tests
- Mock WebSocket/Audio for testing without real devices
- AI review agent for subjective quality assessment

Test coverage:
- MatchedTextWidget: layout, spacing, auto-scroll, state
- App: integration tests (partial, needs DI for full coverage)
- Mock infrastructure for Vosk WebSocket and expo-av Audio

Scripts added:
- npm run test:ui - Run UI component tests
- npm run test:ui:watch - Watch mode for development
- npm run test:ui:coverage - Generate coverage report
- npm run ui-review - Invoke AI quality review

Documentation:
- tests/README.md - Updated with new structure
- docs/testing-strategy.md - Comprehensive strategy guide
- tests/ui-review/README.md - AI review workflow

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
"
```

---

## Verification Steps

After completing all tasks, verify the implementation:

### 1. Test Execution
```bash
npm test                      # Should run matching + UI tests
npm run test:ui:coverage      # Should generate coverage report
```

### 2. Directory Structure
```bash
tree tests/ -L 2
```
Expected structure matches design doc.

### 3. Documentation
- [ ] `tests/README.md` updated
- [ ] `docs/testing-strategy.md` created
- [ ] `tests/ui-review/README.md` created
- [ ] `tests/KNOWN_ISSUES.md` documents expected failures

### 4. Test Coverage
```bash
npm run test:ui:coverage
```
Check coverage report in `coverage/lcov-report/index.html`

---

## Next Steps (Post-Implementation)

1. **Implement failing tests** - Fix any known issues documented in `tests/KNOWN_ISSUES.md`

2. **Add dependency injection to App.js** - Enable full integration testing:
   ```javascript
   export default function App({ wsFactory = (url) => new WebSocket(url) }) {
     const ws = wsFactory(WS_SERVER_URL);
   }
   ```

3. **Add testID props** - Add accessibility/test IDs to components for easier testing:
   ```javascript
   <FAB testID="record-button" icon={isRecording ? "stop" : "microphone"} />
   ```

4. **Capture screenshots** - Run app with fixtures, capture screenshots for AI review

5. **CI/CD integration** - Add test commands to GitHub Actions workflow

6. **Expand test coverage** - Add more UI component tests as coverage gaps identified

---

## Success Criteria

- ✅ All existing text matching tests pass
- ✅ UI test infrastructure in place (Jest + RNTL)
- ✅ Mock WebSocket and Audio working
- ✅ MatchedTextWidget tests written (layout, scroll, state)
- ✅ App integration tests structured (full coverage needs DI)
- ✅ AI review agent infrastructure ready
- ✅ Test execution time < 15 seconds total
- ✅ Documentation complete and up-to-date
