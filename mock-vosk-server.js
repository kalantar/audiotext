// Mock Vosk WebSocket server for testing
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 2700 });

console.log('Mock Vosk server started on ws://localhost:2700');

wss.on('connection', function connection(ws) {
  console.log('Client connected');
  
  let audioChunkCount = 0;
  let wordIndex = 0;
  const testWords = ['hello', 'world', 'this', 'is', 'a', 'test', 'of', 'the', 'real', 'time', 
                     'transcription', 'feature', 'for', 'the', 'audio', 'recording', 'application'];
  
  ws.on('message', function incoming(message) {
    audioChunkCount++;
    console.log(`Received audio chunk #${audioChunkCount}, size: ${message.length} bytes`);
    
    // Simulate Vosk behavior:
    // - Send partial results as audio comes in
    // - Send final result when a phrase is complete
    
    if (audioChunkCount % 2 === 0 && wordIndex < testWords.length) {
      // Every 2 chunks, add a word to partial transcription
      const partialWords = testWords.slice(0, wordIndex + 1);
      const partial = partialWords.join(' ');
      ws.send(JSON.stringify({ partial: partial }));
      console.log(`  -> Sent partial: "${partial}"`);
      wordIndex++;
    }
    
    if (audioChunkCount % 5 === 0 && wordIndex > 0) {
      // Every 5 chunks, send a final result for the last few words
      const finalWords = testWords.slice(Math.max(0, wordIndex - 3), wordIndex);
      const final = finalWords.join(' ');
      if (final) {
        ws.send(JSON.stringify({ final: final }));
        console.log(`  -> Sent final: "${final}"`);
      }
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

wss.on('error', (err) => {
  console.error('WebSocket server error:', err);
});
