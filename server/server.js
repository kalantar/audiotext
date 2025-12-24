// server.js
const vosk = require('vosk');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

vosk.setLogLevel(0);
const MODEL_PATH = path.join(__dirname, '..', 'vosk-model-small-en-us-0.15');
const SAMPLE_RATE = 16000;
const WS_PORT = process.env.WS_PORT || 2700;

let model;

try {
  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error(`Model path does not exist: ${MODEL_PATH}`);
  }
  model = new vosk.Model(MODEL_PATH);
} catch (err) {
  console.error('Failed to create Vosk model at path "%s": %s', MODEL_PATH, err && err.message ? err.message : err);
  process.exit(1);
}

const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('error', (err) => {
  console.error('WebSocket server failed:', err && err.message ? err.message : err);
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${WS_PORT} is already in use. Please stop the other process or use a different port.`);
  }
  process.exit(1);
});

function sendIfOpen(socket, data) {
  if (socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(data);
    } catch (err) {
      console.error('WebSocket send error:', err);
    }
  }
}

wss.on('connection', function connection(ws) {
  const rec = new vosk.Recognizer({model: model, sampleRate: SAMPLE_RATE});
  
  ws.on('message', function incoming(message) {
    // Validate incoming message
    let audioData;

    if (Buffer.isBuffer(message)) {
      audioData = message;
    } else if (message instanceof ArrayBuffer) {
      audioData = Buffer.from(message);
    } else if (message instanceof Uint8Array) {
      audioData = Buffer.from(message);
    } else {
      console.error('Received invalid audio data type:', typeof message);
      sendIfOpen(ws, JSON.stringify({ error: 'Invalid audio data type' }));
      ws.close();
      return;
    }

    try {
      if (rec.acceptWaveform(audioData)) {
        sendIfOpen(ws, JSON.stringify({final: rec.result().text}));
      } else {
        sendIfOpen(ws, JSON.stringify({partial: rec.partialResult().partial}));
      }
    } catch (err) {
      console.error('Error processing audio data:', err);
      const errorResponse = {
        error: 'Error processing audio data on server'
      };
      if (err && err.message) {
        errorResponse.details = err.message;
      }
      sendIfOpen(ws, JSON.stringify(errorResponse));
      ws.close();
    }
  });
  
  ws.on('close', () => rec.free());
  ws.on('error', () => rec.free());
});