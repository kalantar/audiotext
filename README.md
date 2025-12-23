# audiotext

A minimal React web application for recording audio in the browser.

## Features

- Record audio using the browser's MediaRecorder API
- Play back recorded audio
- Simple, clean interface

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

### Development

Start the development server:
```bash
npm run dev
```

Then open your browser to the URL shown in the terminal (typically http://localhost:5173/).

### Build

Build the project for production:
```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview Production Build

Preview the production build locally:
```bash
npm run preview
```

## Project Structure

- `index.html` - HTML entry point
- `src/index.jsx` - React entry point
- `src/App.jsx` - Main app component
- `src/AudioRecorder.jsx` - Audio recording component
- `vite.config.js` - Vite configuration

## Technologies Used

- React 18
- Vite (build tool)
- MediaRecorder API