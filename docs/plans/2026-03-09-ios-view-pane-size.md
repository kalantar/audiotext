# iOS View Pane Size Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix issue #47 — the reading surface is too narrow on iOS and the source link is cut off at the bottom.

**Architecture:** Three targeted style changes across two files. Remove an iOS-specific height override that clips the card bottom, reduce container padding for mobile (while keeping web layout unchanged), and reduce the card's own margin.

**Tech Stack:** React Native, Expo, React Native Paper, Platform API

**Design doc:** `docs/plans/2026-03-09-ios-view-pane-size-design.md`

---

### Task 1: Reduce container padding for mobile

**Files:**
- Modify: `App.js:616-622`

The `container` style currently has `padding: 20` on all sides. On mobile this wastes horizontal space; on web it looks fine. Switch to `Platform.select` to apply smaller horizontal padding on native.

`Platform` is already imported at the top of `App.js`.

**Step 1: Make the change**

In `App.js`, replace the `container` style:

```js
// Before:
container: {
  flex: 1,
  backgroundColor: '#f5f5f0', // Subtle warm background for reading comfort
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: 20,
},

// After:
container: {
  flex: 1,
  backgroundColor: '#f5f5f0', // Subtle warm background for reading comfort
  alignItems: 'center',
  justifyContent: 'flex-start',
  ...Platform.select({
    web: { padding: 20 },
    default: { paddingHorizontal: 8, paddingVertical: 20 },
  }),
},
```

**Step 2: Verify no test breakage**

```bash
npm test
```

Expected: all tests pass (this is a style-only change with no behavioral impact on tests).

**Step 3: Commit**

```bash
git add App.js
git commit -m "fix: reduce container horizontal padding on mobile for issue #47"
```

---

### Task 2: Remove iOS explicit height override from readingSurface

**Files:**
- Modify: `App.js:641-650`

The iOS-specific `height: Dimensions.get('window').height - 200` clips the card bottom (hiding the source link) and was a workaround for an old ScrollView collapse bug that has since been fixed. Remove it and let `flex: 1` + `marginBottom: 80` handle layout.

Also check whether `Dimensions` is still needed elsewhere in the file after this removal — if not, remove it from the import.

**Step 1: Make the change**

In `App.js`, replace the `readingSurface` style:

```js
// Before:
readingSurface: {
  flex: 1,  // Fill available space for reading content
  width: '100%',  // Full width on mobile
  maxWidth: 900,  // Constrain on larger screens
  alignSelf: 'center',
  marginBottom: 80,  // Space for FAB
  ...(Platform.OS === 'ios' && {
    height: Dimensions.get('window').height - 200,  // iOS: explicit height minus chrome
  }),
},

// After:
readingSurface: {
  flex: 1,  // Fill available space for reading content
  width: '100%',  // Full width on mobile
  maxWidth: 900,  // Constrain on larger screens
  alignSelf: 'center',
  marginBottom: 80,  // Space for FAB
},
```

**Step 2: Remove unused Dimensions import if needed**

Search `App.js` for any remaining uses of `Dimensions`. If none, remove it from the React Native import line at the top of the file.

```bash
grep -n "Dimensions" App.js
```

If only the import remains, remove `Dimensions` from the import statement.

**Step 3: Verify no test breakage**

```bash
npm test
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add App.js
git commit -m "fix: remove iOS explicit height override from readingSurface for issue #47"
```

---

### Task 3: Reduce card margin in MatchedTextWidget

**Files:**
- Modify: `components/MatchedTextWidget.js:316-328`

The `paperCard` has `margin: 16`. Combined with the now-reduced container padding, the previous total inset was 36px per side. Reducing to 8 brings the total to 16px per side — enough for visual breathing room without wasting space.

**Step 1: Make the change**

In `components/MatchedTextWidget.js`, change the `paperCard` margin:

```js
// Before:
paperCard: {
  flex: 1,
  margin: 16,
  ...

// After:
paperCard: {
  flex: 1,
  margin: 8,
  ...
```

**Step 2: Verify no test breakage**

```bash
npm test
```

Expected: all tests pass.

**Step 3: Commit**

```bash
git add components/MatchedTextWidget.js
git commit -m "fix: reduce card margin from 16 to 8 for issue #47"
```

---

### Task 4: Verify on iOS device

This is a visual fix — automated tests cannot fully verify it.

**Step 1: Build and run on iOS**

```bash
npx expo run:ios
```

**Step 2: Verify these things manually**

- Reading surface is noticeably wider (less whitespace on left/right edges)
- Source link at the bottom of the card is fully visible
- FAB (record/stop button) at the bottom is fully visible and tappable
- Web layout still looks correct at `npm run web`

**Step 3: Close the issue**

```bash
gh issue close 47 --repo kalantar/audiotext --comment "Fixed: reduced container padding on mobile, removed iOS height override, reduced card margin."
```
