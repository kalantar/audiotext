# GitHub Copilot Instructions for audiotext

This repository contains a React Native audio recording application built with Expo for cross-platform mobile development.

## Project Overview

**audiotext** (also known as "FollowAlong") is a mobile application that enables users to:
- Record audio using their device's microphone
- Recognize speech
- Use text to look up text in a corpus of texts (available online)
- Display to the user the recognized speech in context of full source so user can "follow along"
- Run on Web, iOS, and Android platforms

## Technology Stack

- **Framework**: React Native with Expo (~54.0.30)
- **Language**: JavaScript (ES6+)
- **UI Framework**: React Native components
- **Audio**: Expo AV (expo-av ^16.0.8)
- **Backend**: Node.js WebSocket server with Vosk for speech recognition
- **Dependencies**: React 19.1.0, React Native 0.81.5

## Project Structure

```
audiotext/
├── App.js                  # Main React Native component with audio recorder UI
├── server.js               # WebSocket server for speech recognition using Vosk
├── index.js                # Expo entry point
├── app.json                # Expo configuration
├── package.json            # Dependencies and scripts
├── assets/                 # Images and static resources
└── vosk-model-small-en-us-0.15/  # Vosk speech recognition model
```

## Build and Run Commands

- `npm install` - Install dependencies
- `npm start` - Start the Expo development server
- `npm run ios` - Run on iOS (requires macOS with Xcode)
- `npm run android` - Run on Android (requires Android Studio)
- `npm run web` - Run on web browser

## Coding Conventions

### General Practices

1. **State Management**: Use React hooks (`useState`, `useEffect`) for state management
2. **Error Handling**: Always wrap async operations in try-catch blocks and use `Alert.alert()` for user-facing errors
3. **Logging**: Use the `debugLog` helper function for development-only logging (controlled by `__DEV__` constant)
4. **Comments**: Add comments for complex logic, especially around audio permissions and state management

### Code Style

- Use functional components with hooks (not class components)
- Use `async/await` for asynchronous operations
- Use `const` for variable declarations unless reassignment is needed
- Follow React Native StyleSheet for styling (avoid inline styles)
- Use destructuring for props and state

### Audio-Specific Patterns

1. **Permissions**: Always request and check audio permissions before recording
2. **Resource Cleanup**: Properly unload audio resources using `useEffect` cleanup functions
3. **State Guards**: Prevent duplicate operations (e.g., check `isRecording` before starting a new recording)
4. **Audio Mode**: Set appropriate audio mode for iOS (`allowsRecordingIOS`, `playsInSilentModeIOS`)

### Error Handling

- Log errors to console using `console.error()`
- Display user-friendly error messages using `Alert.alert()`
- Include error messages from caught exceptions in alerts
- Handle WebSocket errors gracefully with safe send functions

### Server-Side Patterns (server.js)

- Use Vosk library for speech recognition
- Handle WebSocket connections with proper error handling
- Free recognizer resources on connection close
- Validate model path before starting server
- Use safe WebSocket send function to check connection state

## Best Practices

1. **Security**: Never log sensitive data in production (use `__DEV__` checks)
2. **Performance**: Unload audio resources when not in use to prevent memory leaks
3. **Cross-Platform**: Test audio functionality on multiple platforms (iOS, Android, Web)
4. **User Experience**: Provide clear status indicators for recording, playback, and errors
5. **Accessibility**: Use meaningful button labels and status text

## Common Patterns

### Starting Audio Recording
```javascript
const permission = await Audio.requestPermissionsAsync();
if (permission.status !== 'granted') {
  Alert.alert('Permission Denied', 'Message...');
  return;
}
await Audio.setAudioModeAsync({
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
});
const { recording } = await Audio.Recording.createAsync(
  Audio.RecordingOptionsPresets.HIGH_QUALITY
);
```

### Cleanup Pattern
```javascript
React.useEffect(() => {
  return sound
    ? () => {
        sound.unloadAsync().catch((err) => {
          console.error('Failed to unload sound', err);
        });
      }
    : undefined;
}, [sound]);
```

## Dependencies

When suggesting new dependencies:
- Prefer Expo-compatible libraries
- Check compatibility with React Native 0.81.5
- Consider cross-platform support (iOS, Android, Web)
- Verify compatibility with Expo SDK 54

## Testing

- Test on actual devices or Expo Go app for audio features
- Web platform has limited audio API support
- Verify microphone permissions work correctly on each platform
