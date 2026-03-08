# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FollowAlong** is a React Native app that matches spoken words in real-time to Bahá'í religious texts. It combines speech-to-text transcription with fuzzy text matching to identify and display passages from the Bahá'í Reference Library as you speak them.

The app uses Expo for cross-platform support (iOS, Android, Web). On iOS/Android, speech recognition runs on-device via `expo-speech-recognition`. On web, audio is streamed to a local Vosk WebSocket server.

## Commands

### Expo App (frontend)
```bash
npm install                    # Install dependencies
npm start                      # Start Expo dev server (for web)
npx expo run:ios               # Build and install on iOS device/simulator
npm run web                    # Run in web browser
npm run android                # Run on Android emulator
npm test                       # Run all tests
npm run test:ui                # Jest UI tests only
npm run test:matching          # Text matching algorithm tests
```

### Speech Recognition Server (web only — not needed for iOS/Android)
```bash
cd server && npm install   # Install server dependencies (use Node.js v18 for Vosk compatibility)
npm start                  # Start WebSocket server on port 2700
```

### Text Crawling (optional)
```bash
node scripts/crawl-bahai-library.cjs    # Download texts from bahai.org/library
node scripts/rebuild-search-index.cjs  # Rebuild index from existing text files
```

See `docs/crawler-guide.md` for comprehensive documentation on crawling, configuration, and troubleshooting.

## Architecture

### Data Flow
```
useSpeechRecognition hook
  ├── iOS/Android: expo-speech-recognition (on-device, real-time partials)
  └── Web: Vosk WebSocket server (streams 16kHz PCM audio)
  ↓
App.js (onPartial / onFinal callbacks)
  ↓
textMatcher.js (fuzzy matching) → search-index.json → texts/{doc-id}.json
  ↓
MatchedTextWidget (display with growing highlight and auto-scroll)
```

### STT Hook Architecture
Speech recognition is split into three layers:

- **`hooks/useSpeechRecognition.js`**: Platform dispatch hook. Calls `useNativeSTT` unconditionally (React hook rules require this), routes `startListening`/`stopListening` to the correct implementation at runtime.
- **`hooks/speech/nativeSTT.js`**: iOS/Android. Uses `expo-speech-recognition` (wraps Apple SFSpeechRecognizer). `continuous: true` + `interimResults: true` delivers real-time partial results via the React Native bridge. Uses `abort()` on stop (not `stop()`) to discard buffered audio immediately — `stop()` processes the buffer and floods the bridge with results. Requires `requiresOnDeviceRecognition: true` (no network needed).
- **`hooks/speech/vosk.js`**: Web. Streams 16kHz mono PCM audio over WebSocket to the local Vosk server. Accumulates finals across utterances internally.

### Frontend (App.js)
- Uses `useSpeechRecognition` hook for all audio input
- Platform-specific transcription delivery:
  - **iOS/Android**: Real-time partials as you speak (SFSpeechRecognizer)
  - **Web**: Real-time partials via Vosk WebSocket server
- Critical refs (not state) for synchronous control:
  - `isRecordingActiveRef` — set `false` synchronously on stop; `onPartial`/`onFinal` check this and drop events immediately. State would be too late — queued bridge events arrive before state updates.
  - `isMatchingInProgressRef` — prevents concurrent `findBestMatch` calls (each takes 3-15s on Hermes)
  - `lastForwardedWordCountRef` — word-count throttle: only forward to matcher when word count grows by 3+, since SFSpeechRecognizer delivers many partials per second
- `debounce.cancel()` called on stop to discard any pending debounce timer
- Displays split view:
  - **Reading surface**: Full-width matched text display (MatchedTextWidget) with paper-like card layout
  - **Debug panel**: Transcription output and logs, accessible via bug icon button (top-right `IconButton`) (modal overlay)
- All log statements use `tsLog(tag, ...)` which prepends `[HH:MM:SS.mmm]` for correlation with UI events

