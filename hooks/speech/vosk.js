// hooks/speech/vosk.js
// Web STT implementation: streams audio to local Vosk WebSocket server.

// Web-only: Vosk server must be running locally on the same machine.
// This module is bundled on all platforms (Metro cannot tree-shake by platform at this layer),
// but createVoskSTT() is only called on web (see hooks/useSpeechRecognition.js).
// Any module-level globals using browser APIs (window, navigator, AudioContext) would break
// native — keep all such references inside createVoskSTT() or its nested functions.
const WS_URL = 'ws://localhost:2700';
const TARGET_SAMPLE_RATE = 16000;

export function createVoskSTT({ onPartial, onFinal, onError }) {
  let ws = null;
  let mediaStream = null;
  let audioContext = null;
  let workletNode = null;
  let scriptProcessor = null;
  let sourceNode = null;
  // Internal accumulation: Vosk partials are per-utterance; we prefix each partial/final
  // with previously committed finals to build a full-session transcript.
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
      ws.onerror = (err) => { console.error('[vosk] WebSocket error connecting to', WS_URL, err); ws = null; reject(err); };
      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (err) {
          // Non-JSON frame from server — log and skip
          console.warn('[vosk] Received non-JSON message from server:', String(event.data).slice(0, 100));
          return;
        }
        // Callback errors are not caught here. If onPartial/onFinal throw synchronously,
        // the error escapes the onmessage handler uncaught. Keep those callbacks non-throwing.
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
      };
      ws.onclose = () => { ws = null; };
    });
  }

  async function startListening() {
    finalAccumulated = '';
    try {
      await connectWS();
    } catch (err) {
      const detail = err?.message ? ` (${err.message})` : '';
      onError(new Error(
        `Could not connect to the transcription server at ${WS_URL}${detail}. ` +
        'Make sure the server is running: cd server && npm start'
      ));
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextCtor();
      const sourceSampleRate = audioContext.sampleRate;
      sourceNode = audioContext.createMediaStreamSource(mediaStream);

      // Try AudioWorklet (modern), fall back to ScriptProcessorNode.
      // The worklet module path '/audio-processor.js' is relative to the web root (public/).
      // If it's missing or blocked, the error is logged and execution continues with
      // ScriptProcessorNode — check the network tab if worklet behavior is expected but absent.
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
          return;
        } catch (workletErr) {
          console.error('[vosk] AudioWorklet setup failed, falling back to ScriptProcessorNode:', workletErr.message);
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
      // Clean up any partially initialized resources before surfacing the error.
      // Without this, a getUserMedia or AudioContext failure would leave the WebSocket
      // open (server accumulates idle connections) and the mic track live (browser
      // microphone indicator stays lit).
      if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
        audioContext = null;
      }
      workletNode = null;
      scriptProcessor = null;
      sourceNode = null;
      const wsToClose = ws; ws = null;
      if (wsToClose && wsToClose.readyState !== WebSocket.CLOSING && wsToClose.readyState !== WebSocket.CLOSED) {
        wsToClose.close();
      }
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
      audioContext.close().catch((err) => {
        console.warn('[vosk] Error closing AudioContext on stop:', err.message);
      });
      audioContext = null;
    }
    // Capture ws reference before clearing it — prevents a new session started within
    // the 3s window from having its WebSocket closed by this timeout.
    const wsToClose = ws;
    ws = null;
    // 3s gives Vosk time to finalize a long utterance before the connection closes.
    // Reduce with caution — closing too early interrupts mid-utterance finalization.
    setTimeout(() => {
      if (wsToClose && wsToClose.readyState !== WebSocket.CLOSING && wsToClose.readyState !== WebSocket.CLOSED) {
        wsToClose.close();
      }
    }, 3000);
  }

  return { startListening, stopListening };
}
