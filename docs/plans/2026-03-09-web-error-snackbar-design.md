# Design: Web Error Display via Snackbar (Issue #50)

## Problem

On web, `Alert.alert` from React Native is a no-op — `react-native-web` does not implement it. When the Vosk WebSocket server is unreachable, `handleSpeechError` in `App.js` correctly resets recording state but the `Alert.alert(...)` call silently drops the error message. The user sees the button revert to idle with no explanation.

The error message text is already correctly constructed in `vosk.js` — the fix is purely about surfacing it.

## Solution: React Native Paper Snackbar

Replace `Alert.alert` in `handleSpeechError` with a `Snackbar` component from `react-native-paper` (already a project dependency — no new packages needed).

## Changes (App.js only)

### State

Add one new piece of state:

```js
const [errorMessage, setErrorMessage] = useState(null);
```

### handleSpeechError

Remove `Alert.alert(...)`. Replace with `setErrorMessage(message)`. The permission-vs-recognition title distinction is dropped — Snackbar has no title/body split, so the message string alone is sufficient.

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

### JSX

Add a `<Snackbar>` inside `<PaperProvider>`, outside `<SafeAreaView>` (so it overlays everything):

```jsx
<Snackbar
  visible={errorMessage !== null}
  onDismiss={() => setErrorMessage(null)}
  duration={4000}
  action={{ label: 'Dismiss', onPress: () => setErrorMessage(null) }}
>
  {errorMessage}
</Snackbar>
```

Import `Snackbar` from `react-native-paper`.

## Testing

Existing tests that check `Alert.alert` calls need to be updated to assert on the rendered Snackbar or `errorMessage` state instead.

## What Is Not Changing

- `vosk.js` — error message text is already correct
- `useSpeechRecognition.js` — error propagation path is correct
- Recording state cleanup in `handleSpeechError` — untouched
- All other UI components and styles
