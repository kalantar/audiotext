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
  TouchableOpacity,
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

  // Handle layout of highlighted text to capture its position
  const handleHighlightLayout = useCallback((event) => {
    const { y } = event.nativeEvent.layout;
    highlightYPosition.current = y;

    // Auto-scroll to highlighted text
    if (scrollViewRef.current && y !== null) {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, y - 20),
          animated: true
        });
      });
    }
  }, []);

  // Scroll when highlight position changes
  useEffect(() => {
    if (highlightPosition && highlightYPosition.current !== null && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: Math.max(0, highlightYPosition.current - 20),
        animated: true
      });
    }
  }, [highlightPosition]);

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

        <ScrollView ref={scrollViewRef} style={styles.textScrollView} contentContainerStyle={styles.scrollContent}>
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
    overflow: 'hidden', // Prevent content from escaping card boundaries
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
    marginBottom: 4,
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
