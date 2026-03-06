# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FollowAlong** is a React Native app that matches spoken words in real-time to Bahá'í religious texts. It combines speech-to-text transcription with fuzzy text matching to identify and display passages from the Bahá'í Reference Library as you speak them.

The app uses Expo for cross-platform support (iOS, Android, Web) and a Node.js WebSocket server with Vosk for speech recognition.

## Commands

### Expo App (frontend)
```bash
npm install           # Install dependencies
npm start             # Start Expo dev server
npm run web           # Run in web browser
npm run ios           # Run on iOS simulator (requires Xcode)
npm run android       # Run on Android emulator
```

### Speech Recognition Server
```bash
cd server && npm install   # Install server dependencies (use Node.js v18 for Vosk compatibility)
npm start                  # Start WebSocket server on port 2700
```

### Text Crawling (optional)
```bash
node scripts/crawl-bahai-library.cjs   # Download texts from bahai.org/library
```

See `docs/crawler-guide.md` for comprehensive documentation on crawling, configuration, and troubleshooting.

## Architecture

### Data Flow
```
App.js (audio recording) → WebSocket → server.js (Vosk) → transcription
  ↓
textMatcher.js (fuzzy matching) → search-index.json → texts/{doc-id}.json
  ↓
MatchedTextWidget (display with highlighting)
```

### Frontend (App.js)
- Records audio using Expo AV
- Platform-specific audio handling:
  - **Web**: MediaRecorder API with WebM → converts to 16kHz mono PCM via Web Audio API → streams 500ms chunks
  - **Native (iOS/Android)**: Records WAV → sends complete file as 8KB PCM chunks after recording stops
- Displays split view:
  - **Left side**: Last 50 words of accumulated transcription
  - **Right side**: Matched text with highlighted passage (MatchedTextWidget)
- Real-time text matching as transcription updates

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
- **Stickiness threshold**: 0.15 score differential required to switch documents/sections (prevents jumping on noise)
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

- **Audio format for Vosk**: 16-bit signed PCM, 16kHz, mono
- **Node.js version**: v18 recommended (v20+ may have Vosk native module issues)
- Use `debugLog()` helper for dev-only logging (checks `__DEV__`)
- WebSocket sends use `sendSafe()` to check connection state before sending
- Text matching runs **debounced** to avoid excessive computation
- Match algorithm uses **fuzzy token overlap** (50% weight) + **n-gram similarity** (30% weight) + **neighborhood bonus** (0.10-0.15 when sequential progression detected)
- Text matching uses a **45-word sliding window** instead of all accumulated words to enable paragraph progression
- Audio chunks sent to Vosk every **500ms** for faster transcription response

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
- **Auto-Focus on Content**: Matched/highlighted content automatically scrolls into view.
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
- **Content Wrapped in Cards**: All major content sections wrapped in Material Card components with Card.Content.
- **Consistent Card Styling**: Off-white paper background (#fdfaf5), rounded corners (8px), appropriate elevation.
- **Proper Containment**: Cards must properly contain content with `overflow: 'hidden'` and proper flex layout to prevent content escaping boundaries.
- **State Consistency**: Same card appearance and structure for loading, empty, and content states.

### Loading & Empty States
- **Loading States**: Show Material ActivityIndicator with descriptive text in card layout.
- **Empty States**: Provide clear, actionable guidance ("Ready to listen", "Press microphone to start") rather than generic messages.
- **Visual Consistency**: All states use same container styling (Card with paper background and elevation).
- **Content Persistence**: Matched content stays visible during loading to prevent visual disruption (no flash/blank states).

### Debug vs Production UI
- **Hidden by Default**: Debug information (transcription, logs) hidden from production reading interface.
- **Accessible When Needed**: Debug panel accessed via Appbar bug icon, displayed in modal overlay.
- **Non-Intrusive**: Debug features don't clutter reading experience or distract from primary content.
- **Developer-Friendly**: Debug panel designed for copying text and creating test cases (monospace font, scrollable).

### Accessibility & Ergonomics
- **One-Handed Operation**: Primary action button (FAB for record/stop) positioned bottom-center for easy access and visual balance.
- **Phone-First Design**: Layout optimized for one-handed phone use while reading.
- **Touch Targets**: Interactive elements sized appropriately for easy touch interaction.

**Apply these principles when making UI changes** - even if specific colors/fonts/sizes change, these requirements must be maintained.

## Development Notes

- The app name is "followalong" (in package.json) but the repo is "audiotext"
- Transcription uses a circular buffer approach for efficient memory usage
- Match context tracking maintains state across matches for continuity
- Highlight positioning uses multiple fallback strategies for robustness
- Auto-scroll implementation uses `onLayout` callback with `requestAnimationFrame`

### Auto-Scroll Behavior (MatchedTextWidget)

**Rules:**
1. When a new highlight appears, auto-scroll to it — unless the user has manually scrolled
2. Once the user scrolls, suppress all auto-scroll for the rest of the session
3. Reset (re-enable auto-scroll) only when the highlight anchor changes — i.e. a non-contiguous match starts a new reading session (`firstParagraphNum` changes)

**Implementation:**
- `onLayout` on the highlighted `<Text>` is the **only** scroll trigger. It fires when the highlighted text's layout changes (content or position shifts).
- `userHasScrolled` ref: set to `true` by `onScroll` when user scrolls; suppresses `onLayout`-triggered scroll.
- `isProgrammaticScroll` ref + 400ms timer: set before calling `scrollTo`, cleared after animation settles. Prevents `onScroll` from misidentifying programmatic scrolls as user input.
- `firstParagraphNum` in `highlightPosition`: changes when a non-contiguous match occurs, triggering a `useEffect` that resets `userHasScrolled`.

**Known pitfalls — do not reintroduce these:**
- **DO NOT** add a `useEffect` that calls `scrollTo` when `highlightPosition` changes. `highlightPosition` is a new object on every render (every ~500ms match), so the effect fires constantly, keeping `isProgrammaticScroll=true` indefinitely and preventing `userHasScrolled` from ever being set.
- **DO NOT** use `onScrollBeginDrag` to detect user scroll — it only fires on native touch drag, not mouse wheel on web.
