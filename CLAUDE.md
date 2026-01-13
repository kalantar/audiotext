# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**audiotext** is a React Native audio recording app with real-time speech-to-text transcription. It uses Expo for cross-platform support (iOS, Android, Web) and a Node.js WebSocket server with Vosk for speech recognition.

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
node server.js             # Start WebSocket server on port 2700
```

## Architecture

### Data Flow
```
App.js (audio recording) → WebSocket → server.js (Vosk) → transcription results → App.js (UI)
```

### Frontend (App.js)
- Records audio using Expo AV
- Platform-specific audio handling:
  - **Web**: MediaRecorder API with WebM → converts to 16kHz mono PCM via Web Audio API → streams 1-second chunks
  - **Native (iOS/Android)**: Records WAV → sends complete file as 8KB PCM chunks after recording stops
- Displays last 50 words of accumulated transcription

### Backend (server.js)
- WebSocket server on port 2700
- Vosk model at `vosk-model-small-en-us-0.15/`
- Accepts raw 16-bit PCM audio at 16kHz
- Returns JSON: `{partial: "..."}` or `{final: "..."}`

## Key Technical Details

- **Audio format for Vosk**: 16-bit signed PCM, 16kHz, mono
- **Node.js version**: v18 recommended (v20+ may have Vosk native module issues)
- Use `debugLog()` helper for dev-only logging (checks `__DEV__`)
- WebSocket sends use `sendSafe()` to check connection state before sending

## Coding Conventions

- Functional components with React hooks
- `async/await` for asynchronous operations
- StyleSheet for styling (no inline styles)
- Always request audio permissions before recording
- Clean up audio resources in `useEffect` cleanup functions
- Wrap async operations in try-catch with `Alert.alert()` for user errors
