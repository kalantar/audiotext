import '@testing-library/jest-native/extend-expect';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};

// Mock __DEV__ constant
global.__DEV__ = true;
