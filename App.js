import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Alert, ScrollView, Platform, SafeAreaView, Dimensions } from 'react-native';
import { Provider as PaperProvider, MD3LightTheme, FAB, IconButton, Portal, Modal } from 'react-native-paper';
import MatchedTextWidget from './components/MatchedTextWidget';
import { findBestMatch, findHighlightPosition, getDocumentMetadata, debounce } from './utils/textMatcher';
import textAssets from './assets/textAssets';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { tsLog } from './utils/log';

// Development-only logging helper for non-timestamped messages (e.g. stickiness decisions)
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

/**
 * Compute stickiness threshold based on match count.
 * Early matches (first 3) are less reliable, so allow easier switching.
 * Once stable (3+ matches), require a significantly higher score to switch
 * documents/sections, preventing noise-triggered jumps.
 */
export function computeSwitchThreshold(matchCount) {
  return matchCount < 3 ? -0.10 : 0.15;
}

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
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [showDebugPanel, setShowDebugPanel] = useState(false);

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
  // Ref-based active flag: set synchronously on start/stop so onPartial can bail out immediately.
  // Using a ref (not state) because state updates are async — queued bridge callbacks from
  // SFSpeechRecognizer would still fire and trigger re-renders before state caught up.
  const isRecordingActiveRef = useRef(false);
  // Guard: only one performTextMatch execution at a time. findBestMatch across ~4k
  // candidates (after MIN_PREFIX_MATCHES=2 filtering) takes 3-15s on Hermes. Without
  // this, a debounce firing while a previous run is in-flight queues another blocking
  // JS-thread operation. Reset on stop so a stale true never blocks the next session;
  // the isRecordingActiveRef guard prevents new calls from entering after stop anyway.
  const isMatchingInProgressRef = useRef(false);
  // Cancel token for the in-flight findBestMatch call. Set cancelled=true in stopRecording
  // so findBestMatch aborts at the next chunk boundary (~200ms) rather than running to
  // completion (potentially 10-30s) before the Stop button press is processed.
  const matchCancelTokenRef = useRef(null);
  // Throttle onPartial: only forward to matcher when word count grows by 3+
  const lastForwardedWordCountRef = useRef(0);
  const matchContextRef = useRef({
    previousDocId: null,
    previousParagraphNum: null,
    previousSection: null,
    previousScore: 0,
    // Paragraph-based highlight tracking
    firstParagraphNum: null,  // First paragraph matched in this section
    currentParagraphNum: null, // Current/latest paragraph matched
    matchHistory: [],  // Track last 3 matches for temporal continuity
    matchCount: 0  // Track number of matches for dynamic stickiness threshold
  });

  // Load search index on mount
  useEffect(() => {
    const loadSearchIndex = async () => {
      tsLog('MATCH', 'Loading search index...');
      try {
        if (Platform.OS === 'web') {
          // Web: load from public folder
          const response = await fetch('/search-index.json');
          tsLog('MATCH', 'Fetch response:', response.status, response.ok);
          if (response.ok) {
            const index = await response.json();
            searchIndexRef.current = index;
            tsLog('MATCH', 'Search index loaded:', index.documents?.length, 'entries');
          } else {
            throw new Error(`Search index not available (HTTP ${response.status})`);
          }
        } else {
          // Native (iOS/Android): require from assets folder
          const index = require('./assets/search-index.json');
          searchIndexRef.current = index;
          tsLog('MATCH', 'Search index loaded (native):', index.documents?.length, 'entries');
        }
      } catch (err) {
        console.error('[MATCH] Failed to load search index:', err.message);
        Alert.alert(
          'Content Unavailable',
          'Could not load the text library. Text matching will not be available this session.'
        );
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
      tsLog('FETCH', 'Cache hit:', cacheKey);
      return documentCacheRef.current[cacheKey];
    }

    try {
      tsLog('FETCH', 'Fetching document:', docId, 'section:', section);

      let doc;
      if (Platform.OS === 'web') {
        // Web: fetch from public folder
        const response = await fetch(`/texts/${docId}.json`);
        if (!response.ok) {
          tsLog('FETCH', 'Document not found:', docId, response.status);
          throw new Error(`Document not found: ${docId}`);
        }
        doc = await response.json();
      } else {
        // Native (iOS/Android): load from bundled assets
        doc = textAssets[docId];
        if (!doc) {
          tsLog('FETCH', 'Document not found in assets:', docId);
          throw new Error(`Document not found: ${docId}`);
        }
      }

      tsLog('FETCH', 'Document loaded, sections:', doc.sections?.length);

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
        tsLog('FETCH', 'Section not found:', section,
          'Available:', doc.sections?.map(s => `"${s.title}"(${s.paragraphs?.length}p)`).join(', '));
      } else {
        tsLog('FETCH', 'Section found:', sectionObj.title,
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

        tsLog('FETCH', 'Full section:', sectionObj.paragraphs.length, 'paragraphs,', fullText.length, 'chars');

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
        tsLog('FETCH', 'Content cached and returning');
        return content;
      }
    } catch (err) {
      console.error('[FETCH] Error loading document:', err.message);
      Alert.alert('Content Unavailable', `Could not load the matched passage. (${err.message})`);
    }

    tsLog('FETCH', 'Returning null - content not found');
    return null;
  }, []);

  // Perform text matching (debounced)
  const performTextMatch = useCallback(
    debounce(async (words) => {
      if (isMatchingInProgressRef.current) {
        tsLog('MATCH', 'DROP (already in progress)');
        return;
      }
      isMatchingInProgressRef.current = true;
      tsLog('MATCH', 'START words=' + words.length);
      try {
        // Log summary: first 5 words ... last 5 words
        const wordsSummary = words.length <= 12
          ? words.join(' ')
          : words.slice(0, 5).join(' ') + ' ... ' + words.slice(-5).join(' ');
        tsLog('MATCH', 'performTextMatch called with', words.length, 'words:', wordsSummary);
        if (!searchIndexRef.current) {
          tsLog('MATCH', 'No search index loaded');
          setIsMatching(false);
          return;
        }
        if (words.length < 8) {
          tsLog('MATCH', 'Not enough words (need 8+):', words.length);
          setIsMatching(false);
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
            tsLog('MATCH', 'Temporal continuity detected: predicting',
              prediction.docId, 'paragraph', prediction.paragraphNum);
          }
        }

        const cancelToken = { cancelled: false };
        matchCancelTokenRef.current = cancelToken;
        const match = await findBestMatch(words, searchIndexRef.current, matchContextRef.current, prediction, cancelToken);
        tsLog('MATCH', 'findBestMatch result:', match ? `${match.docId} score=${match.score?.toFixed(2)}` : 'no match');

        if (match) {
          const ctx = matchContextRef.current;
          // Check if we're in the same section (allow free movement within section)
          const isSameSectionMatch = ctx.previousDocId === match.docId &&
                                     ctx.previousSection === match.section;

          // Dynamic stickiness threshold: lower for early matches, higher once stable
          // Early matches (first 3) are less reliable, so easier to override
          // This allows correcting initial false positives while preventing noise jumps
          const matchCount = ctx.matchCount || 0;
          const SWITCH_THRESHOLD = computeSwitchThreshold(matchCount);
          const isEarlyMatch = matchCount < 3; // Kept for logging

          // Apply stickiness: require higher score to switch to a different section/document
          // Movement within the same section is allowed without penalty
          if (!isSameSectionMatch && ctx.previousDocId) {
            const scoreDiff = match.score - ctx.previousScore;
            if (scoreDiff < SWITCH_THRESHOLD) {
              debugLog('[MATCH] Stickiness: staying in current section (score diff:', scoreDiff.toFixed(2),
                       '< threshold:', SWITCH_THRESHOLD, ', early match:', isEarlyMatch, ')');
              matchContextRef.current = { ...ctx, matchCount: matchCount + 1 };
              return; // Don't switch - not confident enough
            }
            debugLog('[MATCH] Moving to new section (score diff:', scoreDiff.toFixed(2),
                     ', threshold:', SWITCH_THRESHOLD, ', early match:', isEarlyMatch, ')');
          }

          tsLog('MATCH', 'Match found:', match.docId, match.section, 'paragraphNum:', match.paragraphNum, 'score:', match.score.toFixed(2));

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
            // Sliding window can temporarily match the previous paragraph near boundaries — don't reset
            const isPrevParagraph = isSameSection && match.paragraphNum === ctx.currentParagraphNum - 1;
            // Re-lock: switching to a better document but landing on same paragraph we already confirmed
            const isRelock = !isSameSection && match.paragraphNum === ctx.currentParagraphNum;
            const isValidProgression = isSameParagraph || isNextParagraph || isPrevParagraph || isRelock;

            let firstParagraphIndex;
            if (isValidProgression && ctx.firstParagraphNum !== null) {
              // Valid progression: keep tracking from first matched paragraph
              firstParagraphIndex = ctx.firstParagraphNum - 1;
              tsLog('MATCH', 'Valid progression:', isSameParagraph ? 'same paragraph' : isNextParagraph ? 'next paragraph' : isPrevParagraph ? 'previous paragraph' : 're-lock');
            } else {
              // Non-sequential jump or new section: reset highlight to current paragraph
              firstParagraphIndex = currentParagraphIndex;
              if (isSameSection && !isValidProgression) {
                tsLog('MATCH', 'Non-sequential jump from paragraph', ctx.currentParagraphNum, 'to', match.paragraphNum, '- resetting highlight');
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
              contextEnd: content.text.length,
              firstParagraphNum: firstParagraphIndex + 1  // Signals non-contiguous jump when it changes
            };

            tsLog('MATCH', 'Paragraph-based highlight: paragraphs', firstParagraphIndex + 1, 'to', currentParagraphIndex + 1,
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
              matchHistory: updatedHistory,
              matchCount: (ctx.matchCount || 0) + 1  // Track number of matches
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
      } catch (err) {
        console.error('[MATCH] Error in performTextMatch:', err?.message ?? err);
        setMatchState(prev => ({ ...prev, isLoading: false }));
      } finally {
        isMatchingInProgressRef.current = false;
        tsLog('MATCH', 'DONE');
        setIsMatching(false);
      }
    }, 250),  // Debounce interval - optimized for faster matching while maintaining stability
    [fetchDocumentContent]
  );

  const { startListening, stopListening } = useSpeechRecognition({
    onPartial: useCallback((text) => {
      if (!isRecordingActiveRef.current) {
        tsLog('PARTIAL', 'DROP (recording stopped) words=' + text.split(/\s+/).filter(w=>w).length);
        return;
      }
      setTranscription(text);
      const words = getLastWords(text, MATCH_WINDOW_WORDS).split(/\s+/).filter(w => w.length > 0);
      // Only forward to matcher when word count grows by 3+ since last forward.
      // Prevents SFSpeechRecognizer's high-frequency partials from flooding the debounce queue.
      if (words.length >= 3 && words.length >= lastForwardedWordCountRef.current + 3) {
        lastForwardedWordCountRef.current = words.length;
        tsLog('PARTIAL', 'forward to matcher words=' + words.length + ' inProgress=' + isMatchingInProgressRef.current);
        setIsMatching(true);
        performTextMatch(words);
      } else {
        tsLog('PARTIAL', 'throttle skip words=' + words.length + ' lastForwarded=' + lastForwardedWordCountRef.current);
      }
    }, [performTextMatch]),
    onFinal: useCallback((text) => {
      if (!isRecordingActiveRef.current) {
        tsLog('FINAL', 'DROP (recording stopped) words=' + text.split(/\s+/).filter(w=>w).length);
        return;
      }
      setTranscription(text);
      const words = getLastWords(text, MATCH_WINDOW_WORDS).split(/\s+/).filter(w => w.length > 0);
      if (words.length >= 3) {
        lastForwardedWordCountRef.current = words.length;
        setIsMatching(true);
        performTextMatch(words);
      }
    }, [performTextMatch]),
    onError: useCallback((err) => {
      // Reset recording state — both nativeSTT and vosk call onError directly without
      // throwing, so the startRecording catch never fires for runtime errors like
      // permission denial or microphone capture failure.
      isRecordingActiveRef.current = false;
      setIsRecording(false);
      performTextMatch.cancel();
      const message = err?.message ?? String(err) ?? 'An unknown error occurred.';
      const isPermissionError = message.toLowerCase().includes('permission') ||
        message.toLowerCase().includes('access');
      Alert.alert(
        isPermissionError ? 'Permission Required' : 'Recognition Error',
        message
      );
    }, [performTextMatch]),
  });

  async function startRecording() {
    if (isRecording) return;
    tsLog('RECORD', 'startRecording called');

    // Clear previous transcription and match state
    setTranscription('');
    isRecordingActiveRef.current = true;
    isMatchingInProgressRef.current = false;
    lastForwardedWordCountRef.current = 0;
    matchContextRef.current = {
      previousDocId: null,
      previousParagraphNum: null,
      previousSection: null,
      previousScore: 0,
      firstParagraphNum: null,
      currentParagraphNum: null,
      matchHistory: [],
      matchCount: 0
    };
    setMatchState({
      isLoading: false,
      matchedDocument: null,
      matchedContent: null,
      highlightPosition: null,
      confidence: 0
    });
    setIsRecording(true);
    try {
      await startListening();
    } catch (err) {
      isRecordingActiveRef.current = false;
      setIsRecording(false);
      Alert.alert('Error', 'Failed to start recording: ' + (err?.message ?? err));
    }
  }

  function stopRecording() {
    tsLog('RECORD', 'stopRecording called');
    isRecordingActiveRef.current = false;
    isMatchingInProgressRef.current = false;
    if (matchCancelTokenRef.current) matchCancelTokenRef.current.cancelled = true;
    setIsRecording(false);
    lastForwardedWordCountRef.current = 0;
    performTextMatch.cancel();
    stopListening();
  }

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
              isRecording={isRecording}
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