### Backend (server.js)
- WebSocket server on port 2700
- Vosk model at `vosk-model-small-en-us-0.15/`
- Accepts raw 16-bit PCM audio at 16kHz
- Returns JSON: `{partial: "..."}` or `{final: "..."}`

### Text Matching (utils/textMatcher.js)
- **Sliding window matching**: Uses last 45 words (not all accumulated text) to enable paragraph-to-paragraph progression
- **Fuzzy matching algorithm** with Levenshtein distance (max 2 edits) for noisy speech-to-text tolerance
- **N-gram similarity** (3, 4, 5-word sequences) weighted at 30%
- **Temporal continuity**: Tracks last 3 matched paragraphs to detect sequential reading patterns
- **Neighborhood bonus**: When sequential progression is detected, boosts scores for nearby paragraphs (+0.10 for ±1-3, +0.15 for exact prediction)
- **Stickiness threshold**: Dynamic — -0.10 for early matches (first 3) to allow correcting false positives; 0.15 for stable matches to prevent noise-triggered jumps
- **Robust section lookup**: Normalizes titles (trim + lowercase), handles duplicate section names by picking section with enough paragraphs
- Match threshold: 0.08 (very low for noisy speech-to-text)
- Returns best match with confidence score and metadata

### UI Components
- **MatchedTextWidget** (`components/MatchedTextWidget.js`):
  - Displays document header (title, author, confidence bar, "..." searching indicator)
  - Shows full text with highlighted matched passage
  - **Content persistence**: matched text stays visible during loading (no flash/blank state)
  - **Growing highlight**: highlights from first matched paragraph to current paragraph in a session
  - Auto-scrolls to current paragraph position
  - Source link to bahai.org

### Data Files
- **`public/search-index.json`**: Lightweight index with tokenized n-grams for all texts
- **`public/texts/{doc-id}.json`**: Full document content with metadata
- Texts include: Kitáb-i-Aqdas, Kitáb-i-Íqán, Hidden Words, Gleanings, Prayers & Meditations, etc.

### Web Crawler (scripts/crawl-bahai-library.cjs)
- Downloads texts from bahai.org/library
- Fetches .xhtml versions (complete HTML in one file)
- Extracts metadata, sections, paragraphs, verses
- Generates search index with tokenized n-grams
- Saves to both `assets/` (for native) and `public/` (for web)
- Individual document JSON files: `{doc-id}.json`

## Key Technical Details

- **Audio format for Vosk** (web): 16-bit signed PCM, 16kHz, mono
- **Node.js version**: v18 recommended (v20+ may have Vosk native module issues)
- Use `tsLog(tag, ...)` helper for timestamped dev-only logging — produces `[HH:MM:SS.mmm] [TAG] ...`. Use `debugLog()` only for non-timestamped dev logs (e.g. stickiness decisions)
- Text matching runs **debounced** (250ms) and **throttled** (every 3 words) to limit calls on Hermes
- **Hermes/JSC performance**: iOS JS engine is much slower than V8. `findBestMatch` across 43k paragraphs takes 3-15s on device; `MIN_PREFIX_MATCHES=2` in Pass 1 reduces candidates from 43k to ~4k. Keep JS-thread work minimal — any blocking operation freezes the UI.
- `abort()` vs `stop()` in expo-speech-recognition: `abort()` discards buffered audio immediately; `stop()` processes the buffer and can flood the bridge with result events for many seconds after stopping
- `debounce()` in `textMatcher.js` has a `.cancel()` method — call it on stop to discard pending debounce timers
- Match algorithm uses **fuzzy token overlap** (50% weight) + **n-gram similarity** (30% weight) + **neighborhood bonus** (0.10-0.15 when sequential progression detected)
- Text matching uses a **45-word sliding window** instead of all accumulated words to enable paragraph progression
- **WiFi requirement**: Dev builds (via `npx expo run:ios`) require WiFi to fetch the JS bundle from Metro on first load. Once loaded, the bundle is cached and the app works offline (STT is on-device, texts are bundled). Standalone EAS builds are fully offline from install.

