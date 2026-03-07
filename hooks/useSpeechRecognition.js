import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { createVoskSTT } from './speech/vosk';
import { useNativeSTT } from './speech/nativeSTT';

export function useSpeechRecognition({ onPartial, onFinal, onError }) {
  const [isListening, setIsListening] = useState(false);
  const implRef = useRef(null);

  // useNativeSTT must be called unconditionally (React hook rules).
  // It no-ops on web since expo-speech-recognition events won't fire.
  const native = useNativeSTT({
    onPartial: useCallback((text) => { onPartial(text); }, [onPartial]),
    onFinal:   useCallback((text) => { onFinal(text); },   [onFinal]),
    onError:   useCallback((err)  => { onError(err); },    [onError]),
  });

  const startListening = useCallback(async () => {
    setIsListening(true);
    if (Platform.OS === 'web') {
      implRef.current = createVoskSTT({ onPartial, onFinal, onError });
      await implRef.current.startListening();
    } else {
      await native.startListening();
    }
  }, [onPartial, onFinal, onError, native]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (Platform.OS === 'web') {
      implRef.current?.stopListening();
      implRef.current = null;
    } else {
      native.stopListening();
    }
  }, [native]);

  return { startListening, stopListening, isListening };
}
