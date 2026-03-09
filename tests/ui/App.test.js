import React from 'react';
import { Platform } from 'react-native';
import { render, act, fireEvent, waitFor } from '@testing-library/react-native';
import App from '../../App';
import { paragraph67TestCase } from '../fixtures/paragraph-67-test';
import { MockVoskWebSocket } from './__mocks__/mockWebSocket';

// Mock the text matcher — we test the App pipeline, not the matching algorithm
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

describe('App - Integration Tests', () => {
  let mockWS;
  let originalPlatformOS;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set Platform.OS to 'web' so the Vosk WebSocket path runs in this test
    originalPlatformOS = Platform.OS;
    Platform.OS = 'web';

    // Set up MockVoskWebSocket — returned by the WebSocket constructor
    global.WebSocket = jest.fn(function() {
      mockWS = new MockVoskWebSocket(paragraph67TestCase);
      // vosk.js sets ws.onopen after constructor returns; trigger it on next tick
      const ws = mockWS;
      setTimeout(() => ws.onopen?.({ type: 'open' }), 0);
      return ws;
    });
    global.WebSocket.OPEN = 1;
    global.WebSocket.CLOSING = 2;
    global.WebSocket.CLOSED = 3;

    // Mock audio APIs so startListening doesn't error
    const mockScriptProcessor = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      onaudioprocess: null,
    };
    Object.defineProperty(global, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: jest.fn().mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }],
          }),
        },
      },
      configurable: true,
      writable: true,
    });
    global.AudioContext = jest.fn(() => ({
      sampleRate: 44100,
      audioWorklet: null, // forces ScriptProcessorNode fallback
      createMediaStreamSource: jest.fn(() => ({ connect: jest.fn() })),
      createScriptProcessor: jest.fn(() => mockScriptProcessor),
      destination: {},
      close: jest.fn().mockResolvedValue(undefined),
    }));

    // Mock fetch: empty search index (findBestMatch is mocked) + gem document
    global.fetch = jest.fn((url) => {
      if (url.includes('gems-divine-mysteries')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockGemDocument) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ documents: [], metadata: {} }) });
    });

    // findBestMatch: return a match for 8+ words, no match for fewer
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
      url: 'https://www.bahai.org/library/authoritative-texts/bahaullah/gems-divine-mysteries/',
    });
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
  });

  test('renders main UI components', () => {
    const { queryByText } = render(<App />);
    expect(queryByText(/ready to listen/i)).toBeTruthy();
  });

  test('progressive transcription triggers text matching and shows document title', async () => {
    const { queryAllByText, getByText } = render(<App />);

    // Press FAB to start recording (RNTL v12+ bubbles events to find onPress)
    await act(async () => {
      fireEvent.press(getByText('Record'));
      // Allow setTimeout(0) to fire — triggers mockWS.onopen
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Send the 14-word stage (simulates Vosk server delivering a partial transcript)
    const stage3 = paragraph67TestCase.progressiveStages[2]; // 14-word stage
    await act(async () => {
      mockWS.onmessage?.({ data: JSON.stringify({ partial: stage3.words }) });
    });

    // Wait for debounced text matching + async document fetch + UI update
    await waitFor(() => {
      expect(queryAllByText(/gems of divine mysteries/i).length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  test('3-word stage produces no match — empty state remains', async () => {
    const { queryByText, queryAllByText, getByText } = render(<App />);

    await act(async () => {
      fireEvent.press(getByText('Record'));
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Send 3-word stage (below 8-word threshold for matching)
    const stage1 = paragraph67TestCase.progressiveStages[0]; // 3 words
    await act(async () => {
      mockWS.onmessage?.({ data: JSON.stringify({ partial: stage1.words }) });
    });

    // Wait past debounce window
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(queryAllByText(/gems of divine mysteries/i).length).toBe(0);
  });
});
