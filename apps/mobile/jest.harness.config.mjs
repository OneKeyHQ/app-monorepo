/** @type {import('jest').Config} */
export default {
  preset: 'react-native-harness',
  globalSetup: '<rootDir>/harness/globalSetup.mjs',
  globalTeardown: '<rootDir>/harness/globalTeardown.mjs',
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
    // Keep harness tests in apps/mobile/e2e discoverable; only ignore the
    // perf guard that runs under its own Jest setup.
    'apps/mobile/e2e/perf-regression-guard\\.test\\.js',
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
    // ---------------------------------------------------------------
    // TODO: Harness-incompatible tests — all pass in Node.js Jest (`yarn test`).
    // ---------------------------------------------------------------
    // Reason: uses jest.doMock + jest.resetModules to reload module with different platformEnv.version
    'packages/shared/src/appUpdate/bundleUpdate\\.test',
    // Reason: uses jest.isolateModules to get fresh hook instances per test case
    'packages/kit/src/components/UpdateReminder/hooks\\.test',
    // Reason: uses jest.useFakeTimers — replacing global setTimeout breaks harness WebSocket bridge
    'packages/kit-bg/src/services/ServiceAppUpdate\\.test',
    // Reason: uses jest.useFakeTimers — same as above
    'packages/kit-bg/src/services/ServiceAppUpdate\\.pendingInstallTask\\.test',
    // Reason: native module (MMKV/AsyncStorage) init hangs after harness-triggered app restart
    'packages/kit-bg/src/services/servicePendingInstallTask\\.test',
    // Reason: uses jest.isolateModules + jest.useFakeTimers — both unsupported in harness
    'packages/kit/src/provider/SplashProvider\\.test',
  ],
};
