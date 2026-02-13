/**
 * Mock WebSocket for simulating Vosk server in tests
 * Feeds progressive transcription stages from test fixtures
 */
export class MockVoskWebSocket {
  constructor(testCase) {
    this.testCase = testCase;
    this.stageIndex = 0;
    this.readyState = 1; // WebSocket.OPEN
    this.url = 'ws://mock:2700';
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
  }

  /**
   * Simulate progressive transcription - sends next stage as partial result
   */
  sendNextStage() {
    if (this.stageIndex >= this.testCase.progressiveStages.length) {
      return false;
    }

    const stage = this.testCase.progressiveStages[this.stageIndex];
    if (this.onmessage) {
      this.onmessage({
        data: JSON.stringify({ partial: stage.words })
      });
    }
    this.stageIndex++;
    return true;
  }

  /**
   * Simulate final transcription result
   */
  sendFinal() {
    if (this.onmessage) {
      this.onmessage({
        data: JSON.stringify({
          text: this.testCase.transcribedText
        })
      });
    }
  }

  /**
   * Simulate connection opening
   */
  open() {
    this.readyState = 1;
    if (this.onopen) {
      this.onopen({ type: 'open' });
    }
  }

  /**
   * Simulate connection closing
   */
  close() {
    this.readyState = 3; // WebSocket.CLOSED
    if (this.onclose) {
      this.onclose({ type: 'close', code: 1000, reason: 'Normal closure' });
    }
  }

  /**
   * Mock send method (does nothing in tests)
   */
  send(data) {
    // In real app, this sends audio chunks to Vosk
    // In tests, we control transcription via sendNextStage/sendFinal
  }
}

/**
 * Factory function for creating mock WebSocket instances
 */
export function createMockWebSocket(testCase) {
  return new MockVoskWebSocket(testCase);
}
