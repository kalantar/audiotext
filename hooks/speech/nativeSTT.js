// hooks/speech/nativeSTT.js
// Native STT for iOS and Android via expo-speech-recognition.
// Uses on-device recognition (requiresOnDeviceRecognition: true).
// SFSpeechRecognizer emits a growing transcript within a single utterance.
// At silence boundaries, iOS may start a new utterance and reset the transcript.
// This module does not accumulate across utterances — callers are responsible
// for any cross-utterance accumulation if needed.

import { useCallback, useRef, useEffect } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { tsLog } from '../../utils/log';

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
//
// useSpeechRecognitionEvent handlers are registered once at mount and cannot be
// re-registered when props change. Use refs to ensure event handlers always call
// the latest callbacks, even if the caller's useCallback identity changes.
export function useNativeSTT({ onPartial, onFinal, onError }) {
  const onPartialRef = useRef(onPartial);
  const onFinalRef = useRef(onFinal);
  const onErrorRef = useRef(onError);
  useEffect(() => { onPartialRef.current = onPartial; }, [onPartial]);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  // Set to true by stopListening so the 'end' event handler knows this was intentional.
  const stoppingIntentionallyRef = useRef(false);

  useSpeechRecognitionEvent('result', (event) => {
    if (!event.results?.length) { tsLog('NATIVE', 'result event: empty results'); return; }
    const transcript = event.results[event.results.length - 1]?.transcript ?? '';
    tsLog('NATIVE', `result isFinal=${event.isFinal} words=${transcript.split(/\s+/).filter(w=>w).length}`);
    if (event.isFinal) {
      onFinalRef.current(transcript);
    } else {
      onPartialRef.current(transcript);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    const code = event.error ?? 'unknown';
    if (code === 'no-speech') return; // normal silence detection — not an error
    if (code === 'aborted') return;  // fired when we call abort() ourselves — not an error
    onErrorRef.current(new Error(ERROR_MESSAGES[code] ?? `Speech recognition error (${code})`));
  });

  // On-device recognition can self-terminate (e.g. after extended silence on some iOS versions
  // even with continuous: true). If the session ends while the caller thinks it's still active,
  // surface an error so the UI resets rather than silently getting stuck in "recording" state.
  // stoppingIntentionallyRef is set by stopListening so intentional abort() doesn't trigger this.
  useSpeechRecognitionEvent('end', () => {
    tsLog('NATIVE', 'end event fired intentional=' + stoppingIntentionallyRef.current);
    if (stoppingIntentionallyRef.current) {
      stoppingIntentionallyRef.current = false;
      return;
    }
    onErrorRef.current(new Error('Speech recognition ended unexpectedly. Tap the microphone to try again.'));
  });

  const startListening = useCallback(async () => {
    tsLog('NATIVE', 'startListening called');
    stoppingIntentionallyRef.current = false;
    let granted;
    try {
      ({ granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync());
    } catch (err) {
      onErrorRef.current(new Error('Failed to request speech recognition permissions: ' + err.message));
      return;
    }
    if (!granted) {
      onErrorRef.current(new Error('Microphone access is required. Please enable it in Settings and try again.'));
      return;
    }
    tsLog('NATIVE', 'ExpoSpeechRecognitionModule.start() called');
    try {
      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        requiresOnDeviceRecognition: true,
        continuous: true,
        interimResults: true,
      });
    } catch (err) {
      onErrorRef.current(new Error('Failed to start speech recognition: ' + err.message));
    }
  }, []);

  const stopListening = useCallback(() => {
    tsLog('NATIVE', 'stopListening → abort() called');
    stoppingIntentionallyRef.current = true;
    try {
      // abort() prevents further audio processing — stop() would flush the buffer and
      // flood the bridge with result events for many seconds. Any in-flight result events
      // already dispatched are dropped by the isRecordingActiveRef guard in App.js.
      // An `error` event with code `'aborted'` is still fired; the error handler above silences it.
      ExpoSpeechRecognitionModule.abort();
    } catch (err) {
      console.error('[nativeSTT] Error stopping speech recognition:', err.message);
      // If abort() throws, the recognizer may still be running — notify the caller.
      onErrorRef.current(new Error('Failed to stop speech recognition cleanly. Please restart the app if issues persist.'));
    }
  }, []);

  return { startListening, stopListening };
}
