import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Alert, ScrollView, Platform, SafeAreaView, Dimensions } from 'react-native';
import { Audio } from 'expo-av';
import { Provider as PaperProvider, MD3LightTheme, FAB, IconButton, Portal, Modal } from 'react-native-paper';
import MatchedTextWidget from './components/MatchedTextWidget';
import { findBestMatch, findHighlightPosition, getDocumentMetadata, debounce } from './utils/textMatcher';
import textAssets from './assets/textAssets';

// Development-only logging helper
// __DEV__ is a built-in React Native constant that is automatically:
// - true in development builds (enables logging)
// - false in production builds (disables logging for performance and security)
const debugLog = (...args) => {
  if (__DEV__) {
    console.log(...args);
  }
};

// Helper function to get last N words from text
const getLastWords = (text, wordCount) => {
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  if (words.length <= wordCount) {
    return text;
  }
  return words.slice(-wordCount).join(' ');
};

// WebSocket server configuration
// Auto-detects platform and returns appropriate URL:
// - Web: localhost (server running on same machine)
// - iOS/Android: Local network IP (for physical devices)
const getWebSocketUrl = () => {
  if (Platform.OS === 'web') {
    return 'ws://localhost:2700';
  }

  // For iOS/Android physical devices, use your development machine's IP
  // Update this IP to match your machine's local network address
  const DEV_SERVER_IP = '192.168.1.198';
  return `ws://${DEV_SERVER_IP}:2700`;
};

const WS_SERVER_URL = getWebSocketUrl();

// Number of recent words to use for text matching
// Large enough for noisy/KJ-English transcription signal, small enough to track progression
const MATCH_WINDOW_WORDS = 45;

const customTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#9d5c0d', // Warm brown for Bahá'í aesthetic
    primaryContainer: '#f5e6d3', // Light cream
    secondary: '#6b4423',
    surface: '#fdfaf5', // Off-white paper color
    surfaceVariant: '#f5f0e8',
    background: '#f5f5f0',
    elevation: {
      level0: 'transparent',
      level1: '#fdfaf5',
      level2: '#faf7f2',
      level3: '#f7f4ef',
      level4: '#f5f2ed',
      level5: '#f2efea',
    }
  },
  fonts: {
    ...MD3LightTheme.fonts,
    bodyLarge: {
      ...MD3LightTheme.fonts.bodyLarge,
      fontFamily: 'Georgia', // Serif for reading
      fontSize: 18,
      lineHeight: 28,
    },
    bodyMedium: {
      ...MD3LightTheme.fonts.bodyMedium,
      fontFamily: 'Georgia',
      fontSize: 16,
      lineHeight: 24,
    },
  },
};

