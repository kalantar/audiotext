# Design: Central Typography Constants (issues #48, #49 foundation)

## Problem

On iOS, body and title text in FollowAlong is visually larger than standard iOS apps.
Georgia at 18px with a 28px line-height reads noticeably bigger than San Francisco at
17pt (the iOS system body size), because serif fonts appear more prominent at equal
point sizes. The result: fewer words per screen, excessive whitespace, cramped reading.

## Goal

Reduce body text to a comfortable reading size that matches iOS conventions, and
centralize font-size decisions in one place so a future user-adjustable text size
setting (issue #49) requires changing one value, not a grep across multiple files.

## Non-goal

Issue #49 (user preference UI) is not implemented here. iOS Dynamic Type / system
accessibility text size is also not addressed — the app will control its own scale.

## Design

### New file: `utils/typography.js`

```js
export const BASE_FONT_SIZE = 16;
export const BODY_LINE_HEIGHT = BASE_FONT_SIZE * 1.5;  // 24
export const SMALL_FONT_SIZE = BASE_FONT_SIZE - 2;     // 14
```

`BASE_FONT_SIZE` is the single knob for issue #49. All derived values update
automatically when it changes.

### `App.js` — theme font overrides

Replace the existing hardcoded sizes with the new constants. Georgia family overrides
are kept; explicit `fontSize` values now reference the constants. Because MD3 defaults
for `bodyLarge` (16) and `bodyMedium` (14) happen to match, these overrides exist only
to enforce the Georgia typeface:

```js
bodyLarge:  { fontFamily: 'Georgia', fontSize: BASE_FONT_SIZE, lineHeight: BODY_LINE_HEIGHT }
bodyMedium: { fontFamily: 'Georgia', fontSize: SMALL_FONT_SIZE }
```

### `components/MatchedTextWidget.js` — `textContent` style

```js
textContent: {
  fontFamily: 'Georgia',
  fontSize: BASE_FONT_SIZE,       // was 18
  lineHeight: BODY_LINE_HEIGHT,   // was 28
  color: '#2c2c2c',
}
```

All other text in `MatchedTextWidget` (title, author, confidence label, empty state)
uses Paper text variants which inherit the theme — no additional changes needed.

The debug panel monospace font stays hardcoded at 12px; it is developer tooling, not
reading content, and should not scale with a future user text-size preference.

## Future: issue #49

When user-adjustable text size is implemented:

1. Store a scale factor (e.g. 0.9 / 1.0 / 1.1 / 1.2) in app settings.
2. Multiply `BASE_FONT_SIZE` by the scale factor before deriving the other constants.
3. Pass the derived constants through context or re-derive in the theme factory.

No changes to `MatchedTextWidget.js` or other consumers — they already reference the
constants.

## Files changed

| File | Change |
|---|---|
| `utils/typography.js` | New — exports `BASE_FONT_SIZE`, `BODY_LINE_HEIGHT`, `SMALL_FONT_SIZE` |
| `App.js` | Import constants; update `bodyLarge`/`bodyMedium` theme font overrides |
| `components/MatchedTextWidget.js` | Import constants; update `textContent` style |

## Size comparison

| Element | Before | After |
|---|---|---|
| Body text | Georgia 18px / 28px lh | Georgia 16px / 24px lh |
| Author / labels | 14px (MD3 bodyMedium default) | 14px (unchanged) |
| Theme bodyLarge | 18px override | 16px (matches MD3 default) |
| Theme bodyMedium | 16px override | 14px (matches MD3 default) |
