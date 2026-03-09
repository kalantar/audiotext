# Design: Fix iOS View Pane Too Small (Issue #47)

## Problem

On iOS, the reading surface has too much whitespace on the left and right edges, and the source link at the bottom of the card is cut off. The current layout consumes 36px per side in horizontal margin (container padding 20 + card margin 16 = 36), which on a 390px iPhone is over 18% of the screen width.

The source link cutoff is caused by an iOS-specific explicit height override (`Dimensions.get('window').height - 200`) that was likely added as a workaround for an older ScrollView collapse bug. That bug has since been fixed by switching MatchedTextWidget from Paper's `<Card>` to a plain `<View>`. The explicit height now causes the card to clip its bottom content.

## Solution: Option B — Remove iOS height override + reduce padding

### Changes

**`App.js` — `container` style**

Reduce horizontal padding from flat 20 to platform-specific:
- iOS/Android: `paddingHorizontal: 8, paddingVertical: 20`
- Web: unchanged (`padding: 20`)

Keeping `paddingVertical: 20` preserves clearance for the debug icon button in the top-right corner.

**`App.js` — `readingSurface` style**

Remove the `Platform.OS === 'ios'` explicit height override entirely:

```js
// Remove:
...(Platform.OS === 'ios' && {
  height: Dimensions.get('window').height - 200,
}),
```

`flex: 1` fills available space. `marginBottom: 80` reserves space for the FAB (which is `position: 'absolute'`). Together these handle layout and FAB clearance correctly.

**`components/MatchedTextWidget.js` — `paperCard` style**

Reduce `margin` from 16 to 8.

### Result

Total horizontal inset drops from 36px → 16px per side. On a 390px iPhone this frees ~40px per side (~20% more width). The source link and bottom of the card are no longer clipped.

### What Is Not Changing

- Web layout (padding stays at 20)
- FAB position, size, or behavior
- Card interior padding (`paddingHorizontal: 16` in MatchedTextWidget)
- All other styles

## Risk Assessment

**Low.** The FAB is `position: 'absolute'` and does not participate in flex layout. The existing `marginBottom: 80` on `readingSurface` already reserves space for it — this mechanism is unchanged. The explicit height override being removed was a workaround for a bug that no longer exists.

Requires a quick device test after the change to confirm FAB remains visible and layout is correct.
