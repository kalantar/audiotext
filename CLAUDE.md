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
node scripts/crawl-bahai-library.js   # Download texts from bahai.org/library
```

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

### Web Crawler (scripts/crawl-bahai-library.js)
- Downloads texts from bahai.org/library
- Fetches .xhtml versions (complete HTML in one file)
- Extracts metadata, sections, paragraphs, verses
- Generates search index with tokenized n-grams
- Saves individual document JSON files

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

**Apply these principles when making UI changes** - even if specific colors/fonts/sizes change, these requirements must be maintained.

## Development Notes

- The app name is "followalong" (in package.json) but the repo is "audiotext"
- Transcription uses a circular buffer approach for efficient memory usage
- Match context tracking maintains state across matches for continuity
- Highlight positioning uses multiple fallback strategies for robustness
- Auto-scroll implementation uses `onLayout` callback with `requestAnimationFrame`
