/**
 * MatchedTextWidget Component
 *
 * Displays matched religious text with:
 * - Document header (title, author)
 * - Text view with highlighted match
 * - Uses browser scrolling for navigation
 */

import React, { useCallback } from 'react';
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
 */
const DocumentHeader = ({ title, author, url, confidence }) => {
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
      {url && (
        <TouchableOpacity onPress={handleOpenSource} style={styles.sourceLink}>
          <Text style={styles.sourceLinkText}>Source</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Main MatchedTextWidget Component
 */
const MatchedTextWidget = ({
  matchedDocument,
  fullContent,
  highlightPosition,
  isLoading,
  confidence
}) => {
  // Loading state
  if (isLoading) {
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
            Speak to find matching text...
          </Text>
          <Text style={styles.noMatchHint}>
            The app will search for matching passages as you speak.
          </Text>
        </View>
      </View>
    );
  }

  // Extract text portions for display - show full document with highlight
  const beforeText = highlightPosition
    ? fullContent.substring(0, highlightPosition.start)
    : '';
  const highlightedText = highlightPosition
    ? fullContent.substring(highlightPosition.start, highlightPosition.end)
    : fullContent.substring(0, 100);
  const afterText = highlightPosition
    ? fullContent.substring(highlightPosition.end)
    : fullContent.substring(100);

  return (
    <View style={styles.widgetContainer}>
      <DocumentHeader
        title={matchedDocument.title}
        author={matchedDocument.author}
        url={matchedDocument.url}
        confidence={confidence}
      />

      <ScrollView style={styles.textScrollView}>
        <Text style={styles.verseLabel}>
          {matchedDocument.section && `${matchedDocument.section} `}
          {matchedDocument.verseNum && `#${matchedDocument.verseNum}`}
        </Text>

        <Text style={styles.textContent}>
          <Text style={styles.contextText}>{beforeText}</Text>
          <Text style={styles.highlightedText}>{highlightedText}</Text>
          <Text style={styles.contextText}>{afterText}</Text>
        </Text>
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
