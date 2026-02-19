/** @type {import('jest').Config} */
export default {
  preset: 'react-native-harness',
  // Set rootDir to monorepo root so testMatch can discover tests across packages.
  // Metro's unstable_serverRoot is also set to monorepo root (see metro.config.js)
  // to ensure consistent path resolution between Jest runner and Metro bundler.
  rootDir: '../..',
  setupFilesAfterEnv: ['<rootDir>/apps/mobile/jest-harness-setup.ts'],
  testMatch: [
    // Harness-specific smoke tests
    '<rootDir>/apps/mobile/**/*.harness.{ts,tsx,js,jsx}',
    // Existing unit tests from packages
    '<rootDir>/packages/shared/src/**/*.test.{ts,tsx}',
    '<rootDir>/packages/core/src/**/*.test.{ts,tsx}',
    '<rootDir>/packages/kit/src/**/*.test.{ts,tsx}',
    '<rootDir>/packages/kit-bg/src/**/*.test.{ts,tsx}',
  ],
  testPathIgnorePatterns: [
    // Same chain ignores as root jest.config.js
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
    'packages/core/src/chains/tron',
    'packages/core/src/chains/xmr',
    'packages/core/src/chains/xrp',
  ],
};
