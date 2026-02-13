import { Audio, resetAudioMocks } from './mockAudio';

describe('Mock Audio (expo-av)', () => {
  beforeEach(() => {
    resetAudioMocks();
  });

  test('requestPermissionsAsync returns granted', async () => {
    const result = await Audio.requestPermissionsAsync();
    expect(result.granted).toBe(true);
  });

  test('Recording instance can start and stop', async () => {
    const recording = new Audio.Recording();

    await recording.startAsync();
    expect(recording.startAsync).toHaveBeenCalled();

    await recording.stopAndUnloadAsync();
    expect(recording.stopAndUnloadAsync).toHaveBeenCalled();
  });

  test('Recording getURI returns mock URI', () => {
    const recording = new Audio.Recording();
    expect(recording.getURI()).toBe('mock://audio.wav');
  });

  test('resetAudioMocks clears call history', () => {
    Audio.requestPermissionsAsync();
    expect(Audio.requestPermissionsAsync).toHaveBeenCalled();

    resetAudioMocks();
    expect(Audio.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
