/**
 * MatchedTextWidget Component
 *
 * Displays matched religious text with:
 * - Document header (title, author)
 * - Text view with highlighted match
 * - Uses browser scrolling for navigation
 */

import React, { useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Linking
} from 'react-native';
import {
  Text as PaperText,
  Divider,
  ActivityIndicator,
  IconButton,
  useTheme
} from 'react-native-paper';
import { tsLog } from '../utils/log';
import { BASE_FONT_SIZE, BODY_LINE_HEIGHT } from '../utils/typography';

/**
 * Document Header Component
 * Memoized to prevent unnecessary re-renders when props haven't changed
 */
const DocumentHeader = React.memo(({ title, author, url, confidence, isMatching }) => {
  const handleOpenSource = useCallback(() => {
    if (url) {
      Linking.openURL(url).catch(err => {
        console.error('Failed to open URL:', err);
      });
    }
  }, [url]);

  return (
    <View style={styles.headerContainer}>
      <View style={styles.titleRow}>
        <PaperText variant="titleLarge" style={styles.titleText}>
          {title || 'Unknown Text'}
        </PaperText>
        {url && (
          <IconButton
            icon="open-in-new"
            size={20}
            iconColor="#666"
            onPress={handleOpenSource}
            style={styles.sourceIconButton}
          />
        )}
      </View>

      {author && (
        <PaperText variant="bodyMedium" style={styles.authorText}>
          {author}
        </PaperText>
      )}

      {confidence !== undefined && (
        <View style={styles.confidenceContainer}>
          <PaperText variant="labelSmall" style={styles.confidenceLabel}>
            Match: {Math.round(confidence * 100)}%
          </PaperText>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                { width: `${confidence * 100}%` }
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if these props actually changed
  return prevProps.title === nextProps.title &&
         prevProps.author === nextProps.author &&
         prevProps.url === nextProps.url &&
         prevProps.confidence === nextProps.confidence &&
         prevProps.isMatching === nextProps.isMatching;
});

/**
 * Main MatchedTextWidget Component
 */
const MatchedTextWidget = ({
  matchedDocument,
  fullContent,
  highlightPosition,
  isLoading,
  confidence,
  isMatching,
  isRecording
}) => {
  const theme = useTheme();
  const scrollViewRef = useRef(null);
  const highlightYPosition = useRef(null);
  const userHasScrolled = useRef(false);
  const lastDocumentKey = useRef(null);
  const lastRecordingState = useRef(isRecording);
  const isProgrammaticScroll = useRef(false);
  const scrollTarget = useRef(null);
  // Track last scrolled position to avoid re-triggering scrollTo when the same
  // paragraph is matched again. highlightPosition is a new object on every render,
  // so without this check the useEffect below fires a scrollTo on every match update
  // even when start/end haven't changed — keeping isProgrammaticScroll=true
  // continuously and preventing user scroll events from ever being detected.
  const lastScrolledPositionKey = useRef(null);

  // Reset user scroll flag when recording starts or document changes
  useEffect(() => {
    const currentDocumentKey = matchedDocument
      ? `${matchedDocument.docId}-${matchedDocument.section}`
      : null;

    // Reset on recording start (false → true transition)
    if (isRecording && !lastRecordingState.current) {
      tsLog('SCROLL', 'Recording started - resetting userHasScrolled flag');
      userHasScrolled.current = false;
    }
    lastRecordingState.current = isRecording;

    // Reset on document/section change (jumped to different text)
    if (currentDocumentKey && currentDocumentKey !== lastDocumentKey.current) {
      tsLog('SCROLL', 'Document changed:', lastDocumentKey.current, '→', currentDocumentKey, '- resetting flag');
      userHasScrolled.current = false;
      highlightYPosition.current = null;
      scrollTarget.current = null;
      lastScrolledPositionKey.current = null;
    }

    lastDocumentKey.current = currentDocumentKey;
  }, [isRecording, matchedDocument]);

  // Handle scroll events - distinguish between user and programmatic scrolls
  const handleScroll = useCallback((event) => {
    if (isProgrammaticScroll.current && scrollTarget.current !== null) {
      const currentY = event.nativeEvent.contentOffset.y;
      if (Math.abs(currentY - scrollTarget.current) < 5) {
        // Arrived at target — terminal event of our programmatic scroll
        isProgrammaticScroll.current = false;
        scrollTarget.current = null;
        return;
      }
      // Still animating toward target — keep flag alive, don't treat as user scroll
      return;
    }
    tsLog('SCROLL', 'User manually scrolled - setting userHasScrolled = true');
    userHasScrolled.current = true;
  }, []);

  // Handle layout of highlighted text to capture its position
  const handleHighlightLayout = useCallback((event) => {
    const { y } = event.nativeEvent.layout;
    highlightYPosition.current = y;

    tsLog('SCROLL', 'handleHighlightLayout: y=', y, 'userHasScrolled=', userHasScrolled.current);

    // Auto-scroll to highlighted text (unless user has manually scrolled)
    if (scrollViewRef.current && y !== null && y > 0 && !userHasScrolled.current) {
      const targetY = Math.max(0, y - 20);
      tsLog('SCROLL', '→ Auto-scrolling to y=', targetY);

      scrollTarget.current = targetY;
      isProgrammaticScroll.current = true;

      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({
          y: targetY,
          animated: true
        });
      });
    } else if (userHasScrolled.current) {
      tsLog('SCROLL', '→ Skipping auto-scroll (user has manually scrolled)');
    }
  }, []);

  // Extract text portions for display - show full document with highlight
  // Memoize to avoid expensive substring operations on every render
  // MUST be before early returns to comply with Rules of Hooks
  const textSegments = useMemo(() => {
    if (!fullContent) {
      return { before: '', highlighted: '', after: '' };
    }

    if (!highlightPosition) {
      return {
        before: '',
        highlighted: fullContent.substring(0, 100),
        after: fullContent.substring(100)
      };
    }

    return {
      before: fullContent.substring(0, highlightPosition.start),
      highlighted: fullContent.substring(highlightPosition.start, highlightPosition.end),
      after: fullContent.substring(highlightPosition.end)
    };
  }, [fullContent, highlightPosition]);

  const { before: beforeText, highlighted: highlightedText, after: afterText } = textSegments;

  // Scroll when the highlighted paragraph changes (unless user has manually scrolled).
  // Keyed on start-end so repeated matches of the same paragraph don't re-trigger
  // scrollTo — which would keep isProgrammaticScroll=true continuously and prevent
  // user scroll events from ever registering.
  useEffect(() => {
    const positionKey = highlightPosition
      ? `${highlightPosition.start}-${highlightPosition.end}`
      : null;

    tsLog('SCROLL', 'highlightPosition useEffect triggered:', {
      hasPosition: !!highlightPosition,
      positionKey,
      yPosition: highlightYPosition.current,
      hasScrollRef: !!scrollViewRef.current,
      userHasScrolled: userHasScrolled.current
    });

    if (positionKey === lastScrolledPositionKey.current) {
      tsLog('SCROLL', '→ Skipping auto-scroll (same position as last scroll)');
      return;
    }

    if (highlightPosition && highlightYPosition.current !== null && highlightYPosition.current > 0 && scrollViewRef.current && !userHasScrolled.current) {
      const targetY = Math.max(0, highlightYPosition.current - 20);
      tsLog('SCROLL', '→ Auto-scrolling via useEffect to y=', targetY);

      lastScrolledPositionKey.current = positionKey;
      scrollTarget.current = targetY;
      isProgrammaticScroll.current = true;

      scrollViewRef.current.scrollTo({
        y: targetY,
        animated: true
      });
    } else if (userHasScrolled.current) {
      tsLog('SCROLL', '→ Skipping auto-scroll via useEffect (user has manually scrolled)');
    }
  }, [highlightPosition]);

  // Loading state
  if (isLoading && !matchedDocument) {
    return (
      <View style={styles.paperCard}>
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" />
          <PaperText variant="bodyMedium" style={styles.emptyText}>
            Loading text...
          </PaperText>
        </View>
      </View>
    );
  }

  // No match state
  if (!matchedDocument || !fullContent) {
    return (
      <View style={styles.paperCard}>
        <View style={styles.emptyState}>
          <PaperText variant="headlineSmall" style={styles.emptyTitle}>
            {isMatching ? 'Searching...' : 'Ready to listen'}
          </PaperText>
          <PaperText variant="bodyMedium" style={styles.emptyHint}>
            Press the microphone button and speak to find matching passages
          </PaperText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.paperCard}>
      <DocumentHeader
        title={matchedDocument.title}
        author={matchedDocument.author}
        url={matchedDocument.url}
        confidence={confidence}
        isMatching={isMatching}
      />

      <Divider style={styles.divider} />

      <PaperText variant="labelLarge" style={styles.verseLabel}>
        {matchedDocument.section && `${matchedDocument.section} `}
        {matchedDocument.verseNum && `#${matchedDocument.verseNum}`}
      </PaperText>

      <ScrollView
        ref={scrollViewRef}
        style={styles.textScrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        testID="matched-text-scrollview"
      >
        <Text style={styles.textContent}>{beforeText}</Text>
        <View onLayout={handleHighlightLayout}>
          <Text style={[styles.textContent, styles.highlightedText]}>
            {highlightedText}
          </Text>
        </View>
        <Text style={styles.textContent}>{afterText}</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  paperCard: {
    flex: 1,
    margin: 16,
    backgroundColor: '#fdfaf5', // Off-white paper
    borderRadius: 8,
    overflow: 'hidden', // Contain content within rounded corners
    // Note: shadow is clipped by overflow:'hidden' on iOS; elevation works on Android
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  divider: {
    marginVertical: 12,
    marginHorizontal: 16,
    backgroundColor: '#e0d5c7',
  },
  headerContainer: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleText: {
    color: '#2c2c2c',
    fontWeight: '600',
  },
  sourceIconButton: {
    margin: 0,
    marginLeft: -4,
    marginTop: -2,
  },
  authorText: {
    color: '#6b4423',
    marginBottom: 8,
  },
  confidenceContainer: {
    marginTop: 8,
  },
  confidenceLabel: {
    color: '#666',
    marginBottom: 4,
  },
  confidenceBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#9d5c0d',
  },
  textScrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  verseLabel: {
    color: '#6b4423',
    marginBottom: 8,
    paddingHorizontal: 16,
    fontWeight: '600',
  },
  textContent: {
    fontFamily: 'Georgia',
    fontSize: BASE_FONT_SIZE,      // was 18
    lineHeight: BODY_LINE_HEIGHT,  // was 28
    color: '#2c2c2c',
  },
  contextText: {
    fontSize: 14,
    color: '#888',
  },
  highlightedText: {
    backgroundColor: '#fff59d',  // Yellow highlighter color
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#6b4423',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: '#8d8d8d',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyHint: {
    color: '#8d8d8d',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default MatchedTextWidget;
