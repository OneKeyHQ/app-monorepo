// https://jestjs.io/docs/configuration
const { defaults } = require('jest-config');
const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);

module.exports = async () => {
  const { stdout } = await exec('yarn config get cacheFolder');
  const cacheDirectory = stdout.trim().replace('\n', '');
  return {
    // ts-jest, react-native, jest-expo, jest-expo/web,
    preset: 'jest-expo/web', // require *.web.ts, do not require *.native.ts
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
      'jest.ts', // not working
      'jest.tsx',
      'ts',
      'tsx',
    ],
    // 'extensionsToTreatAsEsm': ['.wasm', '.ts'],
    // 'globals': {
    //   'ts-jest': {
    //     'useESM': true,
    //   },
    // },
    moduleNameMapper: {
      // '^(\\.{1,2}/.*/cardano_message_signing_bg\\.wasm\\.js)$': '$1',
      '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
        '<rootDir>/__mocks__/fileMock.js',
      '\\.(css|less)$': '<rootDir>/__mocks__/styleMock.js',
      '@onekeyhq/components': '<rootDir>/__mocks__/componentsMock.ts',
      '@emurgo/cardano-serialization-lib-browser':
        '@emurgo/cardano-serialization-lib-nodejs',
      '@emurgo/cardano-message-signing-browser':
        '@emurgo/cardano-message-signing-nodejs',
      '\\./adaWebSdk$':
        '<rootDir>/packages/core/src/chains/ada/sdkAda/sdk/adaWebSdk.jest.ts',
    },
    // TODO unify with transpile modules
    transformIgnorePatterns: ['nodo_modules/react-native-reanimated'],
    transform: {
      '^.+\\.(ts|tsx)$': 'ts-jest',
    },
    reporters: [
      'default',
      [
        './node_modules/jest-html-reporter',
        {
          'pageTitle': 'Test Report',
        },
      ],
    ],
    testPathIgnorePatterns: [
      'packages/core/src/chains/ada',
      'packages/core/src/chains/algo',
      'packages/core/src/chains/apt',
      'packages/core/src/chains/bch',
      'packages/core/src/chains/cfx',
      'packages/core/src/chains/cosmos',
      'packages/core/src/chains/doge',
      'packages/core/src/chains/dot',
      'packages/core/src/chains/fil',
      'packages/core/src/chains/kaspa',
      'packages/core/src/chains/ltc',
      'packages/core/src/chains/near',
      'packages/core/src/chains/nexa',
      'packages/core/src/chains/sol',
      'packages/core/src/chains/stc',
      'packages/core/src/chains/sui',
      'packages/core/src/chains/tron',
      'packages/core/src/chains/xmr',
      'packages/core/src/chains/xrp',
    ],
  };
};
