// hooks/speech/nativeSTT.js
// Native STT for iOS and Android via expo-speech-recognition.
// Uses on-device recognition (requiresOnDeviceRecognition: true).
// SFSpeechRecognizer emits a growing transcript within a single utterance.
// At silence boundaries, iOS may start a new utterance and reset the transcript.
// This module does not accumulate across utterances — callers are responsible
// for any cross-utterance accumulation if needed.

import { useCallback } from 'react';

const tsLog = (tag, ...args) => {
  if (__DEV__) {
    const now = new Date();
    const ts = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    console.log(`[${ts}] [${tag}]`, ...args);
  }
};
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// Error codes from expo-speech-recognition mapped to user-readable messages.
// 'no-speech' is a normal operating condition (silence) — not shown to user.
const ERROR_MESSAGES = {
  'not-allowed':          'Microphone access denied. Please enable it in Settings.',
  'audio-capture':        'Could not access the microphone.',
  'network':              'Network error during speech recognition.',
  'service-not-allowed':  'Speech recognition service is not available.',
  'language-not-supported': 'English speech recognition is not supported on this device.',
};

// useNativeSTT is a hook rather than a factory because useSpeechRecognitionEvent
// must be called during the React render cycle (hook rules). Event subscriptions
// are registered at mount, before startListening() is called.
export function useNativeSTT({ onPartial, onFinal, onError }) {
  useSpeechRecognitionEvent('result', (event) => {
    if (!event.results?.length) { tsLog('NATIVE', 'result event: empty results'); return; }
    const transcript = event.results[event.results.length - 1]?.transcript ?? '';
    tsLog('NATIVE', `result isFinal=${event.isFinal} words=${transcript.split(/\s+/).filter(w=>w).length}`);
    if (event.isFinal) {
      onFinal(transcript);
    } else {
      onPartial(transcript);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    const code = event.error ?? 'unknown';
    if (code === 'no-speech') return; // normal silence detection — not an error
    if (code === 'aborted') return;  // fired when we call abort() ourselves — not an error
    onError(new Error(ERROR_MESSAGES[code] ?? `Speech recognition error (${code})`));
  });

  const startListening = useCallback(async () => {
    tsLog('NATIVE', 'startListening called');
    let granted;
    try {
      ({ granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync());
    } catch (err) {
      onError(new Error('Failed to request speech recognition permissions: ' + err.message));
      return;
    }
    if (!granted) {
      onError(new Error('Microphone access is required. Please enable it in Settings and try again.'));
      return;
    }
    tsLog('NATIVE', 'ExpoSpeechRecognitionModule.start() called');
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        requiresOnDeviceRecognition: true,
        continuous: true,
        interimResults: true,
      });
    } catch (err) {
      onError(new Error('Failed to start speech recognition: ' + err.message));
    }
  }, [onError]);

  const stopListening = useCallback(() => {
    tsLog('NATIVE', 'stopListening → abort() called');
    try {
      // abort() discards buffered audio immediately — no remaining results delivered.
      // stop() would process remaining audio and flood the bridge with result events,
      // blocking the JS thread until the buffer drains (can take many seconds).
      ExpoSpeechRecognitionModule.abort();
    } catch (err) {
      console.warn('[nativeSTT] Error stopping speech recognition:', err.message);
    }
  }, []);

  return { startListening, stopListening };
}
