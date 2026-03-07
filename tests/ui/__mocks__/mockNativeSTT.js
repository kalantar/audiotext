/**
 * Mock for expo-speech-recognition module.
 * Provides controllable event firing for tests.
 */

const handlers = {};

export function useSpeechRecognitionEvent(event, handler) {
  handlers[event] = handler;
}

export const ExpoSpeechRecognitionModule = {
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  start: jest.fn(),
  stop: jest.fn(),
};

/** Fire a result event as if SFSpeechRecognizer delivered a transcript */
export function fireResult(transcript, isFinal = false) {
  if (handlers['result']) {
    handlers['result']({ results: [{ transcript }], isFinal });
  }
}

/** Reset all handlers and mock call history between tests */
export function resetMock() {
  Object.keys(handlers).forEach(k => delete handlers[k]);
  jest.clearAllMocks();
}
