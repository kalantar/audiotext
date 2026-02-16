# Known Test Issues

Tests that are expected to fail or have limitations until related implementation work is complete.

## App Integration Tests

**Issue:** Full WebSocket integration tests require dependency injection

**Affected Tests:**
- `tests/ui/App.test.js` - "progressive transcription triggers text matching"

**Current State:**
- Test structure in place with placeholder
- Cannot fully test transcription → matching flow without injecting mock WebSocket

**Fix Required:**
Refactor App.js to accept WebSocket factory function:
```javascript
export default function App({ wsFactory = (url) => new WebSocket(url) }) {
  const ws = wsFactory(WS_SERVER_URL);
}
```

This allows tests to inject MockVoskWebSocket:
```javascript
render(<App wsFactory={() => new MockVoskWebSocket(testCase)} />)
```

**Tracking:** To be addressed in separate PR

**Workaround:** Component tests cover MatchedTextWidget independently

---

## Auto-Scroll Tests

**Issue:** Tests verify behavior but cannot fully test scroll positioning without DOM

**Affected Tests:**
- `tests/ui/MatchedTextWidget.test.js` - "scrolls when highlight position changes"

**Current State:**
- Tests verify that highlight position changes trigger re-renders
- Cannot verify actual scroll position in test environment

**Fix Required:**
- Tests are passing and validate the trigger mechanism
- Visual validation via manual testing or E2E tests

**Tracking:** Acceptable limitation for unit tests

**Workaround:** Manual verification + AI UI review with screenshots

---

## Missing testID Props

**Issue:** Some components lack testID/accessibility labels for easier testing

**Affected Tests:**
- `tests/ui/App.test.js` - "FAB icon changes when recording state changes"

**Current State:**
- Test structure in place but cannot reliably query FAB without testID

**Fix Required:**
Add testID props to key components:
```javascript
<FAB testID="record-button" icon={isRecording ? "stop" : "microphone"} />
<Portal>
  <Modal testID="debug-modal" visible={debugVisible}>
    ...
  </Modal>
</Portal>
```

**Tracking:** To be addressed in separate PR

**Workaround:** Tests pass with basic queries, full coverage pending testID addition

---

## E2E Testing

**Not Implemented:** End-to-end testing with real devices/browsers

**Why:**
- Fast feedback loop prioritized (unit/integration tests < 7 seconds)
- E2E tests would add significant CI time (minutes vs seconds)
- Current test coverage provides good regression protection

**If Needed in Future:**
- Tool: Detox (React Native)
- Coverage: Full user flows on iOS/Android/Web
- Trade-off: Slower feedback, more maintenance

**Decision:** Defer until regression rate indicates need

---

## Platform-Specific Behavior

**Not Tested:** iOS vs Android vs Web platform differences

**What's Covered:**
- Component logic and state management (platform-agnostic)
- Mock infrastructure works for all platforms

**What's Not Covered:**
- Audio recording differences (Web: WebM, Native: WAV)
- Platform-specific UI rendering
- Native module behavior

**Fix Required:**
- Add platform-specific test files (e.g., `App.test.ios.js`)
- Use platform mocks or conditional test execution

**Tracking:** Acceptable limitation for current scope

**Workaround:** Manual testing on each platform

---

## Test Summary Step (GitHub Actions)

**Issue:** Pre-existing bug in `.github/workflows/test.yml`

**Problem:**
The "Test Summary" step always shows "✅ All tests passed!" regardless of test results because `$?` checks the exit code of the previous command in the same shell, but each GitHub Actions step runs in a new shell.

**Current Code:**
```yaml
- name: Test Summary
  if: always()
  run: |
    if [ $? -eq 0 ]; then
      echo "✅ All tests passed!"
    else
      echo "❌ Some tests failed. Check the logs above."
      exit 1
    fi
```

**Impact:**
- CI still fails correctly when tests fail (npm test returns non-zero)
- Only the summary message is misleading
- Not caused by this PR (pre-existing)

**Fix:**
Use GitHub Actions step outputs or check exit codes properly

**Tracking:** Not blocking, can be fixed separately

---

Last Updated: 2026-02-16
