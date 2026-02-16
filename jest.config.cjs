module.exports = {
  preset: 'react-native',
  setupFiles: [],  // Override preset's setupFiles to avoid Flow syntax issues
  setupFilesAfterEnv: ['<rootDir>/tests/ui/setup.js'],
  testMatch: ['<rootDir>/tests/ui/**/*.test.js'],
  moduleFileExtensions: ['js', 'jsx', 'json', 'ts', 'tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|expo|@expo|@react-native|react-native-paper|expo-av|expo-status-bar)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^expo-av$': '<rootDir>/tests/ui/__mocks__/mockAudio.js',
  },
  collectCoverageFrom: [
    'App.js',
    'components/**/*.{js,jsx}',
    'utils/**/*.{js,jsx}',
    '!**/__tests__/**',
    '!**/node_modules/**',
  ],
};
