// https://jestjs.io/docs/configuration
const { defaults } = require('jest-config');

module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: [
    './jest-setup.js',
    './node_modules/react-native-gesture-handler/jestSetup.js',
  ],
  testEnvironment: 'jsdom',
  verbose: true,
  moduleFileExtensions: [...defaults.moduleFileExtensions, 'd.ts', 'ts', 'tsx'],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__mocks__/fileMock.js',
    '\\.(css|less)$': '<rootDir>/__mocks__/styleMock.js',
  },
  // TODO unify with transpile modules
  transformIgnorePatterns: ['nodo_modules/react-native-reanimated'],
};
