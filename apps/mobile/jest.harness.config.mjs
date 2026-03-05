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
    // Detox E2E tests have their own Jest config under apps/mobile/e2e
    'apps/mobile/e2e',
    // NOTE: polyfillsPlatform.test.ts and bundleUpdate.test.ts were previously excluded here
    // because they used jest.resetModules() + jest.doMock() to re-evaluate modules with different
    // mocks — impossible in Metro's single module registry. They have since been refactored to use
    // jest.mock() with mutable objects (and production code changed to getter functions), making
    // them fully compatible with the harness environment.
    // Tests using renderHook from @testing-library/react — renderHook renders
    // real React components, and our fake timer shim replaces global setTimeout
    // which React's scheduler also relies on. This causes infinite re-render
    // loops on device. These tests run fine in regular Jest which uses
    // @sinonjs/fake-timers with React scheduler integration.
    'packages/kit/src/components/UpdateReminder/hooks\\.test\\.ts',
    'packages/kit/src/provider/SplashProvider\\.test\\.ts',
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
    'packages/core/src/chains/xmr',
    'packages/core/src/chains/xrp',
  ],
};
