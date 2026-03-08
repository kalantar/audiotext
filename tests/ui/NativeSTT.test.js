/**
 * Native STT Integration Test
 *
 * Tests the iOS/Android speech recognition path:
 *   expo-speech-recognition events → useSpeechRecognition callbacks →
 *   performTextMatch → fetchDocumentContent → MatchedTextWidget renders title
 *
 * Platform.OS is 'ios' (react-native jest preset default).
 * expo-speech-recognition is mocked via moduleNameMapper (mockNativeSTT.js).
 */

import React from 'react';
import { render, act, waitFor, fireEvent } from '@testing-library/react-native';
import App from '../../App';
import { paragraph67TestCase } from '../fixtures/paragraph-67-test';
import { fireResult, resetMock } from './__mocks__/mockNativeSTT';

// Mock the text matcher — we test the pipeline, not the matching algorithm
jest.mock('../../utils/textMatcher', () => ({
  ...jest.requireActual('../../utils/textMatcher'),
  findBestMatch: jest.fn(),
  getDocumentMetadata: jest.fn(),
}));

import { findBestMatch, getDocumentMetadata } from '../../utils/textMatcher';

const mockGemDocument = {
  title: 'Gems of Divine Mysteries',
  author: "Bahá'u'lláh",
  url: 'https://www.bahai.org/library/authoritative-texts/bahaullah/gems-divine-mysteries/',
  sections: [{
    title: 'Gems of Divine Mysteries',
    paragraphs: Array(70).fill('Paragraph text.'),
  }],
};

describe('App - Native STT Integration', () => {
  beforeEach(() => {
    resetMock();

    // Mock fetch for document content (Platform.OS='ios' uses textAssets for the document,
    // but fetch is still used if textAssets returns null; mockTextAssets handles it)
    global.fetch = jest.fn((url) => {
      if (url.includes('gems-divine-mysteries')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockGemDocument) });
      }
      return Promise.resolve({ ok: false });
    });

    // findBestMatch: return a match for 8+ words, null otherwise
    findBestMatch.mockImplementation((words) => {
      if (words.length >= 8) {
        return {
          docId: 'gems-divine-mysteries',
          section: 'Gems of Divine Mysteries',
          paragraphNum: 69,
          score: 0.8,
        };
      }
      return null;
    });

    getDocumentMetadata.mockReturnValue({
      title: 'Gems of Divine Mysteries',
      author: "Bahá'u'lláh",
    });
  });

  test('14-word transcription via native STT shows document title', async () => {
    const { queryAllByText, getByText } = render(<App />);

    // Start recording — sets isRecordingActiveRef = true so onPartial is not dropped
    await act(async () => {
      fireEvent.press(getByText('Record'));
    });

    // Fire a 14-word partial result (simulates SFSpeechRecognizer delivering transcript)
    const stage3 = paragraph67TestCase.progressiveStages[2]; // 14-word stage
    await act(async () => {
      fireResult(stage3.words, false);
    });

    // Wait for debounced match + async operations + UI update
    await waitFor(() => {
      expect(queryAllByText(/gems of divine mysteries/i).length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  test('3-word transcription produces no match — empty state remains', async () => {
    const { queryByText } = render(<App />);

    // Fire a 3-word partial result (too few words for matching)
    const stage1 = paragraph67TestCase.progressiveStages[0]; // 3 words
    await act(async () => {
      fireResult(stage1.words, false);
    });

    // Give time for any debounced operation to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Should remain in empty state
    expect(queryByText(/ready to listen/i)).toBeTruthy();
    expect(queryByText(/gems of divine mysteries/i)).toBeFalsy();
  });
});
