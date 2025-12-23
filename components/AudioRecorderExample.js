/**
 * Example component structure for future audio features
 * This demonstrates how to organize components in React Native
 */

import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

/**
 * Example component showing how audio features could be structured
 * This is a placeholder for future implementation
 */
export default function AudioRecorderExample() {
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);

  const handleStartRecording = () => {
    // TODO: Implement audio recording using expo-av or react-native-audio
    setIsRecording(true);
    console.log('Recording started (not implemented yet)');
  };

  const handleStopRecording = () => {
    // TODO: Implement stop recording and save file
    setIsRecording(false);
    setRecordingTime(0);
    console.log('Recording stopped (not implemented yet)');
  };

  const handleTranscribe = () => {
    // TODO: Implement speech-to-text transcription
    console.log('Transcription started (not implemented yet)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Audio Recorder</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: {isRecording ? 'Recording...' : 'Ready'}
        </Text>
        {isRecording && (
          <Text style={styles.timeText}>{recordingTime}s</Text>
        )}
      </View>

      <View style={styles.buttonsContainer}>
        {!isRecording ? (
          <TouchableOpacity 
            style={[styles.button, styles.recordButton]} 
            onPress={handleStartRecording}
          >
            <Text style={styles.buttonText}>Start Recording</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.button, styles.stopButton]} 
            onPress={handleStopRecording}
          >
            <Text style={styles.buttonText}>Stop Recording</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[styles.button, styles.transcribeButton]} 
          onPress={handleTranscribe}
          disabled={isRecording}
        >
          <Text style={styles.buttonText}>Transcribe</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          This is a placeholder component demonstrating how the audio recording 
          and transcription features could be structured.
        </Text>
        <Text style={styles.infoText}>
          To implement real functionality, you will need to:
        </Text>
        <Text style={styles.infoText}>• Install expo-av for audio recording</Text>
        <Text style={styles.infoText}>• Integrate a speech-to-text API</Text>
        <Text style={styles.infoText}>• Handle permissions for microphone access</Text>
        <Text style={styles.infoText}>• Implement file storage for recordings</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
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
  timeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 10,
  },
  buttonsContainer: {
    gap: 15,
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    backgroundColor: '#34C759',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  transcribeButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});
