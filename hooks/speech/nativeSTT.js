// hooks/speech/nativeSTT.js
// Native STT for iOS and Android via expo-speech-recognition.
// Uses on-device recognition (requiresOnDeviceRecognition: true).
// SFSpeechRecognizer delivers the full accumulated transcription per update,
// so onPartial and onFinal both emit full-session text directly.

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// Note: this module exports a hook (not a factory function) because
// expo-speech-recognition uses React event hooks internally.
export function useNativeSTT({ onPartial, onFinal, onError }) {
  useSpeechRecognitionEvent('result', (event) => {
    if (!event.results?.length) return;
    const transcript = event.results[event.results.length - 1]?.transcript ?? '';
    if (event.isFinal) {
      onFinal(transcript);
    } else {
      onPartial(transcript);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    onError(new Error(event.error ?? 'Speech recognition error'));
  });

  async function startListening() {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      onError(new Error('Microphone or speech recognition permission denied'));
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      requiresOnDeviceRecognition: true,
      continuous: true,
      interimResults: true,
    });
  }

  function stopListening() {
    ExpoSpeechRecognitionModule.stop();
  }

  return { startListening, stopListening };
}
