# Transcription Implementation Documentation

This document explains how audio transcription is implemented in the audiotext application and where the transcription appears during recording.

## Overview

The application records audio and transcribes it in real-time (on web) or after recording completes (on mobile). The transcription is displayed in a scrollable text area that shows the last 50 words.

## Architecture

```
User speaks → Audio Recording → Audio Processing → WebSocket → Vosk Server
                                                                      ↓
User sees ← UI Update ← State Update ← WebSocket ← Transcription Results
```

## Implementation Details

### 1. Transcription UI Component

**Location:** `App.js`, lines 565-572 (with explanatory comments on lines 559-564)

```javascript
<View style={styles.transcriptionContainer}>
  <Text style={styles.transcriptionLabel}>Transcription (last 50 words):</Text>
  <ScrollView style={styles.transcriptionScrollView}>
    <Text style={[styles.transcriptionText, !transcription && styles.placeholderText]}>
      {transcription || 'Transcription will appear here when you start recording...'}
    </Text>
  </ScrollView>
</View>
```

**What it does:**
- Always renders on screen (even before recording)
- Shows placeholder text when `transcription` state is empty
- Shows actual transcription text once available
- Scrollable container with max height of 150px (line 665)

**Styling:** `App.js`, lines 645-676
- Container: Max width 500px, max height 200px
- ScrollView: Max height 150px
- Text: 16px font, 24px line height

### 2. Transcription State Management

**Location:** `App.js`, line 41

```javascript
const [transcription, setTranscription] = useState('');
```

This React state holds the current transcription text that is displayed in the UI. When this state updates, the UI automatically re-renders with the new text.

**Related state:**
- `finalTranscriptionRef` (line 45): Accumulates final transcription results across multiple phrases

### 3. Helper Function: Word Limiting

**Location:** `App.js`, lines 20-26

```javascript
const getLastWords = (text, wordCount) => {
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  if (words.length <= wordCount) {
    return text;
  }
  return words.slice(-wordCount).join(' ');
};
```

**Purpose:**
- Limits displayed text to the last N words (default: 50)
- Prevents the UI from being overwhelmed with long transcriptions
- Filters out empty words (multiple spaces)

**How it works:**
1. Splits text by whitespace into words
2. Filters out empty strings
3. If word count ≤ limit, returns original text
4. Otherwise, takes the last N words and joins them

### 4. WebSocket Connection for Transcription

**Location:** `App.js`, lines 49-107

#### Connection Setup (lines 41-50)

```javascript
const connectWebSocket = () => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_SERVER_URL);
    
    ws.onopen = () => {
      debugLog('WebSocket connected');
      wsRef.current = ws;
      resolve(ws);
    };
    // ... error handling
  });
};
```

**When called:** During `startRecording()` (line 217)

**What it does:**
- Connects to Vosk server at `ws://localhost:2700`
- Stores connection in `wsRef.current`
- Returns promise that resolves when connected

#### Message Handling (lines 70-98)

```javascript
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data.partial) {
      // Partial results (interim, while speaking)
      const combined = finalTranscriptionRef.current && finalTranscriptionRef.current.trim().length > 0
        ? finalTranscriptionRef.current + ' ' + data.partial
        : data.partial;
      setTranscription(getLastWords(combined, 50));
    } else if (data.final && data.final.trim().length > 0) {
      // Final results (completed phrase)
      const newFinal = finalTranscriptionRef.current && finalTranscriptionRef.current.trim().length > 0
        ? finalTranscriptionRef.current + ' ' + data.final
        : data.final;
      finalTranscriptionRef.current = newFinal;
      setTranscription(getLastWords(newFinal, 50));
    }
  } catch (err) {
    debugLog('Error parsing transcription:', err);
  }
};
```

**Message types:**
1. **Partial results** (`data.partial`):
   - Sent while user is speaking
   - Represents incomplete/interim transcription
   - Combined with accumulated final transcription for display
   - Updates UI in real-time during speaking

2. **Final results** (`data.final`):
   - Sent when a phrase/sentence is complete (user pauses)
   - Appended to `finalTranscriptionRef.current`
   - More accurate than partial results
   - Used as base for subsequent partial results

**Update flow:**
1. Server sends `{partial: "hello"}` → Display shows "hello"
2. Server sends `{partial: "hello world"}` → Display shows "hello world"
3. User pauses, server sends `{final: "hello world"}` → Saved to finalTranscriptionRef
4. User speaks again, server sends `{partial: "how are"}` → Display shows "hello world how are"
5. Server sends `{final: "how are you"}` → finalTranscriptionRef = "hello world how are you"

### 5. Audio Recording and Transmission

