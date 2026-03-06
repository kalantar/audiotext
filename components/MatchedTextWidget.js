/**
 * MatchedTextWidget Component
 *
 * Displays matched religious text with:
 * - Document header (title, author)
 * - Text view with highlighted match
 * - Uses browser scrolling for navigation
 */

import React, { useCallback, useRef, useEffect, useMemo } from 'react';

// Use Metro's global __DEV__ if available (React Native/Expo), otherwise always log
function debugLog(...args) { if (typeof __DEV__ !== 'undefined' ? __DEV__ : true) console.log(...args); }
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Linking
} from 'react-native';
import {
  Card,
  Text as PaperText,
  Divider,
  ActivityIndicator,
  IconButton,
  useTheme
} from 'react-native-paper';

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
  isMatching
}) => {
  const theme = useTheme();
  const scrollViewRef = useRef(null);
  const highlightYPosition = useRef(null);
  const userHasScrolled = useRef(false);
  const prevFirstParagraphNum = useRef(null);
  const isProgrammaticScroll = useRef(false);
  const programmaticScrollTimer = useRef(null);

  // Reset userHasScrolled when the highlight anchor changes (non-contiguous match / new session).
  // highlightPosition is a new object on every render, so this effect fires often —
  // but only acts when firstParagraphNum actually changes.
  // WARNING: do NOT call scrollTo from this effect. highlightPosition changes every ~500ms,
  // so any scrollTo here will fire constantly and prevent userHasScrolled from ever being set.
  useEffect(() => {
    const firstParagraphNum = highlightPosition?.firstParagraphNum;
    if (firstParagraphNum !== prevFirstParagraphNum.current) {
      debugLog('[SCROLL] Anchor changed p' + prevFirstParagraphNum.current + '→p' + firstParagraphNum + ', resetting userHasScrolled');
      prevFirstParagraphNum.current = firstParagraphNum;
      userHasScrolled.current = false;
    }
  }, [highlightPosition]);

  // Scroll programmatically — sets a flag so onScroll doesn't misidentify it as user input.
  // The 400ms timer gives the animated scroll time to settle before clearing the flag.
  const scrollToHighlight = useCallback((y) => {
    debugLog('[SCROLL] Programmatic scroll to y=' + Math.round(y));
    isProgrammaticScroll.current = true;
    scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
    if (programmaticScrollTimer.current) clearTimeout(programmaticScrollTimer.current);
    programmaticScrollTimer.current = setTimeout(() => {
      debugLog('[SCROLL] Programmatic scroll flag cleared');
      isProgrammaticScroll.current = false;
    }, 400);
  }, []);

  // onLayout on the highlighted <Text> is the ONLY scroll trigger.
  // It fires when the highlighted text's layout changes (content shifts, new paragraph added).
  // It does NOT fire on every render — only when layout actually changes.
  // WARNING: do NOT add a useEffect([highlightPosition]) that calls scrollTo.
  // WARNING: do NOT use onScrollBeginDrag — it doesn't fire for mouse wheel on web.
  const handleHighlightLayout = useCallback((event) => {
    const { y } = event.nativeEvent.layout;
    const prev = highlightYPosition.current;
    highlightYPosition.current = y;

    if (!userHasScrolled.current && scrollViewRef.current && y !== null && y > 0) {
      debugLog('[SCROLL] onLayout: y=' + Math.round(y) + (prev !== y ? ' (changed from ' + Math.round(prev) + ')' : ' (unchanged)') + ', scrolling');
      requestAnimationFrame(() => { scrollToHighlight(y); });
    } else {
      debugLog('[SCROLL] onLayout: y=' + Math.round(y) + ', suppressed (userHasScrolled=' + userHasScrolled.current + ')');
    }
  }, [scrollToHighlight]);

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

  // Loading state
  if (isLoading && !matchedDocument) {
    return (
      <Card style={styles.paperCard} elevation={1}>
        <Card.Content style={styles.emptyState}>
          <ActivityIndicator size="large" />
          <PaperText variant="bodyMedium" style={styles.emptyText}>
            Loading text...
          </PaperText>
        </Card.Content>
      </Card>
    );
  }

  // No match state
  if (!matchedDocument || !fullContent) {
    return (
      <Card style={styles.paperCard} elevation={1}>
        <Card.Content style={styles.emptyState}>
          <PaperText variant="headlineSmall" style={styles.emptyTitle}>
            {isMatching ? 'Searching...' : 'Ready to listen'}
          </PaperText>
          <PaperText variant="bodyMedium" style={styles.emptyHint}>
            Press the microphone button and speak to find matching passages
          </PaperText>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={styles.paperCard} elevation={2}>
      <Card.Content style={styles.cardContent}>
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
          scrollEventThrottle={200}
          onScroll={() => {
            if (!isProgrammaticScroll.current) {
              if (!userHasScrolled.current) {
                debugLog('[SCROLL] User scroll detected, suppressing auto-scroll');
              }
              userHasScrolled.current = true;
            } else {
              debugLog('[SCROLL] onScroll ignored (programmatic)');
            }
          }}
        >
          <Text style={styles.textContent}>
            {beforeText}
            <Text
              style={styles.highlightedText}
              onLayout={handleHighlightLayout}
            >
              {highlightedText}
            </Text>
            {afterText}
          </Text>
        </ScrollView>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  paperCard: {
    flex: 1,
    margin: 16,
    backgroundColor: '#fdfaf5', // Off-white paper
    borderRadius: 8,
    overflow: 'hidden', // Contain content within rounded corners
  },
  cardContent: {
    flex: 1,
    padding: 0, // Card.Content has default padding we need to control
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
    fontSize: 18,
    lineHeight: 28,
    color: '#2c2c2c',
  },
  contextText: {
    fontSize: 14,
    color: '#888',
  },
  highlightedText: {
    backgroundColor: '#fff59d',  // Yellow highlighter color
    paddingVertical: 2,
    paddingHorizontal: 1,
    // No fontSize change - inherit from textContent (18px)
    // No fontWeight change - keep normal weight
    // No color change - inherit from textContent
  },
  emptyState: {
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
