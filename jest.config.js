// https://jestjs.io/docs/configuration
const { defaults } = require('jest-config');
const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);

module.exports = async () => {
  const { stdout } = await exec('yarn config get cacheFolder');
  const cacheDirectory = stdout.trim().replace('\n', '');
  return {
    // ts-jest, react-native, jest-expo
    preset: 'jest-expo',
    coverageProvider: 'v8',
    cacheDirectory: `${cacheDirectory}/.app-mono-jest-cache`,
    setupFilesAfterEnv: [
      './jest-setup.js',
      './node_modules/react-native-gesture-handler/jestSetup.js',
    ],
    // buffer type incorrect if use [jsdom] https://github.com/facebook/jest/issues/4422
    // jest-environment-node, node, jsdom
    testEnvironment: 'jest-environment-node',
    verbose: true,
    moduleFileExtensions: [
      ...defaults.moduleFileExtensions,
      'd.ts',
      'ts',
      'tsx',
    ],
    moduleNameMapper: {
      '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
        '<rootDir>/__mocks__/fileMock.js',
      '\\.(css|less)$': '<rootDir>/__mocks__/styleMock.js',
    },
    // TODO unify with transpile modules
    transformIgnorePatterns: ['nodo_modules/react-native-reanimated'],
    reporters: [
      'default',
      [
        './node_modules/jest-html-reporter',
        {
          'pageTitle': 'Test Report',
        },
      ],
    ],
  };
};
