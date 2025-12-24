// server.js
const vosk = require('vosk');
const WebSocket = require('ws');
const fs = require('fs');

vosk.setLogLevel(0);
const MODEL_PATH = 'model';
const SAMPLE_RATE = 16000;
const model = new vosk.Model(MODEL_PATH);

const wss = new WebSocket.Server({ port: 2700 });

wss.on('connection', function connection(ws) {
  const rec = new vosk.Recognizer({model: model, sampleRate: SAMPLE_RATE});
  ws.on('message', function incoming(message) {
    if (rec.acceptWaveform(message)) {
      ws.send(JSON.stringify({final: rec.result().text}));
    } else {
      ws.send(JSON.stringify({partial: rec.partialResult().partial}));
    }
  });
  ws.on('close', () => rec.free());
});