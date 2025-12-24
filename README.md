# audiotext

An audio recording application built with React Native and Expo for cross-platform mobile development.

## Project Structure

The React Native application is located in the `followalong` folder.

- `followalong/` - React Native app with audio recording and playback features
  - `App.js` - Main application component with audio recorder UI
  - `app.json` - Expo configuration
  - `assets/` - Images and static resources
  - `package.json` - Project dependencies and scripts

## Prerequisites

- Node.js (v20 or higher)
- npm or yarn
- Expo Go app on your mobile device (optional for testing)

## Setup

1. Navigate to the followalong directory:
```bash
cd followalong
```

2. Install dependencies:
```bash
npm install
```

## Running the App

The following commands assume you are running them from the `followalong` directory (see Setup step 1).

### Start the development server:
```bash
npm start
```

This will open Expo DevTools in your browser. From there, you can:

### Run on iOS:
```bash
npm run ios
```
Note: Requires macOS with Xcode installed

### Run on Android:
```bash
npm run android
```
Note: Requires Android Studio and Android SDK

### Run on Web:
```bash
npm run web
```

### Using Expo Go (Easiest for testing):
1. Install Expo Go app on your iOS or Android device
2. Run `npm start` from the followalong directory
3. Scan the QR code with your device's camera (iOS) or the Expo Go app (Android)

## Features

The FollowAlong app includes:
- **Start/Stop Recording**: Record audio using your device's microphone
- **Playback**: Play back recorded audio
- **Cross-platform**: Works on Web, iOS, and Android

## Development

This project uses Expo's managed workflow, which provides:
- Easy setup and configuration
- Cross-platform development (iOS, Android, Web)
- Over-the-air updates
- Rich set of APIs for native functionality

## Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Audio Documentation](https://docs.expo.dev/versions/latest/sdk/av/)
