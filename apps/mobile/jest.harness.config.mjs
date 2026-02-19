/** @type {import('jest').Config} */
export default {
  preset: 'react-native-harness',
  // rootDir defaults to apps/mobile/ (config file location).
  // rn-harness.config.mjs must be findable from rootDir, so we keep the default.
  // Use roots to include monorepo packages for cross-package test discovery.
  roots: [
    '<rootDir>',
    '<rootDir>/../../packages/shared/src',
    '<rootDir>/../../packages/core/src',
    '<rootDir>/../../packages/kit/src',
    '<rootDir>/../../packages/kit-bg/src',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest-harness-setup.ts'],
  testMatch: [
    // Harness-specific smoke tests
    '**/*.harness.{ts,tsx,js,jsx}',
    // Existing unit tests from packages
    '**/*.test.{ts,tsx}',
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

    // Hermes-incompatible: module init calls mnemonicToRevealableSeed which throws
    // without jest.mock crypto shim (InvalidMnemonic at require time)
    'packages/core/src/secret/__tests__/secret\\.test\\.ts',
    // Hermes-incompatible: require.importAll not available in Metro,
    // raw password security checks fail without jest.mock
    'packages/core/src/secret/index\\.test\\.ts',
    // Hermes-incompatible: floating-point precision differs between V8 and Hermes
    // (large numbers produce different string representations)
    'packages/shared/src/utils/numberUtils\\.test\\.ts',
    'packages/shared/src/utils/numberUtils\\.italy\\.test\\.ts',
  ],
};