## Coding Conventions

- Functional components with React hooks
- `async/await` for asynchronous operations
- StyleSheet for styling (no inline styles)
- Always request audio permissions before recording
- Clean up audio resources in `useEffect` cleanup functions
- Wrap async operations in try-catch with `Alert.alert()` for user errors
- Use `useRef` for values that persist across renders but don't trigger re-renders
- Keep state updates minimal and batch when possible

## UI Design Principles

### Reading Experience
- **Visual Consistency**: All body text must be uniform (size, weight, color, font). Visual hierarchy only where semantically meaningful.
- **Marker-Style Highlighting**: Highlighting adds background color ONLY. Text properties remain unchanged. Should look like a physical highlighter marker.
- **Paper-Like Interface**: Reading surface resembles physical paper. Serif typography for print-like comfort. Fixed viewport creates "page" metaphor.

### Layout & Spacing
- **Consistent Spacing**: Paragraph spacing uniform throughout. No special spacing around interactive elements.
- **Layout Stability**: Reading container maintains consistent size regardless of content state. No layout jumps when content loads/changes.
- **Inline Content Flow**: Interactive elements (highlights) inline with text flow, not separate blocks.

### Interaction
- **Auto-Focus on Content**: Matched/highlighted content automatically scrolls into view, unless user has manually scrolled (respects user control). Auto-scroll resumes when recording starts or document/section changes.
- **Responsive Design**: UI adapts to device screen size while maintaining comfortable reading experience. Maximum width constraint for readability.

### Design System
- **React Native Paper**: All UI components follow Material Design 3 (MD3) via React Native Paper library.
- **Custom Theme**: Bahá'í aesthetic with warm browns (#9d5c0d primary), cream backgrounds (#fdfaf5 surface), serif typography (Georgia).
- **Consistent Elevation**: Cards use elevation (1 for states, 2 for content) for depth hierarchy.
- **Theme Colors**: Reference theme colors where possible for consistency and maintainability.

### Component Usage Pattern
- **React Native Paper for Structure**: Use Paper components (Card, Appbar, Modal, FAB, Divider, ActivityIndicator) for structural/container elements.
- **Regular Text for Content**: Use native `Text` components for body content and inline elements (highlighting). This is CRITICAL.
- **PaperText for Labels**: Use Paper's `Text` component only for headers, labels, and standalone text blocks (not inline content).
- **Why This Matters**: PaperText doesn't support inline nesting properly. Inline content (like highlighting within paragraphs) must use native Text components to maintain proper flow and spacing. Violating this causes broken highlighting and spacing issues.

