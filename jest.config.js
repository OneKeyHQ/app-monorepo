// https://jestjs.io/docs/configuration
const { defaults } = require('jest-config');
const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);

module.exports = async () => {
  const { stdout } = await exec('yarn config get cacheFolder');
  const cacheDirectory = stdout.trim().replace('\n', '');
  return {
    // https://jestjs.io/docs/configuration#maxconcurrency-number
    maxConcurrency: 1,
    maxWorkers: 1,
    // @swc/jest, react-native, jest-expo, jest-expo/web,
    preset: 'jest-expo/web', // require *.web.ts, do not require *.native.ts
    coverageProvider: 'v8',
    collectCoverageFrom: [
      'packages/core/src/**/*.ts',
      'packages/shared/src/**/*.ts',
      'packages/kit-bg/src/**/*.ts',
      '!**/*.d.ts',
      '!**/index.ts',
      '!**/__mocks__/**',
      '!**/*.test.ts',
      '!**/*.test.tsx',
      '!**/__tests__/**',
    ],
    coverageReporters: ['text', 'lcov', 'json-summary'],
    coverageThreshold: {
      global: {
        statements: 10,
        branches: 35,
        functions: 10,
      },
    },
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
      '^lodash-es$': 'lodash',
      // 'react-native-aes-crypto': '<rootDir>/__mocks__/emptyMock.js',
      // 'react-native-reanimated': '<rootDir>/__mocks__/emptyMock.js',
    },
    // TODO unify with transpile modules
    transformIgnorePatterns: [
      'node_modules/(?!(react-native-reanimated|react-native-aes-crypto|@keystonehq/bc-ur-registry-eth)/)',
    ],
    transform: {
      '^.+\\.[jt]sx?$': [
        '@swc/jest',
        {
          jsc: {
            target: 'es2022',
            parser: {
              syntax: 'typescript',
              tsx: true,
              decorators: true,
            },
            transform: {
              legacyDecorator: true,
              decoratorMetadata: true,
              react: {
                runtime: 'automatic',
              },
            },
          },
        },
      ],
    },
    reporters: [
      'default',
      [
        './node_modules/jest-html-reporter',
        {
          'pageTitle': 'Jest UnitTest Report',
        },
      ],
    ],
    modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees/'],
    testPathIgnorePatterns: [
      // Detox E2E tests have their own Jest config under apps/mobile/e2e and must not run in unit-test CI.
      'apps/mobile/e2e',
      '\\.claude/worktrees/',
      'packages/core/src/chains/ada',
      'packages/core/src/chains/algo',
      'packages/core/src/chains/apt',
      'packages/core/src/chains/bch',
      'packages/core/src/chains/cfx',
      'packages/core/src/chains/doge',
      'packages/core/src/chains/dot',
      'packages/core/src/chains/fil',
      'packages/core/src/chains/kaspa',
      'packages/core/src/chains/ltc',
      'packages/core/src/chains/near',
      'packages/core/src/chains/nexa',
      'packages/core/src/chains/stc',
      'packages/core/src/chains/xmr',
      'packages/core/src/chains/xrp',
    ],
  };
};
