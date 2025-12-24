import React, { useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView } from 'react-native';
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

// Helper function to get last N words from text
const getLastWords = (text, wordCount) => {
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  if (words.length <= wordCount) {
    return text;
  }
  return words.slice(-wordCount).join(' ');
};

// WebSocket server configuration
const WS_SERVER_URL = 'ws://localhost:2700';

export default function App() {
  const [recording, setRecording] = useState(null);
  const [sound, setSound] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingUri, setRecordingUri] = useState(null);
  const [transcription, setTranscription] = useState('');
  const wsRef = useRef(null);

  // Initialize WebSocket connection
  const connectWebSocket = () => {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(WS_SERVER_URL);
        
        ws.onopen = () => {
          debugLog('WebSocket connected');
          wsRef.current = ws;
          resolve(ws);
        };
        
        ws.onerror = (error) => {
          debugLog('WebSocket error:', error);
          wsRef.current = null;
          reject(error);
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.partial) {
              // Update with partial transcription
              setTranscription(prev => {
                const newText = prev && prev.trim().length > 0
                  ? prev + ' ' + data.partial
                  : data.partial;
                return getLastWords(newText, 50);
              });
            } else if (data.final) {
              // Update with final transcription
              setTranscription(prev => {
                const newText = prev && prev.trim().length > 0
                  ? prev + ' ' + data.final
                  : data.final;
                return getLastWords(newText, 50);
              });
            }
          } catch (err) {
            debugLog('Error parsing transcription:', err);
          }
        };
        
        ws.onclose = () => {
          debugLog('WebSocket closed');
          wsRef.current = null;
        };
      } catch (err) {
        reject(err);
      }
    });
  };

  // Close WebSocket connection
  const closeWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

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

      // Connect to WebSocket server for transcription
      try {
        await connectWebSocket();
      } catch (err) {
        console.error('Failed to connect to transcription server', err);
        Alert.alert('Warning', 'Could not connect to transcription server. Recording will work but transcription will not be available.');
      }

      // Clear previous transcription
      setTranscription('');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      debugLog('Starting recording..');
      
      // Configure recording for 16kHz sample rate (required by Vosk)
      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          sampleRate: 16000,
          numberOfChannels: 1,
          bitsPerSecond: 128000,
        },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(
        recordingOptions
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      debugLog('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording: ' + err.message);
      closeWebSocket();
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

      // Send recorded audio to WebSocket for transcription
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          // Read the audio file and send to WebSocket
          const response = await fetch(uri);
          const arrayBuffer = await response.arrayBuffer();
          const audioBytes = new Uint8Array(arrayBuffer);

          // Standard WAV header size is 44 bytes; skip these to get raw PCM data
          const WAV_HEADER_SIZE = 44;
          const pcmData =
            audioBytes.length > WAV_HEADER_SIZE
              ? audioBytes.subarray(WAV_HEADER_SIZE)
              : audioBytes;

          // Send audio data in chunks
          const chunkSize = 8000; // 8KB chunks
          for (let offset = 0; offset < pcmData.length; offset += chunkSize) {
            const chunk = pcmData.subarray(offset, offset + chunkSize);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              // Ensure we send the underlying ArrayBuffer slice
              wsRef.current.send(
                chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)
              );
            } else {
              break;
            }
          }
          
          debugLog('Audio sent to transcription server');
        } catch (err) {
          console.error('Failed to send audio to transcription server', err);
        }
      }
      
      // Close WebSocket connection after a delay to allow final transcription
      setTimeout(() => {
        closeWebSocket();
      }, 2000);
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to stop recording: ' + err.message);
      closeWebSocket();
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

  // Cleanup WebSocket on unmount
  React.useEffect(() => {
    return () => {
      closeWebSocket();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FollowAlong Audio Recorder</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {isRecording ? '🔴 Recording...' : recordingUri ? '✓ Recording ready' : '⚪ Ready to record'}
        </Text>
      </View>

      {transcription ? (
        <View style={styles.transcriptionContainer}>
          <Text style={styles.transcriptionLabel}>Transcription (last 50 words):</Text>
          <ScrollView style={styles.transcriptionScrollView}>
            <Text style={styles.transcriptionText}>{transcription}</Text>
          </ScrollView>
        </View>
      ) : null}

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
  transcriptionContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transcriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  transcriptionScrollView: {
    maxHeight: 150,
  },
  transcriptionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
});
