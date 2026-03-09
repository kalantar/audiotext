# Web Error Snackbar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `Alert.alert` in `handleSpeechError` with a React Native Paper `Snackbar` so errors are visible on web (where `Alert.alert` is a no-op).

**Architecture:** Add `errorMessage` state to `App.js`. `handleSpeechError` sets it instead of calling `Alert.alert`. A `<Snackbar>` component reads that state and auto-dismisses after 4 seconds. No changes outside `App.js` except updating existing tests.

**Tech Stack:** React Native Paper (`Snackbar`), React Native (`useState`), Jest/Testing Library

**Design doc:** `docs/plans/2026-03-09-web-error-snackbar-design.md`

---

### Task 1: Update tests to expect Snackbar instead of Alert

**Files:**
- Modify: `tests/ui/NativeSTT.test.js:13,44,137,147,157,167`

The existing tests spy on `Alert.alert` to detect errors. With the Snackbar approach, errors appear as rendered text. Update the four error-related tests to check for visible Snackbar text instead of `Alert.alert` calls.

**Step 1: Run the current tests to confirm they pass**

```bash
npm run test:ui
```

Expected: 49/49 pass. This is the baseline before any changes.

**Step 2: Update the test file**

In `tests/ui/NativeSTT.test.js`:

Remove the `Alert` import (line 13) and the `jest.spyOn(Alert, 'alert')` call (line 44):

```js
// Remove this line:
import { Alert } from 'react-native';

// Remove this line from beforeEach:
jest.spyOn(Alert, 'alert').mockImplementation(() => {});
```

Update the four error assertion tests:

```js
// BEFORE (line ~137):
test('permission denied shows Permission Required alert and returns to idle', async () => {
  ExpoSpeechRecognitionModule.requestPermissionsAsync.mockResolvedValue({ granted: false });
  const { getByText } = render(<App />);
  await act(async () => { fireEvent.press(getByText('Record')); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
  expect(Alert.alert).toHaveBeenCalledWith('Permission Required', expect.any(String));
  expect(getByText('Record')).toBeTruthy();
});

// AFTER:
test('permission denied shows error snackbar and returns to idle', async () => {
  ExpoSpeechRecognitionModule.requestPermissionsAsync.mockResolvedValue({ granted: false });
  const { getByText, queryByText } = render(<App />);
  await act(async () => { fireEvent.press(getByText('Record')); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
  expect(queryByText(/permission/i)).toBeTruthy(); // Snackbar shows permission error
  expect(getByText('Record')).toBeTruthy(); // FAB returned to idle
});
```

```js
// BEFORE (line ~147):
test('no-speech error is silent — no alert shown, recording continues', async () => {
  const { getByText } = render(<App />);
  await act(async () => { fireEvent.press(getByText('Record')); });
  await act(async () => { fireError('no-speech'); });
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(getByText('Stop')).toBeTruthy();
});

// AFTER:
test('no-speech error is silent — no snackbar shown, recording continues', async () => {
  const { getByText, queryByTestId } = render(<App />);
  await act(async () => { fireEvent.press(getByText('Record')); });
  await act(async () => { fireError('no-speech'); });
  expect(queryByTestId('error-snackbar')).toBeFalsy(); // no snackbar
  expect(getByText('Stop')).toBeTruthy();
});
```

```js
// BEFORE (line ~157):
test('aborted error is silent — no alert shown, recording continues', async () => {
  const { getByText } = render(<App />);
  await act(async () => { fireEvent.press(getByText('Record')); });
  await act(async () => { fireError('aborted'); });
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(getByText('Stop')).toBeTruthy();
});

// AFTER:
test('aborted error is silent — no snackbar shown, recording continues', async () => {
  const { getByText, queryByTestId } = render(<App />);
  await act(async () => { fireEvent.press(getByText('Record')); });
  await act(async () => { fireError('aborted'); });
  expect(queryByTestId('error-snackbar')).toBeFalsy(); // no snackbar
  expect(getByText('Stop')).toBeTruthy();
});
```

```js
// BEFORE (line ~167):
test('network error shows Recognition Error alert and returns to idle', async () => {
  const { getByText } = render(<App />);
  await act(async () => { fireEvent.press(getByText('Record')); });
  await act(async () => { fireError('network'); });
  expect(Alert.alert).toHaveBeenCalledWith('Recognition Error', expect.any(String));
  expect(getByText('Record')).toBeTruthy();
});

// AFTER:
test('network error shows error snackbar and returns to idle', async () => {
  const { getByText, queryByTestId } = render(<App />);
  await act(async () => { fireEvent.press(getByText('Record')); });
  await act(async () => { fireError('network'); });
  expect(queryByTestId('error-snackbar')).toBeTruthy(); // Snackbar visible
  expect(getByText('Record')).toBeTruthy(); // FAB returned to idle
});
```