#### Starting Recording (lines 199-358)

**Key steps:**

1. **Request permissions** (line 208):
   ```javascript
   const permission = await Audio.requestPermissionsAsync();
   ```

2. **Connect to transcription server** (line 217):
   ```javascript
   await connectWebSocket();
   ```

3. **Clear previous transcription** (lines 224-225):
   ```javascript
   setTranscription('');
   finalTranscriptionRef.current = '';
   ```

4. **Configure audio recording** (lines 235-261):
   - Android/iOS: 16kHz WAV, mono, 16-bit PCM
   - Web: WebM format (converted to PCM before sending)

5. **Start recording** (lines 263-269):
   ```javascript
   const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);
   setRecording(newRecording);
   setIsRecording(true);
   ```

#### Real-time Audio Streaming (Web Only, lines 272-352)

**Platform:** Web browsers only (not iOS/Android)

**How it works:**

1. **Setup AudioContext** (lines 275-283):
   ```javascript
   audioContextRef.current = new AudioContextCtor();
   ```

2. **Access MediaRecorder** (line 286):
   ```javascript
   const mediaRecorder = newRecording._mediaRecorder;
   ```

3. **Handle audio chunks** (lines 290-339):
   - MediaRecorder fires `dataavailable` events with audio chunks
   - Each chunk is WebM format audio
   - Convert chunk to ArrayBuffer
   - Decode WebM using Web Audio API
   - Resample to 16kHz mono
   - Convert to 16-bit PCM
   - Send PCM data to WebSocket

4. **Request data periodically** (lines 342-347):
   ```javascript
   mediaRecorder.requestData(); // Immediate request
   recordingIntervalRef.current = setInterval(() => {
     if (mediaRecorder.state === 'recording') {
       mediaRecorder.requestData();
     }
   }, 1000); // Every 1 second
   ```

**Result:** On web, transcription appears in real-time as you speak (updated every ~1 second)

#### Stopping Recording (lines 360-461)

**Key steps:**

1. **Cleanup timers** (lines 363-367):
   ```javascript
   clearInterval(recordingIntervalRef.current);
   ```

2. **Stop recording** (line 387):
   ```javascript
   await currentRecording.stopAndUnloadAsync();
   ```

3. **Send audio for transcription (mobile only)** (lines 402-436):
   - Read recorded WAV file
   - Skip 44-byte WAV header to get PCM data
   - Send PCM data in 8KB chunks
   - Small delay between chunks to prevent overwhelming WebSocket

4. **Close WebSocket after delay** (lines 451-453):
   - Allows server time to process final audio
   - Base timeout: 3 seconds
   - Additional time based on audio length

### 6. Audio Format Conversion (Web)

**Location:** `App.js`, lines 141-197

**Function:** `convertToPCM(audioUri)`

**Purpose:** Convert browser-recorded WebM audio to PCM format required by Vosk

**Process:**
1. Fetch audio file as ArrayBuffer
2. Decode WebM using Web Audio API `decodeAudioData()`
3. Create OfflineAudioContext for 16kHz mono output
4. Resample audio to 16kHz mono
5. Convert Float32 PCM to Int16 PCM
6. Return as Uint8Array

**Note:** This function is called for real-time chunks (lines 276-315) and not used for final recording on web (real-time streaming handles all audio).

### 7. Server-Side Processing

**Location:** `server/server.js`

**Server setup:**
```javascript
const vosk = require('vosk');
const WebSocket = require('ws');

const model = new vosk.Model('vosk-model-small-en-us-0.15');
const wss = new WebSocket.Server({ port: 2700 });
```

**Per-connection processing:**
```javascript
wss.on('connection', function connection(ws) {
  const rec = new vosk.Recognizer({model: model, sampleRate: 16000});
  
  ws.on('message', function incoming(message) {
    if (rec.acceptWaveform(message)) {
      // Complete phrase detected
      sendIfOpen(ws, JSON.stringify({final: rec.result().text}));
    } else {
      // Partial result (still speaking)
      sendIfOpen(ws, JSON.stringify({partial: rec.partialResult().partial}));
    }
  });
  
  ws.on('close', () => rec.free());
});
```

**How Vosk works:**
- `acceptWaveform()`: Processes audio buffer, returns true when phrase complete
- `result().text`: Returns final transcription of completed phrase
- `partialResult().partial`: Returns interim transcription of incomplete phrase

## Complete Flow Diagram

### Web Platform (Real-time Transcription)

