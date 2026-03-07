// hooks/speech/vosk.js
// Web STT implementation: streams audio to local Vosk WebSocket server.
// Extracted from App.js - no logic changes.

const WS_URL = 'ws://localhost:2700';
const TARGET_SAMPLE_RATE = 16000;

export function createVoskSTT({ onPartial, onFinal, onError }) {
  let ws = null;
  let mediaStream = null;
  let audioContext = null;
  let workletNode = null;
  let scriptProcessor = null;
  let sourceNode = null;
  // Internal accumulation: Vosk partials are per-utterance; we prepend committed finals.
  let finalAccumulated = '';

  function sendSafe(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }

  function connectWS() {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => resolve(ws);
      ws.onerror = (err) => { ws = null; reject(err); };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.partial) {
            const combined = finalAccumulated
              ? finalAccumulated + ' ' + data.partial
              : data.partial;
            onPartial(combined);
          } else if (data.final && data.final.trim().length > 0) {
            const newFinal = finalAccumulated
              ? finalAccumulated + ' ' + data.final
              : data.final;
            finalAccumulated = newFinal;
            onFinal(newFinal);
          }
        } catch (err) {
          // ignore parse errors
        }
      };
      ws.onclose = () => { ws = null; };
    });
  }

  async function startListening() {
    finalAccumulated = '';
    try {
      await connectWS();
    } catch (err) {
      onError(new Error('Could not connect to transcription server'));
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextCtor();
      const sourceSampleRate = audioContext.sampleRate;
      sourceNode = audioContext.createMediaStreamSource(mediaStream);

      // Try AudioWorklet (modern), fall back to ScriptProcessorNode
      if (audioContext.audioWorklet) {
        try {
          await audioContext.audioWorklet.addModule('/audio-processor.js');
          workletNode = new AudioWorkletNode(audioContext, 'audio-processor', {
            processorOptions: { sourceSampleRate, targetSampleRate: TARGET_SAMPLE_RATE },
          });
          sourceNode.connect(workletNode);
          workletNode.connect(audioContext.destination);
          workletNode.port.onmessage = (event) => {
            const samples = event.data.samples;
            const pcm16 = new Int16Array(samples.length);
            for (let i = 0; i < samples.length; i++) {
              pcm16[i] = Math.max(-32768, Math.min(32767, samples[i] * 32768));
            }
            sendSafe(new Uint8Array(pcm16.buffer));
          };
          return; // worklet path set up successfully
        } catch (_) {
          // fall through to ScriptProcessorNode
        }
      }

      // ScriptProcessorNode fallback
      const bufferSize = 4096;
      scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      sourceNode.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);
      const ratio = sourceSampleRate / TARGET_SAMPLE_RATE;
      let accumulated = [];
      const samplesPerChunk = TARGET_SAMPLE_RATE / 4;
      scriptProcessor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        for (let i = 0; i < input.length; i += ratio) {
          accumulated.push(input[Math.floor(i)]);
        }
        if (accumulated.length >= samplesPerChunk) {
          const chunk = accumulated.splice(0, samplesPerChunk);
          const pcm16 = new Int16Array(chunk.length);
          for (let i = 0; i < chunk.length; i++) {
            pcm16[i] = Math.max(-32768, Math.min(32767, chunk[i] * 32768));
          }
          sendSafe(new Uint8Array(pcm16.buffer));
        }
      };
    } catch (err) {
      onError(err);
    }
  }

  function stopListening() {
    if (workletNode) { workletNode.disconnect(); workletNode = null; }
    if (scriptProcessor) { scriptProcessor.disconnect(); scriptProcessor = null; }
    if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    // Give Vosk a moment to send final result before closing WebSocket
    setTimeout(() => {
      if (ws && ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
      ws = null;
    }, 3000);
  }

  return { startListening, stopListening };
}
