# FollowAlong

Listens to someone reading a Bahá'í text and identifies the passage in real-time. The matched text is displayed and highlighted as you speak, scrolling forward as you progress through the passage.

Source texts are pulled from [library.bahai.org](https://library.bahai.org).

## How It Works

Speak into the microphone. The app transcribes your speech and fuzzy-matches it against a corpus of ~43,000 paragraphs from Bahá'í writings. When a match is found, the full section is displayed with the matched passage highlighted in yellow. The highlight grows as you read further.

## Project Structure

```
App.js                    Main application component
hooks/
  useSpeechRecognition.js Platform dispatch — native on iOS/Android, Vosk on web
  speech/
    nativeSTT.js          iOS/Android: expo-speech-recognition (on-device, real-time)
    vosk.js               Web: streams audio to local Vosk WebSocket server
components/
  MatchedTextWidget.js    Text display with growing highlight and auto-scroll
utils/
  textMatcher.js          Fuzzy matching algorithm (Levenshtein + n-gram)
assets/
  search-index.json       Bundled index: 591 documents, 43,257 paragraphs
  texts/{doc-id}.json     Bundled full document content
public/                   Same files served for web
server/
  server.js               Vosk WebSocket server (web path only)
scripts/
  crawl-bahai-library.cjs Download and index texts from bahai.org
```

## Prerequisites

- Node.js v18+ and npm
- **iOS/Android**: Xcode (iOS) or Android Studio — for building a native binary
- **Web only**: Node.js v18 recommended for Vosk native module compatibility

## Setup

```bash
npm install
```

For the **web** speech-to-text server (not needed for iOS/Android):
```bash
cd server && npm install   # use Node.js v18
```

## Running the App

### iOS (real-time, on-device, no server needed)

```bash
npx expo run:ios           # build and install on simulator or connected device
```

Speech recognition runs on-device via `expo-speech-recognition` (Apple's SFSpeechRecognizer). No network connection required once the JS bundle is loaded.

To run on a physical device, connect via USB and trust the developer certificate in iOS Settings > General > VPN & Device Management.

### Android

```bash
npx expo run:android
```

### Web (requires local Vosk server)

Start the speech-to-text server first:
```bash
cd server && npm start     # WebSocket server on port 2700
```

Then:
```bash
npm run web
```

### EAS Build (standalone, fully offline on iOS)

```bash
npx eas build --profile development --platform ios
```

A standalone build embeds the JS bundle — no Metro dev server or WiFi connection required after install.

## Features

- **Real-time transcription on iOS/Android**: Speech is matched as you speak using on-device recognition (no server)
- **Fuzzy matching**: Handles noisy speech-to-text with Levenshtein distance and n-gram similarity
- **Growing highlight**: Highlights from first matched paragraph to current as you progress
- **Auto-scroll**: Follows current passage unless you have manually scrolled
- **Debug panel**: Tap the bug icon to see the raw transcription and correlate with timestamped logs

## Testing

```bash
npm test                   # all tests (matching + UI)
npm run test:matching      # text matching algorithm
npm run test:ui            # UI component tests (Jest)
```

## Text Corpus

591 documents, ~43,000 paragraphs including: Kitáb-i-Aqdas, Kitáb-i-Íqán, Hidden Words, Gleanings, Prayers & Meditations, Epistle to the Son of the Wolf, Gems of Divine Mysteries, and UHJ messages.

To update the corpus:
```bash
node scripts/crawl-bahai-library.cjs    # crawl and update texts
node scripts/rebuild-search-index.cjs  # rebuild index from existing text files
```

See `docs/crawler-guide.md` for details.
