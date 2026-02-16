import { MockVoskWebSocket } from './mockWebSocket';

describe('MockVoskWebSocket', () => {
  const mockTestCase = {
    progressiveStages: [
      { words: 'hello world', wordCount: 2 },
      { words: 'hello world test', wordCount: 3 }
    ],
    transcribedText: 'hello world test final'
  };

  test('initializes with OPEN readyState', () => {
    const ws = new MockVoskWebSocket(mockTestCase);
    expect(ws.readyState).toBe(1);
  });

  test('sendNextStage calls onmessage with partial result', () => {
    const ws = new MockVoskWebSocket(mockTestCase);
    const mockOnMessage = jest.fn();
    ws.onmessage = mockOnMessage;

    ws.sendNextStage();

    expect(mockOnMessage).toHaveBeenCalledWith({
      data: JSON.stringify({ partial: 'hello world' })
    });
  });

  test('sendNextStage advances through stages', () => {
    const ws = new MockVoskWebSocket(mockTestCase);
    const mockOnMessage = jest.fn();
    ws.onmessage = mockOnMessage;

    ws.sendNextStage();
    ws.sendNextStage();

    expect(mockOnMessage).toHaveBeenCalledTimes(2);
    expect(mockOnMessage).toHaveBeenNthCalledWith(2, {
      data: JSON.stringify({ partial: 'hello world test' })
    });
  });

  test('sendFinal calls onmessage with text result', () => {
    const ws = new MockVoskWebSocket(mockTestCase);
    const mockOnMessage = jest.fn();
    ws.onmessage = mockOnMessage;

    ws.sendFinal();

    expect(mockOnMessage).toHaveBeenCalledWith({
      data: JSON.stringify({ text: 'hello world test final' })
    });
  });

  test('close changes readyState and calls onclose', () => {
    const ws = new MockVoskWebSocket(mockTestCase);
    const mockOnClose = jest.fn();
    ws.onclose = mockOnClose;

    ws.close();

    expect(ws.readyState).toBe(3);
    expect(mockOnClose).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'close', code: 1000 })
    );
  });

  test('open changes readyState and calls onopen', () => {
    const ws = new MockVoskWebSocket(mockTestCase);
    ws.readyState = 0; // Set to CONNECTING first
    const mockOnOpen = jest.fn();
    ws.onopen = mockOnOpen;

    ws.open();

    expect(ws.readyState).toBe(1); // WebSocket.OPEN
    expect(mockOnOpen).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'open' })
    );
  });

  test('sendNextStage returns false when stages exhausted', () => {
    const ws = new MockVoskWebSocket(mockTestCase);

    // Consume all stages
    expect(ws.sendNextStage()).toBe(true);  // Stage 1
    expect(ws.sendNextStage()).toBe(true);  // Stage 2
    expect(ws.sendNextStage()).toBe(false); // No more stages
  });
});
