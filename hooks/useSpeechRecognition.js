import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { createVoskSTT } from './speech/vosk';
import { useNativeSTT } from './speech/nativeSTT';

export function useSpeechRecognition({ onPartial, onFinal, onError }) {
  const [isListening, setIsListening] = useState(false);
  const implRef = useRef(null);

  // useNativeSTT must be called unconditionally (React hook rules).
  // On web, native.startListening() is never called (the web branch uses
  // createVoskSTT instead), so the event subscriptions registered here
  // remain inactive for the lifetime of the session.
  const { startListening: nativeStart, stopListening: nativeStop } = useNativeSTT({
    onPartial,
    onFinal,
    onError,
  });

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (Platform.OS === 'web') {
      implRef.current?.stopListening();
      implRef.current = null;
    } else {
      nativeStop();
    }
  }, [nativeStop]);

  const startListening = useCallback(async () => {
    setIsListening(true);
    try {
      if (Platform.OS === 'web') {
        implRef.current = createVoskSTT({ onPartial, onFinal, onError });
        await implRef.current.startListening();
      } else {
        await nativeStart();
      }
    } catch (err) {
      setIsListening(false);
      onError(err);
    }
  }, [onPartial, onFinal, onError, nativeStart]);

  // Clean up audio resources if the component unmounts while recording
  useEffect(() => {
    return () => { stopListening(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Empty deps is intentional: cleanup runs once on unmount. stopListening is stable
    // for native (nativeStop is useCallback([]) — always stable). For web,
    // it uses implRef.current which always holds the latest instance regardless.
  }, []);

  return { startListening, stopListening, isListening };
}