**Step 3: Run the tests to confirm they now fail**

```bash
npm run test:ui
```

Expected: 4 tests fail (the ones just updated). This confirms the tests are driving the implementation.

**Step 4: Commit the failing tests**

```bash
git add tests/ui/NativeSTT.test.js
git commit -m "test: update error tests to expect Snackbar instead of Alert for issue #50"
```

---

### Task 2: Implement Snackbar in App.js

**Files:**
- Modify: `App.js`

**Step 1: Add `Snackbar` to the react-native-paper import**

Find the existing Paper import line (near the top of `App.js`):

```js
// Before:
import { Provider as PaperProvider, MD3LightTheme, FAB, IconButton, Portal, Modal } from 'react-native-paper';

// After:
import { Provider as PaperProvider, MD3LightTheme, FAB, IconButton, Portal, Modal, Snackbar } from 'react-native-paper';
```

**Step 2: Remove `Alert` from the React Native import**

```js
// Before:
import { StyleSheet, Text, View, Alert, ScrollView, Platform, SafeAreaView } from 'react-native';

// After:
import { StyleSheet, Text, View, ScrollView, Platform, SafeAreaView } from 'react-native';
```

**Step 3: Add `errorMessage` state**

After the existing `useState` declarations (around line 130), add:

```js
const [errorMessage, setErrorMessage] = useState(null);
```

**Step 4: Update `handleSpeechError`**

Replace the `Alert.alert(...)` call with `setErrorMessage(message)`. Remove the `isPermissionError` logic (not needed — Snackbar has no title/body split):

```js
const handleSpeechError = useCallback((err) => {
  isRecordingActiveRef.current = false;
  isMatchingInProgressRef.current = false;
  if (matchCancelTokenRef.current) matchCancelTokenRef.current.cancelled = true;
  setIsRecording(false);
  performTextMatch.cancel();
  const message = err?.message ?? String(err) ?? 'An unknown error occurred.';
  setErrorMessage(message);
}, [performTextMatch]);
```

**Step 5: Add `<Snackbar>` to JSX**

Place it inside `<PaperProvider>`, after the `<Portal>` block, at the bottom:

```jsx
<Snackbar
  testID="error-snackbar"
  visible={errorMessage !== null}
  onDismiss={() => setErrorMessage(null)}
  duration={4000}
  action={{ label: 'Dismiss', onPress: () => setErrorMessage(null) }}
>
  {errorMessage}
</Snackbar>
```

The full JSX structure becomes:

```jsx
return (
  <PaperProvider theme={customTheme}>
    <SafeAreaView style={styles.safeArea}>
      {/* ... existing content ... */}
    </SafeAreaView>

    <Portal>
      <Modal {/* ... existing modal ... */} />
    </Portal>

    <Snackbar
      testID="error-snackbar"
      visible={errorMessage !== null}
      onDismiss={() => setErrorMessage(null)}
      duration={4000}
      action={{ label: 'Dismiss', onPress: () => setErrorMessage(null) }}
    >
      {errorMessage}
    </Snackbar>
  </PaperProvider>
);
```

**Step 6: Run the tests**

```bash
npm run test:ui
```

Expected: all 49 tests pass.

**Step 7: Commit**

```bash
git add App.js
git commit -m "fix: replace Alert.alert with Snackbar for web-compatible error display (issue #50)"
```

---

### Task 3: Manual verification on web

**Step 1: Make sure the Vosk server is NOT running**

```bash
# Don't run: cd server && npm start
```

**Step 2: Start the web app**

```bash
npm run web
```

**Step 3: Tap Record**

Expected: A Snackbar appears at the bottom of the screen with the message:
> "Could not connect to the transcription server at ws://localhost:2700. Make sure the server is running: cd server && npm start"

The Snackbar should auto-dismiss after 4 seconds or when Dismiss is tapped. The FAB should return to the Record state.

**Step 4: Close the issue**

```bash
gh issue close 50 --repo kalantar/audiotext --comment "Fixed: replaced Alert.alert with React Native Paper Snackbar for web-compatible error display."
```
