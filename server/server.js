// server.js
const vosk = require('vosk');
const WebSocket = require('ws');
const fs = require('fs');

vosk.setLogLevel(0);
const MODEL_PATH = '../vosk-model-small-en-us-0.15';
const SAMPLE_RATE = 16000;

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

const wss = new WebSocket.Server({ port: 2700 });

wss.on('error', (err) => {
  console.error('WebSocket server failed:', err && err.message ? err.message : err);
  if (err && err.code === 'EADDRINUSE') {
    console.error('Port 2700 is already in use. Please stop the other process or use a different port.');
  }
  process.exit(1);
});

function sendSafe(socket, data) {
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
    try {
      if (rec.acceptWaveform(message)) {
        sendSafe(ws, JSON.stringify({final: rec.result().text}));
      } else {
        sendSafe(ws, JSON.stringify({partial: rec.partialResult().partial}));
      }
    } catch (err) {
      console.error('Error processing audio data:', err);
      sendSafe(ws, JSON.stringify({ error: 'Invalid audio data' }));
      ws.close();
    }
  });
  ws.on('close', () => rec.free());
});