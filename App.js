import React, { useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
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
  const finalTranscriptionRef = useRef('');
  const recordingIntervalRef = useRef(null);

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
              // Partial results replace the current partial text (not append)
              // Vosk sends the complete partial transcription so far, not incremental
              const combined = finalTranscriptionRef.current && finalTranscriptionRef.current.trim().length > 0
                ? finalTranscriptionRef.current + ' ' + data.partial
                : data.partial;
              setTranscription(getLastWords(combined, 50));
            } else if (data.final && data.final.trim().length > 0) {
              // Final results are appended to the accumulated final transcription
              const newFinal = finalTranscriptionRef.current && finalTranscriptionRef.current.trim().length > 0
                ? finalTranscriptionRef.current + ' ' + data.final
                : data.final;
              finalTranscriptionRef.current = newFinal;
              // Update display with the new final transcription
              setTranscription(getLastWords(newFinal, 50));
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
      const ws = wsRef.current;
      if (ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
      wsRef.current = null;
    }
  };

  // Convert recorded WebM audio to raw PCM format for Vosk (16kHz, 16-bit, mono).
  //
  // Processing pipeline:
  // 1. Fetch the recorded audio file (typically WebM/Opus from Expo on the web) into an ArrayBuffer.
  // 2. Use the Web Audio API (AudioContext.decodeAudioData) to decode the compressed WebM data
  //    into an uncompressed AudioBuffer (PCM Float32 samples at the original sample rate / channels).
  // 3. Create an OfflineAudioContext configured for:
  //      - 1 channel (mono)
  //      - target sample rate of 16,000 Hz (Vosk's expected input rate)
  //      - a length based on the original duration at 16 kHz
  //    and render the decoded AudioBuffer into this context to resample and downmix to mono.
  // 4. Extract the resampled mono Float32 channel data and convert each sample to a 16‑bit
  //    signed integer (Int16) by:
  //      - clamping the float sample to the range [-1.0, 1.0]
  //      - scaling negative values by 0x8000 and non‑negative values by 0x7FFF
  // 5. Return the underlying Int16Array buffer as a Uint8Array so it can be sent over the
  //    WebSocket connection to the Vosk server as raw 16‑bit PCM audio.
  //
  // This function is only called on web platforms where window and AudioContext are available.
  const convertToPCM = async (audioUri) => {
    let audioContext = null;
    
    try {
      // Fetch the audio file
      const response = await fetch(audioUri);
      const arrayBuffer = await response.arrayBuffer();
      
      // Check for browser environment and AudioContext availability before instantiating
      if (typeof window === 'undefined') {
        throw new Error('Web Audio API not available');
      }

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error('Web Audio API not available');
      }

      // Use Web Audio API to decode the audio
      audioContext = new AudioContextCtor();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Resample to 16kHz if needed and convert to mono
      const targetSampleRate = 16000;
      const offlineContext = new OfflineAudioContext(
        1, // mono
        Math.round(audioBuffer.duration * targetSampleRate),
        targetSampleRate
      );
      
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start();
      
      const resampled = await offlineContext.startRendering();
      
      // Convert to 16-bit PCM
      const pcmData = resampled.getChannelData(0);
      const pcm16 = new Int16Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        // Clamp to [-1, 1] and convert to 16-bit integer
        const s = Math.max(-1, Math.min(1, pcmData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      return new Uint8Array(pcm16.buffer);
    } catch (err) {
      console.error('Failed to convert audio to PCM', err);
      throw err;
    } finally {
      // Close AudioContext to free system resources
      if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close();
      }
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
      finalTranscriptionRef.current = '';

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
          // Web browsers don't support audio/wav container for MediaRecorder
          // Using audio/webm which is widely supported. The audio will be
          // converted to PCM (16kHz, mono) on the client side before sending to Vosk
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(
        recordingOptions
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      debugLog('Recording started');

      // For web platform, set up real-time audio streaming
      if (Platform.OS === 'web' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          // Access the MediaRecorder from the recording object
          const mediaRecorder = newRecording._mediaRecorder;
          
          if (mediaRecorder) {
            // Set up event handler for audio data chunks
            mediaRecorder.addEventListener('dataavailable', async (event) => {
              if (event.data && event.data.size > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                try {
                  // Convert WebM chunk to PCM and send to server
                  const audioBlob = event.data;
                  const arrayBuffer = await audioBlob.arrayBuffer();
                  
                  // Use Web Audio API to decode and convert to PCM
                  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
                  if (AudioContextCtor) {
                    const audioContext = new AudioContextCtor();
                    try {
                      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                      
                      // Resample to 16kHz mono
                      const targetSampleRate = 16000;
                      const offlineContext = new OfflineAudioContext(
                        1,
                        Math.round(audioBuffer.duration * targetSampleRate),
                        targetSampleRate
                      );
                      
                      const source = offlineContext.createBufferSource();
                      source.buffer = audioBuffer;
                      source.connect(offlineContext.destination);
                      source.start();
                      
                      const resampled = await offlineContext.startRendering();
                      
                      // Convert to 16-bit PCM
                      const pcmData = resampled.getChannelData(0);
                      const pcm16 = new Int16Array(pcmData.length);
                      for (let i = 0; i < pcmData.length; i++) {
                        const s = Math.max(-1, Math.min(1, pcmData[i]));
                        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                      }
                      
                      // Send PCM data to WebSocket
                      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(new Uint8Array(pcm16.buffer));
                      }
                      
                      await audioContext.close();
                    } catch (err) {
                      debugLog('Error converting audio chunk:', err);
                      await audioContext.close();
                    }
                  }
                } catch (err) {
                  debugLog('Error processing audio chunk:', err);
                }
              }
            });
            
            // Request data every 1 second for real-time transcription
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.requestData();
              recordingIntervalRef.current = setInterval(() => {
                if (mediaRecorder.state === 'recording') {
                  mediaRecorder.requestData();
                }
              }, 1000);
            }
          }
        } catch (err) {
          debugLog('Failed to set up real-time streaming:', err);
        }
      }
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording: ' + err.message);
      closeWebSocket();
    }
  }

  async function stopRecording() {
    debugLog('Stopping recording..');
    
    // Clear the recording interval if it exists
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
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

      let pcmData = null;

      // Send recorded audio to WebSocket for transcription
      // For web: real-time streaming is already happening, so we skip sending the full recording
      // For native platforms: send the complete recording after stopping
      const isWeb = Platform.OS === 'web';
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isWeb) {
        try {
          // For native platforms (iOS/Android), audio is already in WAV format
          // Read the audio file and extract PCM data
          const response = await fetch(uri);
          const arrayBuffer = await response.arrayBuffer();
          const audioBytes = new Uint8Array(arrayBuffer);

          // Standard WAV header size is 44 bytes; skip these to get raw PCM data
          const WAV_HEADER_SIZE = 44;
          pcmData =
            audioBytes.length > WAV_HEADER_SIZE
              ? audioBytes.subarray(WAV_HEADER_SIZE)
              : audioBytes;

          // Send audio data in chunks with backpressure handling
          const chunkSize = 8000; // 8KB chunks
          for (let offset = 0; offset < pcmData.length; offset += chunkSize) {
            const chunk = pcmData.subarray(offset, offset + chunkSize);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(chunk);
              // Small delay to prevent overwhelming the WebSocket connection
              if (offset + chunkSize < pcmData.length) {
                await new Promise(resolve => setTimeout(resolve, 10));
              }
            } else {
              break;
            }
          }
          
          debugLog('Audio sent to transcription server');
        } catch (err) {
          console.error('Failed to send audio to transcription server', err);
        }
      }
      
      // Close WebSocket connection after a delay proportional to audio length
      // Estimate processing time based on audio duration
      const BYTES_PER_SAMPLE = 2; // 16-bit PCM
      const BASE_TIMEOUT_MS = 2000; // Minimum timeout
      const PROCESSING_TIME_PER_SECOND = 100; // Additional ms per second of audio
      
      const audioLengthEstimate = pcmData ? pcmData.length / (16000 * BYTES_PER_SAMPLE) : 0; // Duration in seconds
      const timeoutMs = Math.max(BASE_TIMEOUT_MS, audioLengthEstimate * PROCESSING_TIME_PER_SECOND + BASE_TIMEOUT_MS);
      setTimeout(() => {
        closeWebSocket();
      }, timeoutMs);
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
