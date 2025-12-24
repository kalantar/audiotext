import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { Audio } from 'expo-av';

// Development-only logging helper
// __DEV__ is a built-in React Native constant that is automatically:
// - true in development builds (enables logging)
// - false in production builds (disables logging for performance and security)
const debugLog = (...args) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export default function App() {
  const [recording, setRecording] = useState(null);
  const [sound, setSound] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingUri, setRecordingUri] = useState(null);

  async function startRecording() {
    // Prevent starting a new recording if one is already in progress
    if (recording || isRecording) {
      debugLog('Recording already in progress, ignoring start request');
      return;
    }

    try {
      debugLog('Requesting permissions..');
      const permission = await Audio.requestPermissionsAsync();
      
      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant microphone permissions to record audio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      debugLog('Starting recording..');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
      debugLog('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording: ' + err.message);
    }
  }

  async function stopRecording() {
    debugLog('Stopping recording..');
    
    if (!recording) {
      return;
    }

    setIsRecording(false);
    const currentRecording = recording;

    try {
      await currentRecording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      const uri = currentRecording.getURI();
      setRecordingUri(uri);
      debugLog('Recording stopped and stored at', uri);
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to stop recording: ' + err.message);
    } finally {
      setRecording(null);
    }
  }

  async function playSound() {
    if (!recordingUri) {
      Alert.alert('No Recording', 'Please record audio first before playing back.');
      return;
    }

    // Prevent multiple simultaneous playback
    if (isPlaying) {
      debugLog('Sound already playing, ignoring playback request');
      return;
    }

    try {
      // If a sound is already loaded, unload it before creating a new one
      if (sound) {
        debugLog('Unloading previous sound before loading new one');
        // Remove any existing status update listener before unloading
        await sound.setOnPlaybackStatusUpdate(null);
        await sound.unloadAsync();
        setSound(null);
      }

      setIsPlaying(true);
      debugLog('Loading Sound');
      const { sound: audioSound } = await Audio.Sound.createAsync(
        { uri: recordingUri },
        { shouldPlay: true }
      );
      
      // Set up playback status listener to track when playback finishes
      audioSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      });
      
      setSound(audioSound);

      debugLog('Playing Sound');
      await audioSound.playAsync();
    } catch (err) {
      console.error('Failed to play sound', err);
      Alert.alert('Error', 'Failed to play sound: ' + err.message);
      setIsPlaying(false);
    }
  }

  React.useEffect(() => {
    return sound
      ? () => {
          debugLog('Unloading Sound');
          sound.unloadAsync().catch((err) => {
            console.error('Failed to unload sound', err);
          });
        }
      : undefined;
  }, [sound]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FollowAlong Audio Recorder</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {isRecording ? '🔴 Recording...' : recordingUri ? '✓ Recording ready' : '⚪ Ready to record'}
        </Text>
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, isRecording ? styles.stopButton : styles.recordButton]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.buttonText}>
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.playbackButton, (!recordingUri || isPlaying) && styles.disabledButton]}
          onPress={playSound}
          disabled={!recordingUri || isPlaying}
        >
          <Text style={styles.buttonText}>
            {isPlaying ? 'Playing...' : 'Playback'}
          </Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
    minWidth: 250,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  buttonsContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 15,
  },
  button: {
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  recordButton: {
    backgroundColor: '#34C759',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  playbackButton: {
    backgroundColor: '#007AFF',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
