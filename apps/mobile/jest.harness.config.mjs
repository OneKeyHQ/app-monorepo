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
    // These files declare @jest-environment jsdom and rely on DOM/JSDOM
    // semantics. The React Native harness runs on-device Hermes, so keep them
    // on the normal Jest path instead of hanging the native runner.
    'packages/components/src/hooks/useNetInfo\\.test\\.tsx',
    'packages/kit/src/components/UpdateReminder/hooks\\.test\\.ts',
    'packages/kit/src/hooks/usePromiseResult\\.test\\.tsx',
    'packages/kit/src/provider/SplashProvider\\.test\\.ts',
    'packages/kit/src/states/jotai/contexts/earn/actions\\.test\\.tsx',
    'packages/kit/src/views/Discovery/hooks/useSearchModalData\\.test\\.tsx',
    'packages/kit/src/views/Earn/hooks/useRecommendedRefreshTrigger/useRecommendedRefreshAppEvents\\.test\\.tsx',
    'packages/kit/src/views/Earn/hooks/useRecommendedRefreshTrigger/useRecommendedRefreshScope\\.test\\.tsx',
    'packages/kit/src/views/Earn/hooks/useRecommendedRefreshTrigger/useRecommendedRefreshSwapEvents\\.test\\.tsx',
    'packages/kit/src/views/Market/MarketDetailV2/components/InformationTabs/components/TransactionsHistory/hooks/useTransactionsWebSocket\\.test\\.ts',
    'packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/MarketSwapReviewDialog\\.test\\.tsx',
    'packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/MarketSwapReviewInitializer\\.test\\.tsx',
    'packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/SwapPanelContent\\.test\\.tsx',
    'packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useMarketSwapReviewActions\\.test\\.tsx',
    'packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useSpeedSwapActions\\.test\\.tsx',
    'packages/kit/src/views/Market/hooks/useMarketWSSubscriptionRecovery\\.test\\.ts',
    'packages/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode/useFetchWalletsWithBoundStatus\\.test\\.tsx',
    'packages/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode/useWalletBoundReferralCode\\.test\\.tsx',
    'packages/kit/src/views/Swap/hooks/useSwapIncognitoRecipientInput\\.test\\.ts',
    'packages/kit/src/views/Swap/pages/components/SwapReviewDialog\\.test\\.tsx',
    // ---------------------------------------------------------------------
    // Fourth batch (added after CI run #25385669566 surfaced these once the
    // V8 heap OOM was unblocked by 6-shard splitting). All five tests pass
    // under `yarn test` (Node Jest) but fail in the on-device harness for
    // the same root causes the previous batches were skipped — they need to
    // be rewritten to be RN-harness compatible. Tracked as TODO follow-up.
    // ---------------------------------------------------------------------
    //
    // useUniversalBorrowHooks: the test file exceeds the harness 180s
    //   per-file timeout (DEFAULT_TEST_FILE_TIMEOUT_MS in
    //   @react-native-harness/jest). It exercises a full borrow flow with
    //   many awaited service calls; needs to be either split into smaller
    //   test files or moved to the regular Jest path.
    'packages/kit/src/views/Borrow/hooks/useUniversalBorrowHooks\\.test\\.tsx',
    //
    // healthCheck: relies on per-test isolation of __SEGMENT_MANIFEST__ /
    //   eager-fallback module registry. The harness reuses one Android app
    //   process across tests, so global state leaks between cases —
    //   "expected true to be false", "expected 11 to be 10". Same root
    //   cause flagged in PR #11377 ("global-state isolation broken in
    //   harness"); this is a different test file with the same problem.
    'apps/mobile/src/splitBundle/__tests__/healthCheck\\.test\\.ts',
    //
    // useBtcMetadata: relies on `jest.mocked(useTokenDetail).mockReturnValue`
    //   which the harness runtime does not provide
    //   (`mockedUseTokenDetail.mockReturnValue is not a function`). Same
    //   `jest.mocked()` helper missing flagged for useSearchModalData /
    //   botWallet in PR #11377.
    'packages/kit/src/views/Market/MarketDetailV2/hooks/useBtcMetadata\\.test\\.ts',
    //
    // swapBalanceUtils: the test passes function-typed mocks (a thenable /
    //   `toSorted`-shaped function) through the harness bridge, which
    //   serializes via JSON and rejects non-serializable values
    //   ("Object should be serializable"). The mock therefore never
    //   reaches the device, so the assertion sees the unmocked code path
    //   and yields `{isSufficient:true}` instead of `{isSufficient:false}`.
    //   Needs the test to mock at module level (importable mock module)
    //   instead of inline `mockReturnValue`.
    'packages/kit/src/views/Swap/utils/swapBalanceUtils\\.test\\.ts',
    //
    // sentry/index.native: uses vitest API (`vi.fn()`) and
    //   `jest.isolateModules()`. The harness explicitly does not support
    //   `jest.isolateModules` ("[harness-compat] jest.isolateModules() is
    //   not supported in harness mode, running inline") and `vi.fn()` is
    //   not a Jest global; both manifest as "expected vi.fn() to be
    //   called 1 times, but got 0 times". Test must be ported to plain
    //   `jest.fn()` and avoid module isolation.
    'packages/shared/src/modules3rdParty/sentry/index\\.native\\.test\\.ts',
    // ---------------------------------------------------------------------
    // Fifth batch (added after CI run #25389545429 surfaced these in
    // shard 2/6 once the fourth batch unblocked shard 1/6). Same root-
    // cause families as the prior batches; need rewriting to be
    // RN-harness compatible. Tracked as TODO follow-up.
    // ---------------------------------------------------------------------
    //
    // useMarketTransactions: relies on
    //   `jest.requireMock('@onekeyhq/shared/src/platformEnv').default` to
    //   return a mutable platformEnv mock object. Under the harness this
    //   resolves to `undefined`, so `getMockPlatformEnv()` throws
    //   "Cannot set property 'isNative' of undefined". Same
    //   jest.mock-helper-not-available pattern as useBtcMetadata above.
    'packages/kit/src/views/Market/MarketDetailV2/components/InformationTabs/components/TransactionsHistory/hooks/useMarketTransactions\\.test\\.ts',
    //
    // TransactionsHistory: imports `render` from `@testing-library/react`
    //   which depends on `react-dom` ("0, _react.render is not a function
    //   (it is undefined)"). RN harness runs on Hermes, no react-dom.
    //   Same DOM-dependency pattern as the SwapPanel tests already
    //   skipped above. Needs migration to
    //   `@testing-library/react-native`.
    'packages/kit/src/views/Market/MarketDetailV2/components/InformationTabs/components/TransactionsHistory/TransactionsHistory\\.test\\.tsx',
    //
    // ServiceDeFi.getAccountTotalDeFiNetWorth: exceeds the harness
    //   180s per-file timeout, same as useUniversalBorrowHooks above.
    //   The test exercises a wide DeFi service surface with many
    //   awaited service calls. Burned 3 min of shard 2/6's budget,
    //   contributing to the step-level 15-min timeout.
    'packages/kit-bg/src/services/ServiceDeFi\\.getAccountTotalDeFiNetWorth\\.test\\.ts',
    //
    // DesktopInformationTabs: same `_react.render` failure as
    //   TransactionsHistory above — uses web testing-library. Migration
    //   to react-native testing-library required.
    'packages/kit/src/views/Market/MarketDetailV2/components/InformationTabs/layout/DesktopInformationTabs\\.test\\.tsx',
    // ---------------------------------------------------------------------
    // Sixth batch (CI run #25401595533, shard 2/6 once timeout was bumped
    // and prior batch unblocked). Same families.
    // ---------------------------------------------------------------------
    //
    // exportSupport: uses `jest.mock('./utils', () => ({ default: { ... } }))`
    //   factory pattern. Under the harness the factory does not actually
    //   replace the imported module, so `flushPendingRepeat` is the real
    //   implementation rather than the `jest.fn()`, yielding "[Function
    //   flushPendingRepeat] is not a spy or a call to a spy!". Same
    //   jest.mock-helper-not-available pattern as useMarketTransactions
    //   and useBtcMetadata above.
    'packages/shared/src/logger/exportSupport\\.test\\.ts',
  ],
};
