/**
 * NOTE: Full App integration tests require refactoring App.js to accept
 * a WebSocket factory function for dependency injection.
 *
 * Proposed change to App.js:
 *
 * export default function App({ wsFactory = (url) => new WebSocket(url) }) {
 *   // Use wsFactory instead of direct WebSocket constructor
 *   const ws = wsFactory(WS_SERVER_URL);
 * }
 *
 * This allows tests to inject MockVoskWebSocket:
 *
 * render(<App wsFactory={() => new MockVoskWebSocket(testCase)} />)
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import App from '../../App';
import { paragraph67TestCase } from '../fixtures/paragraph-67-test';
import { MockVoskWebSocket } from './__mocks__/mockWebSocket';

// Mock the WebSocket globally
global.WebSocket = MockVoskWebSocket;

describe('App - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders main UI components', () => {
    const { queryByText } = render(<App />);

    // Should show initial empty state
    expect(queryByText(/ready to listen/i)).toBeTruthy();
  });

  test('progressive transcription triggers text matching', async () => {
    const { getByText } = render(<App />);

    // Initially shows empty state
    expect(getByText(/ready to listen/i)).toBeTruthy();

    // TODO: Need to trigger recording and inject mock WebSocket
    // This test will be expanded once we determine how to inject WS mock
  });

  test('FAB icon changes when recording state changes', () => {
    const { getByLabelText } = render(<App />);

    // Initially shows microphone icon
    // After starting recording, shows stop icon
    // Note: This test needs testID props or accessibility labels
  });
});
