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
      <View style={styles.headerTextContainer}>
        <Text style={styles.titleText} numberOfLines={1}>{title || 'Unknown Text'}</Text>
        <Text style={styles.authorText}>{author || 'Unknown Author'}</Text>
      </View>
      {confidence !== undefined && (
        <View style={styles.confidenceContainer}>
          <View style={[styles.confidenceBar, { width: `${Math.min(100, confidence * 100)}%` }]} />
        </View>
      )}
      {isMatching && (
        <Text style={styles.searchingText}>...</Text>
      )}
      {url && (
        <TouchableOpacity onPress={handleOpenSource} style={styles.sourceLink}>
          <Text style={styles.sourceLinkText}>Source</Text>
        </TouchableOpacity>
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
      <View style={styles.widgetContainer}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading text...</Text>
        </View>
      </View>
    );
  }

  // No match state
  if (!matchedDocument || !fullContent) {
    return (
      <View style={styles.widgetContainer}>
        <View style={styles.noMatchContainer}>
          <Text style={styles.noMatchText}>
            {isMatching ? 'Searching...' : 'Speak to find matching text...'}
          </Text>
          <Text style={styles.noMatchHint}>
            The app will search for matching passages as you speak.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.widgetContainer}>
      <DocumentHeader
        title={matchedDocument.title}
        author={matchedDocument.author}
        url={matchedDocument.url}
        confidence={confidence}
        isMatching={isMatching}
      />

      <ScrollView ref={scrollViewRef} style={styles.textScrollView}>
        <Text style={styles.verseLabel}>
          {matchedDocument.section && `${matchedDocument.section} `}
          {matchedDocument.verseNum && `#${matchedDocument.verseNum}`}
        </Text>

        {beforeText && (
          <Text style={[styles.textContent, styles.contextText]}>
            {beforeText}
          </Text>
        )}

        {highlightPosition && (
          <View onLayout={handleHighlightLayout} style={styles.scrollMarker} />
        )}

        <View collapsable={false}>
          <Text style={[styles.textContent, styles.highlightedText]}>
            {highlightedText}
          </Text>
        </View>

        {afterText && (
          <Text style={[styles.textContent, styles.contextText]}>
            {afterText}
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  widgetContainer: {
    flex: 1,
    width: '80%',
    paddingTop: 10,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
    marginBottom: 10,
  },
  headerTextContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  authorText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  confidenceContainer: {
    width: 50,
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  confidenceBar: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 2,
  },
  searchingText: {
    fontSize: 11,
    color: '#999',
    marginHorizontal: 4,
  },
  sourceLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sourceLinkText: {
    fontSize: 12,
    color: '#007AFF',
  },
  textScrollView: {
    flex: 1,
  },
  scrollMarker: {
    height: 0,
    width: 0,
  },
  verseLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  textContent: {
    lineHeight: 24,
  },
  contextText: {
    fontSize: 14,
    color: '#888',
  },
  highlightedText: {
    fontSize: 15,
    color: '#000',
    backgroundColor: '#FFE082',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  noMatchContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noMatchText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  noMatchHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default MatchedTextWidget;