### Card-Based Presentation
- **MatchedTextWidget uses plain View**: NOT Paper `<Card>`. Paper's Card (MD3 Surface) splits styles across two Animated.Views; `flex: 1` goes to the outer layer but the inner layer (which has `overflow: 'hidden'`) does not inherit flex when `container=true`, causing the ScrollView to collapse to zero height on iOS. Use a plain `<View style={styles.paperCard}>` with `flex: 1, overflow: 'hidden', borderRadius: 8` — flex layout works correctly on plain Views.
- **Consistent Card Styling**: Off-white paper background (#fdfaf5), rounded corners (8px).
- **Proper Containment**: Container must have `overflow: 'hidden'` and proper flex layout to prevent content escaping boundaries.
- **State Consistency**: Same container appearance and structure for loading, empty, and content states.

### Loading & Empty States
- **Loading States**: Show Material ActivityIndicator with descriptive text in card layout.
- **Empty States**: Provide clear, actionable guidance ("Ready to listen", "Press microphone to start") rather than generic messages.
- **Visual Consistency**: All states use same container styling (Card with paper background and elevation).
- **Content Persistence**: Matched content stays visible during loading to prevent visual disruption (no flash/blank states).

### Debug vs Production UI
- **Hidden by Default**: Debug information (transcription, logs) hidden from production reading interface.
- **Accessible When Needed**: Debug panel accessed via bug icon button (top-right `IconButton`), displayed in modal overlay.
- **Non-Intrusive**: Debug features don't clutter reading experience or distract from primary content.
- **Developer-Friendly**: Debug panel designed for copying text and creating test cases (monospace font, scrollable).

### Accessibility & Ergonomics
- **One-Handed Operation**: Primary action button (FAB for record/stop) positioned bottom-center for easy access and visual balance.
- **Phone-First Design**: Layout optimized for one-handed phone use while reading.
- **Touch Targets**: Interactive elements sized appropriately for easy touch interaction.

**Apply these principles when making UI changes** - even if specific colors/fonts/sizes change, these requirements must be maintained.

## Development Notes

- The app name is "followalong" (in package.json) but the repo is "audiotext"
- Match context tracking (`matchContextRef`) maintains state across matches for continuity
- Auto-scroll implementation uses `onLayout` callback with `requestAnimationFrame`
- **Cross-platform scroll detection**: Use `onScroll` (not `onScrollBeginDrag`) to detect user scrolling, as `onScrollBeginDrag` only fires for touch events and misses mouse wheel/trackpad scrolling on web. Use `isProgrammaticScroll` flag to distinguish programmatic `scrollTo()` calls from user-initiated scrolls.
- **Testing with physical iOS device**: Connect via USB → trust developer certificate in iOS Settings → General → VPN & Device Management. If the Metro bundler QR code doesn't appear, enter the URL manually (`exp://[mac-ip]:8081`).
- **Test environment style checks**: `props.style` on a React Native element is the raw value (often an array like `[textContent, highlightedText]`). Use `StyleSheet.flatten(style)` before checking merged properties like `backgroundColor`. Checking `style.backgroundColor` directly on an array always returns `undefined`.
- **Testing useSpeechRecognition**: `isRecordingActiveRef.current` starts `false`. Tests that fire STT result events must first press the Record button (via `fireEvent.press(getByText('Record'))`) to set the ref to `true`, otherwise `onPartial`/`onFinal` drop events immediately.

### Auto-Scroll Behavior (MatchedTextWidget)

**Rules:**
1. When a new highlight appears, auto-scroll to it — unless the user has manually scrolled
2. Once the user scrolls, suppress all auto-scroll for the rest of the session
3. Reset (re-enable auto-scroll) when recording starts or when the matched document/section changes

**Implementation:**
- `onLayout` on a `<View>` wrapping the highlighted text is the primary scroll trigger. A nested inline `<Text onLayout>` does NOT fire reliably on iOS native (attributed string spans in UITextView). The highlighted segment is rendered as a standalone `<Text>` inside a `<View onLayout>`, flanked by two separate `<Text>` elements for before/after content.
- `userHasScrolled` ref: set to `true` by `onScroll` when user scrolls; suppresses auto-scroll.
- `isProgrammaticScroll` ref + `scrollTarget` ref: set before calling `scrollTo`, cleared by `handleScroll` when content offset reaches the target (within 5px). Prevents `onScroll` from misidentifying programmatic scrolls as user input.
- Reset triggers: recording starts (`isRecording` false→true), or `matchedDocument.docId+section` changes.

**Known pitfalls — do not reintroduce these:**
- **DO NOT** add a `useEffect([highlightPosition])` that calls `scrollTo` without a `!userHasScrolled` guard. `highlightPosition` is a new object on every render (~500ms), so an unguarded effect keeps `isProgrammaticScroll=true` indefinitely and prevents user scrolls from ever being detected.
- **DO NOT** use `onScrollBeginDrag` to detect user scroll — it only fires on native touch drag, not mouse wheel on web.
