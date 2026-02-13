/**
 * Mock expo-av Audio module for testing
 * Stubs recording functionality without actual audio capture
 */

const mockRecording = {
  startAsync: jest.fn().mockResolvedValue(undefined),
  stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
  getURI: jest.fn().mockReturnValue('mock://audio.wav'),
  setOnRecordingStatusUpdate: jest.fn(),
};

export const Audio = {
  requestPermissionsAsync: jest.fn().mockResolvedValue({
    status: 'granted',
    granted: true,
  }),

  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),

  Recording: jest.fn().mockImplementation(() => mockRecording),

  RecordingOptionsPresets: {
    HIGH_QUALITY: {
      isMeteringEnabled: true,
      android: {
        extension: '.m4a',
        outputFormat: 2,
        audioEncoder: 3,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      },
      ios: {
        extension: '.wav',
        outputFormat: 'linearPCM',
        audioQuality: 127,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 128000,
      },
    },
  },
};

// Reset mock state between tests
export function resetAudioMocks() {
  mockRecording.startAsync.mockClear();
  mockRecording.stopAndUnloadAsync.mockClear();
  mockRecording.getURI.mockClear();
  Audio.requestPermissionsAsync.mockClear();
  Audio.setAudioModeAsync.mockClear();
}