```
1. User clicks "Start Recording"
   ↓
2. App requests microphone permissions
   ↓
3. App connects to WebSocket server (ws://localhost:2700)
   ↓
4. App clears previous transcription (setTranscription(''))
   ↓
5. MediaRecorder starts recording
   ↓
6. Every 1 second:
   a. MediaRecorder.requestData() called
   b. 'dataavailable' event fires with WebM audio chunk
   c. Chunk converted to PCM (Float32 → Int16, resampled to 16kHz)
   d. PCM sent to WebSocket
   e. Vosk processes audio
   f. Vosk sends {partial: "text"} or {final: "text"}
   g. App receives message in ws.onmessage
   h. setTranscription(getLastWords(combined, 50)) called
   i. UI updates with new text
   ↓
7. User clicks "Stop Recording"
   ↓
8. Recording stopped, interval cleared
   ↓
9. WebSocket closed after 3-second delay
```

### Mobile Platform (iOS/Android) - Post-Recording Transcription

```
1. User clicks "Start Recording"
   ↓
2. App requests microphone permissions
   ↓
3. App connects to WebSocket server (ws://localhost:2700)
   ↓
4. App clears previous transcription (setTranscription(''))
   ↓
5. Recording starts (WAV format, 16kHz, mono, 16-bit PCM)
   ↓
6. Audio recorded to file (no real-time streaming)
   ↓
7. User clicks "Stop Recording"
   ↓
8. Recording stopped, saved to file
   ↓
9. App reads WAV file
   ↓
10. App skips 44-byte WAV header, extracts PCM data
    ↓
11. App sends PCM data to WebSocket in 8KB chunks
    ↓
12. Vosk processes audio and sends results:
    - {partial: "..."} for interim results
    - {final: "..."} for complete phrases
    ↓
13. App receives messages and updates UI
    ↓
14. WebSocket closed after delay
```

## Troubleshooting

### Transcription Not Appearing

If transcription doesn't appear in the UI, check:

1. **Is the WebSocket server running?**
   ```bash
   cd server
   npm start
   ```
   Should show: "WebSocket server is listening on port 2700"

2. **Is the WebSocket connecting?**
   - Check browser console (web) or debug logs
   - Look for "WebSocket connected" message
   - If connection fails, you'll see alert: "Could not connect to transcription server"

3. **Is audio being sent?**
   - Web: Check for "dataavailable" events every second
   - Mobile: Check for "Audio sent to transcription server" log
   - Verify audio format is correct (16kHz, mono, 16-bit PCM)

4. **Is the server responding?**
   - Server should log incoming audio data
   - Server should send back JSON messages: `{partial: "..."}` or `{final: "..."}`

5. **Is the UI updating?**
   - Check if `setTranscription()` is being called
   - Verify `transcription` state is not empty
   - Look for any errors in `ws.onmessage` handler

### Common Issues

1. **"WebSocket connected" but no transcription:**
   - Audio might be silent (Vosk needs speech to transcribe)
   - Microphone might be muted
   - Audio format might be incorrect

2. **Transcription appears only after recording stops (on web):**
   - Real-time streaming might not be working
   - Check MediaRecorder support in browser
   - Verify AudioContext is created successfully

3. **Server connection fails:**
   - Check if port 2700 is available
   - Verify server is running
   - Check firewall settings

## Code References

| Feature | File | Lines | Description |
|---------|------|-------|-------------|
| UI Component | App.js | 565-572 | Transcription display container |
| State | App.js | 41, 45 | transcription state and finalTranscriptionRef |
| Word Limiting | App.js | 20-26 | getLastWords() helper function |
| WebSocket Setup | App.js | 49-107 | Connection and message handling |
| Message Handler | App.js | 70-98 | Processes partial/final results |
| Start Recording | App.js | 199-358 | Permission, connection, recording |
| Real-time Streaming | App.js | 272-352 | Web-only audio streaming |
| Stop Recording | App.js | 360-461 | Cleanup and send audio (mobile) |
| PCM Conversion | App.js | 141-197 | WebM to PCM conversion |
| Server | server/server.js | entire | Vosk WebSocket server |
| Styling | App.js | 645-676 | Transcription UI styles |

## Summary

The transcription feature is **fully implemented** and displays text in the UI control (lines 565-572) as audio is recorded. The transcription:

- ✅ Appears in real-time on web (every ~1 second)
- ✅ Appears after recording on mobile (iOS/Android)
- ✅ Shows last 50 words automatically
- ✅ Updates during recording with partial results
- ✅ Finalizes when user pauses between phrases
- ✅ Remains visible after recording stops
- ✅ Is scrollable when content exceeds 150px height

The implementation uses:
- **React state** (`transcription`) for UI updates
- **WebSocket** for real-time communication with Vosk server
- **Vosk** for speech recognition
- **Web Audio API** for audio processing (web)
- **Expo Audio** for recording (all platforms)
