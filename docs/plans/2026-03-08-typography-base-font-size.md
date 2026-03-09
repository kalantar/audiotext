# Typography: Central Font Size Constants Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix oversized iOS text (issue #48) by reducing body font from 18→16px and centralizing all font-size decisions in `utils/typography.js` so issue #49 (user-adjustable size) only requires touching one constant.

**Architecture:** New `utils/typography.js` exports three constants (`BASE_FONT_SIZE`, `BODY_LINE_HEIGHT`, `SMALL_FONT_SIZE`). `App.js` and `MatchedTextWidget.js` import and use them. No new UI, no new state.

**Tech Stack:** React Native, Jest + @testing-library/react-native

---

### Task 1: Create `utils/typography.js` with constants

**Files:**
- Create: `utils/typography.js`
- Test: `tests/ui/typography.test.js`

**Step 1: Write the failing test**

Create `tests/ui/typography.test.js`:

```js
import {
  BASE_FONT_SIZE,
  BODY_LINE_HEIGHT,
  SMALL_FONT_SIZE,
} from '../../utils/typography';

test('BASE_FONT_SIZE is 16', () => {
  expect(BASE_FONT_SIZE).toBe(16);
});

test('BODY_LINE_HEIGHT is BASE_FONT_SIZE * 1.5', () => {
  expect(BODY_LINE_HEIGHT).toBe(BASE_FONT_SIZE * 1.5);
});

test('SMALL_FONT_SIZE is BASE_FONT_SIZE - 2', () => {
  expect(SMALL_FONT_SIZE).toBe(BASE_FONT_SIZE - 2);
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:ui -- --testPathPattern=typography
```

Expected: FAIL — "Cannot find module '../../utils/typography'"

**Step 3: Create `utils/typography.js`**

```js
// utils/typography.js
// Central font-size constants for the reading interface.
// BASE_FONT_SIZE is the single value to change for issue #49 (user text-size preference).
export const BASE_FONT_SIZE = 16;
export const BODY_LINE_HEIGHT = BASE_FONT_SIZE * 1.5;  // 24 — standard 1.5× reading line height
export const SMALL_FONT_SIZE = BASE_FONT_SIZE - 2;     // 14 — author, labels, metadata
```

**Step 4: Run test to verify it passes**

```bash
npm run test:ui -- --testPathPattern=typography
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add utils/typography.js tests/ui/typography.test.js
git commit -m "feat: add utils/typography.js with BASE_FONT_SIZE constants"
```

---

### Task 2: Update `MatchedTextWidget.js` body text style

**Files:**
- Modify: `components/MatchedTextWidget.js` — `textContent` style (around line 386)
- Test: `tests/ui/MatchedTextWidget.test.js`

**Step 1: Write a failing test**

Add this test to `tests/ui/MatchedTextWidget.test.js` (inside `describe('MatchedTextWidget - Layout', ...)`):

```js
test('body text uses BASE_FONT_SIZE (16px)', () => {
  const { getByText } = renderWithTheme(
    <MatchedTextWidget
      matchedDocument={mockDocument}
      fullContent={mockFullContent}
      highlightPosition={null}
      confidence={0.5}
      isLoading={false}
      isMatching={false}
    />
  );
  // The text content is split across multiple Text nodes when highlighted;
  // query the first paragraph portion
  const content = getByText(/First paragraph/);
  const style = StyleSheet.flatten(content.props.style);
  expect(style.fontSize).toBe(16);
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:ui -- --testPathPattern=MatchedTextWidget
```

Expected: FAIL — `expect(received).toBe(expected)` showing 18 vs 16

**Step 3: Update `MatchedTextWidget.js`**

At the top of the file, add the import:
```js
import { BASE_FONT_SIZE, BODY_LINE_HEIGHT } from '../utils/typography';
```

In the `StyleSheet.create({...})` block, update `textContent`:
```js
textContent: {
  fontFamily: 'Georgia',
  fontSize: BASE_FONT_SIZE,      // was 18
  lineHeight: BODY_LINE_HEIGHT,  // was 28
  color: '#2c2c2c',
},
```

**Step 4: Run tests to verify they pass**

```bash
npm run test:ui -- --testPathPattern=MatchedTextWidget
```

Expected: all tests PASS

**Step 5: Commit**

```bash
git add components/MatchedTextWidget.js tests/ui/MatchedTextWidget.test.js
git commit -m "fix: reduce body text from 18→16px using BASE_FONT_SIZE constant (#48)"
```

---

### Task 3: Update `App.js` theme font overrides

**Files:**
- Modify: `App.js` — `customTheme.fonts` (around line 60)

No new test needed: the theme overrides now match MD3 defaults for size; the import
of the constants is the meaningful change (wires App.js into the typography system for
when #49 arrives).

**Step 1: Add import to `App.js`**

At the top of `App.js`, alongside the other utility imports:
```js
import { BASE_FONT_SIZE, BODY_LINE_HEIGHT, SMALL_FONT_SIZE } from './utils/typography';
```

**Step 2: Update `customTheme.fonts`**

Replace:
```js
  fonts: {
    ...MD3LightTheme.fonts,
    bodyLarge: {
      ...MD3LightTheme.fonts.bodyLarge,
      fontFamily: 'Georgia',
      fontSize: 18,
      lineHeight: 28,
    },
    bodyMedium: {
      ...MD3LightTheme.fonts.bodyMedium,
      fontFamily: 'Georgia',
      fontSize: 16,
      lineHeight: 24,
    },
  },
```

With:
```js
  fonts: {
    ...MD3LightTheme.fonts,
    bodyLarge: {
      ...MD3LightTheme.fonts.bodyLarge,
      fontFamily: 'Georgia',
      fontSize: BASE_FONT_SIZE,
      lineHeight: BODY_LINE_HEIGHT,
    },
    bodyMedium: {
      ...MD3LightTheme.fonts.bodyMedium,
      fontFamily: 'Georgia',
      fontSize: SMALL_FONT_SIZE,
    },
  },
```

**Step 3: Run all tests to verify nothing broke**

```bash
npm run test:ui
```

Expected: all tests PASS

**Step 4: Commit**

```bash
git add App.js
git commit -m "fix: wire App.js theme font overrides to typography constants (#48)"
```

---

### Task 4: Open PR and close issue

**Step 1: Push branch and create PR**

```bash
git push origin <branch>
gh pr create \
  --title "fix: reduce font size to 16px via central typography constants" \
  --body "Fixes #48. Lays groundwork for #49.

- New \`utils/typography.js\`: BASE_FONT_SIZE=16, BODY_LINE_HEIGHT=24, SMALL_FONT_SIZE=14
- MatchedTextWidget body text: 18px → 16px, line-height 28 → 24
- App.js theme overrides updated to use constants
- For #49: change BASE_FONT_SIZE (multiply by user scale factor); all consumers update automatically"
```
