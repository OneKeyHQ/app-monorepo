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
  ],
};