export default function App() {
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const wsRef = useRef(null);
  const finalTranscriptionRef = useRef('');
  const webMediaStreamRef = useRef(null);
  const workletNodeRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioContextRef = useRef(null);

  // Text matching state
  const [isMatching, setIsMatching] = useState(false);
  const [matchState, setMatchState] = useState({
    isLoading: false,
    matchedDocument: null,
    matchedContent: null,
    highlightPosition: null,
    confidence: 0
  });
  const searchIndexRef = useRef(null);
  const documentCacheRef = useRef({});
  const matchContextRef = useRef({
    previousDocId: null,
    previousParagraphNum: null,
    previousSection: null,
    previousScore: 0,
    // Paragraph-based highlight tracking
    firstParagraphNum: null,  // First paragraph matched in this section
    currentParagraphNum: null, // Current/latest paragraph matched
    matchHistory: []  // Track last 3 matches for temporal continuity
  });
  const audioChunksRef = useRef([]); // Circular buffer for recent audio

  // Initialize WebSocket connection
  const connectWebSocket = () => {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(WS_SERVER_URL);
        
        ws.onopen = () => {
          debugLog('WebSocket connected');
          wsRef.current = ws;
          resolve(ws);
        };
        
        ws.onerror = (error) => {
          debugLog('WebSocket error:', error);
          wsRef.current = null;
          reject(error);
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.partial) {
              // Partial results replace the current partial text (not append)
              // Vosk sends the complete partial transcription so far, not incremental
              const combined = finalTranscriptionRef.current && finalTranscriptionRef.current.trim().length > 0
                ? finalTranscriptionRef.current + ' ' + data.partial
                : data.partial;
              setTranscription(combined);

              // Trigger text matching using a sliding window of recent words
              const recentText = getLastWords(combined, MATCH_WINDOW_WORDS);
              const wordsToMatch = recentText.split(/\s+/).filter(w => w.length > 0);
              if (wordsToMatch.length >= 3) {
                setIsMatching(true);
                performTextMatch(wordsToMatch);
              }
            } else if (data.final && data.final.trim().length > 0) {
              // Final results are appended to the accumulated final transcription
              const newFinal = finalTranscriptionRef.current && finalTranscriptionRef.current.trim().length > 0
                ? finalTranscriptionRef.current + ' ' + data.final
                : data.final;
              finalTranscriptionRef.current = newFinal;
              // Update display with the new final transcription
              setTranscription(newFinal);

              // Trigger text matching using a sliding window of recent words
              const recentText = getLastWords(newFinal, MATCH_WINDOW_WORDS);
              const wordsToMatch = recentText.split(/\s+/).filter(w => w.length > 0);
              if (wordsToMatch.length >= 3) {
                setIsMatching(true);
                performTextMatch(wordsToMatch);
              }
            }
          } catch (err) {
            debugLog('Error parsing transcription:', err);
          }
        };
        
        ws.onclose = () => {
          debugLog('WebSocket closed');
          wsRef.current = null;
        };
      } catch (err) {
        reject(err);
      }
    });
  };

  // Close WebSocket connection
  const closeWebSocket = () => {
    if (wsRef.current) {
      const ws = wsRef.current;
      if (ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
      wsRef.current = null;
    }
  };

  // Load search index on mount
  useEffect(() => {
    const loadSearchIndex = async () => {
      console.log('[MATCH] Loading search index...');
      try {
        if (Platform.OS === 'web') {
          // Web: load from public folder
          const response = await fetch('/search-index.json');
          console.log('[MATCH] Fetch response:', response.status, response.ok);
          if (response.ok) {
            const index = await response.json();
            searchIndexRef.current = index;
            console.log('[MATCH] Search index loaded:', index.documents?.length, 'entries');
          } else {
            console.log('[MATCH] Search index not found - text matching disabled');
          }
        } else {
          // Native (iOS/Android): require from assets folder
          const index = require('./assets/search-index.json');
          searchIndexRef.current = index;
          console.log('[MATCH] Search index loaded (native):', index.documents?.length, 'entries');
        }
      } catch (err) {
        console.log('[MATCH] Failed to load search index:', err.message);
      }
    };

    loadSearchIndex();
  }, []);

  // Fetch full section content when a match is found
  // Returns the entire section text with paragraph offsets for cross-paragraph highlighting
  const fetchDocumentContent = useCallback(async (docId, section, paragraphNum) => {
    // Cache by section (not paragraph) since we now fetch full sections
    const cacheKey = `${docId}-${section}`;
    if (documentCacheRef.current[cacheKey]) {
      console.log('[FETCH] Cache hit:', cacheKey);
      return documentCacheRef.current[cacheKey];
    }

    try {
      console.log('[FETCH] Fetching document:', docId, 'section:', section);

      let doc;
      if (Platform.OS === 'web') {
        // Web: fetch from public folder
        const response = await fetch(`/texts/${docId}.json`);
        if (!response.ok) {
          console.log('[FETCH] Document not found:', docId, response.status);
          throw new Error(`Document not found: ${docId}`);
        }
        doc = await response.json();
      } else {
        // Native (iOS/Android): load from bundled assets
        doc = textAssets[docId];
        if (!doc) {
          console.log('[FETCH] Document not found in assets:', docId);
          throw new Error(`Document not found: ${docId}`);
        }
      }

      console.log('[FETCH] Document loaded, sections:', doc.sections?.length);

      // Find the section by title (sections is an array, not an object)
      // Normalize for comparison: handle whitespace and case differences
      const normalize = s => s?.trim().toLowerCase();
      const matchingSections = doc.sections?.filter(
        s => normalize(s.title) === normalize(section)
      );
      // If multiple sections share the same title (e.g. Gems of Divine Mysteries),
      // pick the one that contains enough paragraphs to include the matched paragraphNum
      const sectionObj = matchingSections?.find(s => (s.paragraphs?.length ?? 0) >= paragraphNum)
        ?? matchingSections?.[0];

      if (!sectionObj) {
        console.log('[FETCH] Section not found:', section,
          'Available:', doc.sections?.map(s => `"${s.title}"(${s.paragraphs?.length}p)`).join(', '));
      } else {
        console.log('[FETCH] Section found:', sectionObj.title,
          `(${sectionObj.paragraphs?.length} paragraphs)`);
      }

      if (sectionObj && sectionObj.paragraphs) {
        // Build full section text and track paragraph offsets
        const paragraphOffsets = []; // Start offset of each paragraph
        let fullText = '';

        for (let i = 0; i < sectionObj.paragraphs.length; i++) {
          paragraphOffsets.push(fullText.length);
          fullText += sectionObj.paragraphs[i];
          // Add paragraph separator (double newline) between paragraphs
          if (i < sectionObj.paragraphs.length - 1) {
            fullText += '\n\n';
          }
        }

        console.log('[FETCH] Full section:', sectionObj.paragraphs.length, 'paragraphs,', fullText.length, 'chars');

        const content = {
          docId,
          title: doc.title,
          author: doc.author,
          url: doc.url,
          section,
          text: fullText,
          paragraphOffsets, // Array of start positions for each paragraph
          paragraphCount: sectionObj.paragraphs.length
        };

        // Cache for future use
        documentCacheRef.current[cacheKey] = content;
        console.log('[FETCH] Content cached and returning');
        return content;
      }
    } catch (err) {
      console.log('[FETCH] Error:', err.message);
    }

    console.log('[FETCH] Returning null - content not found');
    return null;
  }, []);

  // Perform text matching (debounced)
  // Stickiness threshold: require this much higher score to switch to different document/paragraph
  const SWITCH_THRESHOLD = 0.15;  // require meaningful score gain to switch to different section/document

  const performTextMatch = useCallback(
    debounce(async (words) => {
      try {
        // Log summary: first 5 words ... last 5 words
        const wordsSummary = words.length <= 12
          ? words.join(' ')
          : words.slice(0, 5).join(' ') + ' ... ' + words.slice(-5).join(' ');
        console.log('[MATCH] performTextMatch called with', words.length, 'words:', wordsSummary);
        if (!searchIndexRef.current) {
          console.log('[MATCH] No search index loaded');
          return;
        }
        if (words.length < 8) {
          console.log('[MATCH] Not enough words (need 8+):', words.length);
          return;
        }

        // Temporal continuity: detect if last 2-3 matches show sequential progression
        let prediction = null;
        const history = matchContextRef.current.matchHistory || [];
        if (history.length >= 2) {
          // Check if last 2-3 entries form a valid sequence
          const isSequential = history.every((entry, idx) => {
            if (idx === 0) return true;
            const prev = history[idx - 1];
            // Same document, and paragraph stays same or increments by 1
            return entry.docId === prev.docId &&
                   (entry.paragraphNum === prev.paragraphNum ||
                    entry.paragraphNum === prev.paragraphNum + 1);
          });

          if (isSequential) {
            const lastMatch = history[history.length - 1];
            prediction = {
              docId: lastMatch.docId,
              paragraphNum: lastMatch.paragraphNum + 1  // Predict next paragraph
            };
            console.log('[MATCH] Temporal continuity detected: predicting',
              prediction.docId, 'paragraph', prediction.paragraphNum);
          }
        }

        const match = findBestMatch(words, searchIndexRef.current, matchContextRef.current, prediction);
        console.log('[MATCH] findBestMatch result:', match ? `${match.docId} score=${match.score?.toFixed(2)}` : 'no match');

        if (match) {
          const ctx = matchContextRef.current;
          // Check if we're in the same section (allow free movement within section)
          const isSameSectionMatch = ctx.previousDocId === match.docId &&
                                     ctx.previousSection === match.section;

          // Apply stickiness: require higher score to switch to a different section/document
          // Movement within the same section is allowed without penalty
          if (!isSameSectionMatch && ctx.previousDocId) {
            const scoreDiff = match.score - ctx.previousScore;
            if (scoreDiff < SWITCH_THRESHOLD) {
              console.log('[MATCH] Stickiness: staying in current section (score diff:', scoreDiff.toFixed(2), ')');
              return; // Don't switch - not confident enough
            }
            console.log('[MATCH] Moving to new section (score diff:', scoreDiff.toFixed(2), ')');
          }

          console.log('[MATCH] Match found:', match.docId, match.section, 'paragraphNum:', match.paragraphNum, 'score:', match.score.toFixed(2));

          // Check if we're in the same section (full section is now displayed)
          const isSameSection = ctx.previousDocId === match.docId &&
                                ctx.previousSection === match.section;

          // Fetch full section content
          setMatchState(prev => ({ ...prev, isLoading: true }));

          const content = await fetchDocumentContent(match.docId, match.section, match.paragraphNum);

          if (content) {
            // Paragraph-based highlighting: highlight from first matched paragraph to current
            const currentParagraphIndex = match.paragraphNum - 1; // paragraphNum is 1-indexed

            // Check if this is a valid sequential progression
            const isSameParagraph = isSameSection && ctx.currentParagraphNum === match.paragraphNum;
            const isNextParagraph = isSameSection && match.paragraphNum === ctx.currentParagraphNum + 1;
            // Re-lock: switching to a better document but landing on same paragraph we already confirmed
            const isRelock = !isSameSection && match.paragraphNum === ctx.currentParagraphNum;
            const isValidProgression = isSameParagraph || isNextParagraph || isRelock;

            let firstParagraphIndex;
            if (isValidProgression && ctx.firstParagraphNum !== null) {
              // Valid progression: keep tracking from first matched paragraph
              firstParagraphIndex = ctx.firstParagraphNum - 1;
              console.log('[MATCH] Valid progression:', isSameParagraph ? 'same paragraph' : isNextParagraph ? 'next paragraph' : 're-lock');
            } else {
              // Non-sequential jump or new section: reset highlight to current paragraph
              firstParagraphIndex = currentParagraphIndex;
              if (isSameSection && !isValidProgression) {
                console.log('[MATCH] Non-sequential jump from paragraph', ctx.currentParagraphNum, 'to', match.paragraphNum, '- resetting highlight');
              }
            }

            // Calculate highlight start: beginning of first matched paragraph
            const highlightStart = content.paragraphOffsets[firstParagraphIndex] || 0;

            // Calculate highlight end: end of current paragraph
            const nextParagraphOffset = content.paragraphOffsets[currentParagraphIndex + 1];
            const highlightEnd = nextParagraphOffset !== undefined
              ? nextParagraphOffset - 2  // Subtract 2 for '\n\n' separator
              : content.text.length;

            // Calculate current paragraph position for scrolling
            const currentParagraphStart = content.paragraphOffsets[currentParagraphIndex] || 0;
            const currentParagraphEnd = highlightEnd;

            const highlightPosition = {
              start: highlightStart,
              end: highlightEnd,
              currentStart: currentParagraphStart,  // For scrolling to current paragraph
              currentEnd: currentParagraphEnd,
              contextStart: 0,
              contextEnd: content.text.length
            };

            console.log('[MATCH] Paragraph-based highlight: paragraphs', firstParagraphIndex + 1, 'to', currentParagraphIndex + 1,
              '(chars', highlightStart, '-', highlightEnd, ')');

            // Update match history for temporal continuity (keep last 3)
            const newHistoryEntry = {
              docId: match.docId,
              paragraphNum: match.paragraphNum,
              section: match.section
            };
            const updatedHistory = [...(ctx.matchHistory || []), newHistoryEntry].slice(-3);

            // Update match context for continuity
            matchContextRef.current = {
              previousDocId: match.docId,
              previousParagraphNum: match.paragraphNum,
              previousSection: match.section,
              previousScore: match.score,
              firstParagraphNum: firstParagraphIndex + 1,  // Store as 1-indexed
              currentParagraphNum: match.paragraphNum,
              matchHistory: updatedHistory
            };

            // Get metadata
            const metadata = getDocumentMetadata(searchIndexRef.current, match.docId);

            setMatchState({
              isLoading: false,
              matchedDocument: {
                ...content,
                title: metadata?.title || content.title,
                author: metadata?.author || content.author,
                url: metadata?.url || content.url
              },
              matchedContent: content.text,
              highlightPosition,
              confidence: match.score
            });
          } else {
            setMatchState(prev => ({ ...prev, isLoading: false }));
          }
        }
      } finally {
        setIsMatching(false);
      }
    }, 250),  // Debounce interval - optimized for faster matching while maintaining stability
    [fetchDocumentContent]
  );

  // Convert recorded WebM audio to raw PCM format for Vosk (16kHz, 16-bit, mono).
  //
  // Processing pipeline:
  // 1. Fetch the recorded audio file (typically WebM/Opus from Expo on the web) into an ArrayBuffer.
  // 2. Use the Web Audio API (AudioContext.decodeAudioData) to decode the compressed WebM data
  //    into an uncompressed AudioBuffer (PCM Float32 samples at the original sample rate / channels).
  // 3. Create an OfflineAudioContext configured for:
  //      - 1 channel (mono)
  //      - target sample rate of 16,000 Hz (Vosk's expected input rate)
  //      - a length based on the original duration at 16 kHz
  //    and render the decoded AudioBuffer into this context to resample and downmix to mono.
  // 4. Extract the resampled mono Float32 channel data and convert each sample to a 16‑bit
  //    signed integer (Int16) by:
  //      - clamping the float sample to the range [-1.0, 1.0]
  //      - scaling negative values by 0x8000 and non‑negative values by 0x7FFF
  // 5. Return the underlying Int16Array buffer as a Uint8Array so it can be sent over the
  //    WebSocket connection to the Vosk server as raw 16‑bit PCM audio.
  //
  // This function is only called on web platforms where window and AudioContext are available.
  const convertToPCM = async (audioUri) => {
    let audioContext = null;
    
    try {
      // Fetch the audio file
      const response = await fetch(audioUri);
      const arrayBuffer = await response.arrayBuffer();
      
      // Check for browser environment and AudioContext availability before instantiating
      if (typeof window === 'undefined') {
        throw new Error('Web Audio API not available');
      }

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error('Web Audio API not available');
      }

      // Use Web Audio API to decode the audio
      audioContext = new AudioContextCtor();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Resample to 16kHz if needed and convert to mono
      const targetSampleRate = 16000;
      const offlineContext = new OfflineAudioContext(
        1, // mono
        Math.round(audioBuffer.duration * targetSampleRate),
        targetSampleRate
      );
      
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start();
      
      const resampled = await offlineContext.startRendering();
      
      // Convert to 16-bit PCM
      const pcmData = resampled.getChannelData(0);
      const pcm16 = new Int16Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        // Clamp to [-1, 1] and convert to 16-bit integer
        const s = Math.max(-1, Math.min(1, pcmData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      return new Uint8Array(pcm16.buffer);
    } catch (err) {
      console.error('Failed to convert audio to PCM', err);
      throw err;
    } finally {
      // Close AudioContext to free system resources
      if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close();
      }
    }
  };

  async function startRecording() {
    // Prevent starting a new recording if one is already in progress
    if (recording || isRecording) {
      debugLog('Recording already in progress, ignoring start request');
      return;
    }

    try {
      debugLog('Requesting permissions..');
      const permission = await Audio.requestPermissionsAsync();
      
      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant microphone permissions to record audio.');
        return;
      }

      // Connect to WebSocket server for transcription
      try {
        await connectWebSocket();
      } catch (err) {
        console.error('Failed to connect to transcription server', err);
        Alert.alert('Warning', 'Could not connect to transcription server. Recording will work but transcription will not be available.');
      }

      // Clear previous transcription and match state
      setTranscription('');
      finalTranscriptionRef.current = '';
      matchContextRef.current = {
        previousDocId: null,
        previousParagraphNum: null,
        previousSection: null,
        previousScore: 0,
        firstParagraphNum: null,
        currentParagraphNum: null,
        matchHistory: []
      };
      setMatchState({
        isLoading: false,
        matchedDocument: null,
        matchedContent: null,
        highlightPosition: null,
        confidence: 0
      });

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      debugLog('Starting recording..');
      
      // Configure recording for 16kHz sample rate (required by Vosk)
      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          // Web browsers don't support audio/wav container for MediaRecorder
          // Using audio/webm which is widely supported. The audio will be
          // converted to PCM (16kHz, mono) on the client side before sending to Vosk
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(
        recordingOptions
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      debugLog('Recording started');

      // For web platform, set up real-time audio streaming
      // DEBUG: Log conditions for real-time streaming setup
      debugLog('[DEBUG] Platform.OS:', Platform.OS);
      debugLog('[DEBUG] wsRef.current:', wsRef.current ? 'exists' : 'null');
      debugLog('[DEBUG] WebSocket readyState:', wsRef.current?.readyState, '(OPEN=' + WebSocket.OPEN + ', CONNECTING=' + WebSocket.CONNECTING + ')');

      if (Platform.OS === 'web' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        debugLog('[DEBUG] Entered web real-time streaming setup block');
        try {
          // Get audio stream from microphone
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          webMediaStreamRef.current = stream;
          debugLog('[DEBUG] Got media stream from getUserMedia');

          // Create AudioContext at the browser's native sample rate
          const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextCtor) {
            throw new Error('Web Audio API not available');
          }

          audioContextRef.current = new AudioContextCtor();
          const ctx = audioContextRef.current;
          debugLog('[DEBUG] AudioContext created, sampleRate:', ctx.sampleRate, 'state:', ctx.state);

          // Create source from microphone stream
          const source = ctx.createMediaStreamSource(stream);
          sourceNodeRef.current = source;

          // Try AudioWorkletNode first (modern, future-proof), fall back to ScriptProcessorNode
          const targetSampleRate = 16000;
          const sourceSampleRate = ctx.sampleRate;
          let useWorklet = false;

          if (ctx.audioWorklet) {
            try {
              // Define the AudioWorklet processor inline using a Blob URL
              const workletCode = `
                class PCMProcessor extends AudioWorkletProcessor {
                  constructor() {
                    super();
                    this.samples = [];
                    this.targetSampleRate = 16000;
                    this.samplesPerChunk = this.targetSampleRate / 4; // ~250ms
                  }

                  process(inputs, outputs, parameters) {
                    const input = inputs[0];
                    if (input && input[0]) {
                      const inputData = input[0];
                      const resampleRatio = this.targetSampleRate / sampleRate;
                      const resampledLength = Math.floor(inputData.length * resampleRatio);

                      // Resample using linear interpolation
                      for (let i = 0; i < resampledLength; i++) {
                        const srcIndex = i / resampleRatio;
                        const srcIndexFloor = Math.floor(srcIndex);
                        const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
                        const t = srcIndex - srcIndexFloor;
                        const sample = inputData[srcIndexFloor] * (1 - t) + inputData[srcIndexCeil] * t;
                        this.samples.push(sample);
                      }

                      // Send when we have enough samples
                      if (this.samples.length >= this.samplesPerChunk) {
                        this.port.postMessage({ samples: new Float32Array(this.samples) });
                        this.samples = [];
                      }
                    }
                    return true; // Keep processor alive
                  }
                }
                registerProcessor('pcm-processor', PCMProcessor);
              `;

              const blob = new Blob([workletCode], { type: 'application/javascript' });
              const workletUrl = URL.createObjectURL(blob);

              await ctx.audioWorklet.addModule(workletUrl);
              URL.revokeObjectURL(workletUrl);

              const workletNode = new AudioWorkletNode(ctx, 'pcm-processor');
              workletNodeRef.current = workletNode;

              // Handle messages from the worklet (PCM data ready to send)
              // Maximum audio chunks to keep (~15 seconds at 1 chunk per 500ms)
              const MAX_AUDIO_CHUNKS = 30;

              workletNode.port.onmessage = (event) => {
                const samples = event.data.samples;

                // Store chunk in circular buffer for limited playback
                audioChunksRef.current.push(new Float32Array(samples));
                if (audioChunksRef.current.length > MAX_AUDIO_CHUNKS) {
                  audioChunksRef.current.shift(); // Remove oldest chunk
                }

                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                  return;
                }

                // Convert float32 to int16 PCM
                const pcm16 = new Int16Array(samples.length);
                for (let i = 0; i < samples.length; i++) {
                  const s = Math.max(-1, Math.min(1, samples[i]));
                  pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                wsRef.current.send(new Uint8Array(pcm16.buffer));
                debugLog('[DEBUG] PCM sent (worklet), samples:', pcm16.length, 'bytes:', pcm16.buffer.byteLength);
              };

              // Connect: microphone -> worklet (no destination = no audio output/feedback)
              source.connect(workletNode);

              useWorklet = true;
              debugLog('[DEBUG] Real-time streaming setup COMPLETE (AudioWorklet method)');
            } catch (workletErr) {
              debugLog('[DEBUG] AudioWorklet failed, falling back to ScriptProcessor:', workletErr.message);
            }
          }

          // Fallback to ScriptProcessorNode if AudioWorklet not available or failed
          if (!useWorklet) {
            const bufferSize = 4096;
            const scriptProcessor = ctx.createScriptProcessor(bufferSize, 1, 1);
            workletNodeRef.current = scriptProcessor; // Reuse ref for cleanup

            const resampleRatio = targetSampleRate / sourceSampleRate;
            let accumulatedSamples = [];
            const samplesPerSecond = targetSampleRate / 4;

            // Maximum audio chunks to keep (~15 seconds at 1 chunk per 250ms)
            const MAX_AUDIO_CHUNKS_FALLBACK = 60;

            scriptProcessor.onaudioprocess = (event) => {
              const inputData = event.inputBuffer.getChannelData(0);
              const resampledLength = Math.floor(inputData.length * resampleRatio);

              for (let i = 0; i < resampledLength; i++) {
                const srcIndex = i / resampleRatio;
                const srcIndexFloor = Math.floor(srcIndex);
                const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
                const t = srcIndex - srcIndexFloor;
                const sample = inputData[srcIndexFloor] * (1 - t) + inputData[srcIndexCeil] * t;
                accumulatedSamples.push(sample);
              }

              if (accumulatedSamples.length >= samplesPerSecond) {
                // Store in circular buffer for limited playback
                audioChunksRef.current.push(new Float32Array(accumulatedSamples));
                if (audioChunksRef.current.length > MAX_AUDIO_CHUNKS_FALLBACK) {
                  audioChunksRef.current.shift(); // Remove oldest chunk
                }

                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  const pcm16 = new Int16Array(accumulatedSamples.length);
                  for (let i = 0; i < accumulatedSamples.length; i++) {
                    const s = Math.max(-1, Math.min(1, accumulatedSamples[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                  }
                  wsRef.current.send(new Uint8Array(pcm16.buffer));
                  debugLog('[DEBUG] PCM sent (fallback), samples:', pcm16.length, 'bytes:', pcm16.buffer.byteLength);
                }
                accumulatedSamples = [];
              }
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(ctx.destination);
            debugLog('[DEBUG] Real-time streaming setup COMPLETE (ScriptProcessor fallback)');
          }
        } catch (err) {
          debugLog('[DEBUG] ERROR in streaming setup:', err.message || err);
          debugLog('Failed to set up real-time streaming:', err);
          Alert.alert('Warning', 'Real-time transcription may not be available: ' + err.message);
        }
      } else {
        debugLog('[DEBUG] SKIPPED streaming block - conditions not met');
      }
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording: ' + err.message);
      closeWebSocket();
    }
  }

  async function stopRecording() {
    debugLog('Stopping recording..');

    // Clear the recording interval if it exists (used for native platforms)
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    // Disconnect and clean up AudioWorklet or ScriptProcessor
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.disconnect();
        // Close the port if it's an AudioWorkletNode
        if (workletNodeRef.current.port) {
          workletNodeRef.current.port.close();
        }
      } catch (err) {
        debugLog('Error disconnecting audio processor:', err);
      }
      workletNodeRef.current = null;
    }

    // Disconnect source node
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (err) {
        debugLog('Error disconnecting source node:', err);
      }
      sourceNodeRef.current = null;
    }

    // Stop and clean up web media stream tracks
    if (webMediaStreamRef.current) {
      try {
        webMediaStreamRef.current.getTracks().forEach(track => track.stop());
      } catch (err) {
        debugLog('Error stopping media stream tracks:', err);
      }
      webMediaStreamRef.current = null;
    }

    // Clean up AudioContext if it exists
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        await audioContextRef.current.close();
      } catch (err) {
        debugLog('Error closing AudioContext:', err);
      }
      audioContextRef.current = null;
    }

    if (!recording) {
      return;
    }

    setIsRecording(false);
    const currentRecording = recording;

    try {
      await currentRecording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      const uri = currentRecording.getURI();
      debugLog('Recording stopped at', uri);

      // Clear audio chunks buffer since we don't need playback
      audioChunksRef.current = [];

      let pcmData = null;

      // Send recorded audio to WebSocket for transcription
      // For web: real-time streaming is already happening, so we skip sending the full recording
      // For native platforms: send the complete recording after stopping
      const isWeb = Platform.OS === 'web';
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isWeb) {
        try {
          // For native platforms (iOS/Android), audio is already in WAV format
          // Read the audio file and extract PCM data
          const response = await fetch(uri);
          const arrayBuffer = await response.arrayBuffer();
          const audioBytes = new Uint8Array(arrayBuffer);

          // Standard WAV header size is 44 bytes; skip these to get raw PCM data
          const WAV_HEADER_SIZE = 44;
          pcmData =
            audioBytes.length > WAV_HEADER_SIZE
              ? audioBytes.subarray(WAV_HEADER_SIZE)
              : audioBytes;

          // Send audio data in chunks with backpressure handling
          const chunkSize = 8000; // 8KB chunks
          for (let offset = 0; offset < pcmData.length; offset += chunkSize) {
            const chunk = pcmData.subarray(offset, offset + chunkSize);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(chunk);
              // Small delay to prevent overwhelming the WebSocket connection
              if (offset + chunkSize < pcmData.length) {
                await new Promise(resolve => setTimeout(resolve, 10));
              }
            } else {
              break;
            }
          }
          
          debugLog('Audio sent to transcription server');
        } catch (err) {
          console.error('Failed to send audio to transcription server', err);
        }
      }
      
      // Close WebSocket connection after a delay to allow final transcription processing
      // For web: use longer timeout since we're waiting for final results from streamed audio
      // For native: timeout based on audio length
      const BASE_TIMEOUT_MS = 3000; // Increased base timeout for final transcription
      
      let timeoutMs = BASE_TIMEOUT_MS;
      if (!isWeb && pcmData) {
        const BYTES_PER_SAMPLE = 2; // 16-bit PCM
        const PROCESSING_TIME_PER_SECOND = 100; // Additional ms per second of audio
        const audioLengthEstimate = pcmData.length / (16000 * BYTES_PER_SAMPLE);
        timeoutMs = Math.max(BASE_TIMEOUT_MS, audioLengthEstimate * PROCESSING_TIME_PER_SECOND + BASE_TIMEOUT_MS);
      }
      
      setTimeout(() => {
        closeWebSocket();
      }, timeoutMs);
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to stop recording: ' + err.message);
      closeWebSocket();
    } finally {
      setRecording(null);
    }
  }

  // Cleanup WebSocket on unmount
  React.useEffect(() => {
    return () => {
      closeWebSocket();
    };
  }, []);

  return (
    <PaperProvider theme={customTheme}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <FAB
            icon={isRecording ? "stop" : "microphone"}
            label={isRecording ? "Stop" : "Record"}
            mode="elevated"
            size="large"
            animated={true}
            onPress={isRecording ? stopRecording : startRecording}
            style={[styles.fab, isRecording && styles.fabRecording]}
            color={isRecording ? '#fff' : undefined}
          />

          <IconButton
            icon="bug"
            size={20}
            onPress={() => setShowDebugPanel(true)}
            style={styles.debugButton}
          />

          <View style={styles.readingSurface}>
            <MatchedTextWidget
              matchedDocument={matchState.matchedDocument}
              fullContent={matchState.matchedContent}
              highlightPosition={matchState.highlightPosition}
              isLoading={matchState.isLoading}
              confidence={matchState.confidence}
              isMatching={isMatching}
            />
          </View>

          <StatusBar style="auto" />
        </View>
      </SafeAreaView>

      <Portal>
        <Modal
          visible={showDebugPanel}
          onDismiss={() => setShowDebugPanel(false)}
          contentContainerStyle={styles.debugModal}
        >
          <View style={styles.debugHeader}>
            <Text style={styles.debugTitle}>Debug: Transcription</Text>
            <IconButton
              icon="close"
              size={20}
              onPress={() => setShowDebugPanel(false)}
            />
          </View>
          <ScrollView style={styles.debugContent}>
            <Text style={styles.transcriptionText}>
              {transcription || 'Transcription will appear here when you start recording...'}
            </Text>
          </ScrollView>
        </Modal>
      </Portal>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f0', // Match container background
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f0', // Subtle warm background for reading comfort
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 20,
  },
  fab: {
    position: 'absolute',
    alignSelf: 'center',  // Center horizontally
    bottom: 20,
    margin: 16,
    backgroundColor: '#9d5c0d', // Warm brown primary color
    zIndex: 1000,
    elevation: 5,  // Android elevation
  },
  fabRecording: {
    backgroundColor: '#d32f2f', // Red background when recording
  },
  debugButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    margin: 0,
  },
  readingSurface: {
    flex: 1,  // Fill available space for reading content
    width: '100%',  // Full width on mobile
    maxWidth: 900,  // Constrain on larger screens
    alignSelf: 'center',
    marginBottom: 80,  // Space for FAB
    ...(Platform.OS === 'ios' && {
      height: Dimensions.get('window').height - 200,  // iOS: explicit height minus chrome
    }),
  },
  debugModal: {
    backgroundColor: '#fdfaf5', // Match theme surface color
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0d5c7', // Match divider color from theme
    paddingBottom: 10,
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c2c2c', // Match theme text color
  },
  debugContent: {
    maxHeight: 400,
  },
  transcriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2c2c2c', // Match theme text color
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
