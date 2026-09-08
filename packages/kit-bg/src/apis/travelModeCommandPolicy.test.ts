import {
  isTravelModeRecoveryServiceCall,
  shouldRejectTravelModeServiceCall,
} from './travelModeCommandPolicy';

describe('travelModeCommandPolicy', () => {
  it.each([
    ['serviceDApp', 'getConnectedAccounts'],
    ['serviceWalletConnect', 'connectToDapp'],
    ['walletConnect', 'connectToDapp'],
    ['serviceCloudBackup', 'backup'],
    ['serviceAccount', 'createHDWallet'],
    ['serviceAccount', 'generateMnemonic'],
    ['serviceBatchCreateAccount', 'startBatchCreateAccountsFlow'],
    ['serviceSend', 'sendTransaction'],
    ['serviceNetwork', 'exportAccountKeys'],
    ['serviceHyperliquidExchange', 'placeOrder'],
    ['serviceInternalSignAndVerify', 'verifyMessage'],
    ['serviceUnifoldDeposit', 'claimDepositSessionTracking'],
    ['serviceV4Migration', 'getMigrationPayload'],
    ['servicePassword', 'updatePassword'],
    ['serviceApp', 'resetApp'],
    ['serviceAccount', 'runFutureAssetMutation'],
    ['serviceAccount', 'getOrCreateAccount'],
    ['serviceSend', 'validateAndSendTransaction'],
    ['serviceTransaction', 'simulateAndBroadcastTransaction'],
    ['serviceReferralCode', 'autoSignBoundReferralCodeMessageByHDWallet'],
    ['serviceHyperliquidReferral', 'submitSetReferrerWithSignature'],
    ['serviceWebviewPerp', 'approveBuilderFeeIfRequired'],
    ['serviceToken', 'createBinancePreOrder'],
    ['serviceFutureFeature', 'signFutureAssetCommand'],
    ['serviceFutureFeature', 'submitPreparedSignature'],
    ['serviceSetting', 'setBiologyAuthSwitchOn'],
    ['serviceSetting', 'setEnableMenuBarTray'],
    ['serviceNetwork', 'getNetwork'],
    ['serviceOnboarding', 'createWallet'],
    ['serviceOnboarding', 'isOnboardingDone'],
    ['serviceFutureFeature', 'getFutureBusinessData'],
    ['serviceDiscovery', 'fetchCategoryList'],
    ['serviceDiscovery', 'fetchDAppListByCategory'],
    ['serviceHyperliquid', 'enableTrading'],
    ['serviceHyperliquid', 'getPerpMarketOverview'],
    ['serviceHyperliquidSubscription', 'enableLedgerUpdatesSubscription'],
    ['serviceSwap', 'fetchQuotesEvents'],
    ['simpleDb@browserBookmarks', 'getRawData'],
    ['simpleDb@perp', 'setOrderBookTickOption'],
    ['', 'emitEvent'],
    ['serviceUnknown', 'unknownMethod'],
    ['mobile@nested@serviceTravelMode', 'setEnabled'],
    ['@serviceTravelMode', 'setEnabled'],
    ['mobile@', 'setEnabled'],
  ])('rejects %s.%s', (serviceName, methodName) => {
    expect(shouldRejectTravelModeServiceCall({ methodName, serviceName })).toBe(
      true,
    );
  });

  it.each([
    ['serviceTravelMode', 'requestPageAdmission'],
    ['serviceTravelMode', 'enterPage'],
    ['serviceTravelMode', 'leavePage'],
    ['serviceTravelMode', 'setEnabled'],
    ['serviceTravelMode', 'retryRestart'],
    ['servicePassword', 'encodeSensitiveText'],
    ['servicePassword', 'lockApp'],
    ['servicePassword', 'unLockApp'],
    ['servicePassword', 'checkLockStatus'],
    ['servicePassword', 'promptPasswordVerify'],
    ['servicePassword', 'verifyPassword'],
    ['servicePassword', 'waitPasswordEncryptorReady'],
    ['servicePassword', 'refreshHyperLiquidAgentPasswordStatus'],
    ['servicePassword', 'resolvePasswordPromptDialog'],
    ['servicePassword', 'rejectPasswordPromptDialog'],
    ['servicePassword', 'cancelPasswordPromptDialog'],
    ['servicePassword', 'resetPasswordStatus'],
    ['servicePassword', 'setAppLockDuration'],
    ['servicePassword', 'setEnableSystemIdleLock'],
    ['serviceSetting', 'setCurrency'],
    ['serviceSetting', 'setHapticFeedbackEnabled'],
    ['serviceSetting', 'setLocale'],
    ['serviceSetting', 'setTheme'],
    ['serviceSetting', 'setSelectedBrowserTab'],
    ['serviceSetting', 'refreshLastActivity'],
    ['serviceApp', 'isAppLocked'],
    ['serviceApp', 'restartApp'],
    ['', 'getAtomStates'],
    ['', 'setAtomValue'],
    ['serviceAccount', 'getWallets'],
    ['serviceDiscovery', 'fetchDiscoveryHomePageData'],
    ['serviceDiscovery', 'getBookmarkData'],
    ['serviceMarketV2', 'fetchMarketBasicConfig'],
    ['serviceNetwork', 'getAllNetworkIds'],
    ['serviceNetwork', 'getGlobalDeriveTypeOfNetwork'],
    ['serviceSwap', 'checkStableCoinsList'],
    ['serviceSwap', 'fetchSwapConfigs'],
    ['serviceSwap', 'fetchSwapNativeTokenConfig'],
    ['serviceSwap', 'fetchSwapNetworks'],
    ['serviceSwap', 'fetchSpeedSwapConfig'],
    ['serviceSwap', 'fetchSwapTokenDetails'],
    ['serviceSwap', 'fetchSwapTips'],
    ['serviceSwap', 'getSwapProviderManager'],
    ['serviceSwap', 'swapHistoryStatusFetchLoop'],
    ['serviceSwap', 'swapRecentTokenSync'],
    ['serviceHyperliquid', 'cancelPendingActiveAssetChange'],
    ['serviceHyperliquid', 'changeActiveAsset'],
    ['serviceHyperliquid', 'changeActivePerpsAccount'],
    ['serviceHyperliquid', 'getActiveTradeInstrumentTarget'],
    ['serviceHyperliquid', 'getL2BookSnapshotCache'],
    ['serviceHyperliquid', 'getTradingUniverse'],
    ['serviceHyperliquid', 'prepareInitialSymbolSelect'],
    ['serviceHyperliquid', 'refreshActiveAssetCtxSnapshot'],
    ['serviceHyperliquid', 'refreshTradingMeta'],
    ['serviceHyperliquid', 'updatePerpsConfigByServer'],
    ['serviceHyperliquid', 'updatePerpsConfigByServerSilently'],
    ['serviceHyperliquid', 'updatePerpsConfigByServerWithCache'],
    ['serviceHyperliquidSubscription', 'resumeSubscriptions'],
    ['serviceHyperliquidSubscription', 'setRouteSubscriptionState'],
    ['serviceHyperliquidSubscription', 'updateSubscriptions'],
    ['simpleDb@accountSelector', 'getRawData'],
    ['simpleDb@accountSelector', 'getSelectedAccount'],
    ['simpleDb@accountSelector', 'getSelectedAccountsMap'],
    ['serviceAccountSelector', 'buildActiveAccountInfoFromSelectedAccount'],
    ['serviceAccountSelector', 'fixDeriveTypesForInitAccountSelectorMap'],
    ['serviceAccountSelector', 'getGlobalDeriveType'],
    ['serviceAccountSelector', 'mergeHomeDataToSwapMap'],
    ['serviceAccountSelector', 'shouldUseGlobalDeriveType'],
    ['serviceAccount', 'clearAccountCache'],
    ['serviceAccount', 'getAllHdHwQrWallets'],
    ['serviceAccount', 'getSingletonAccountsOfWallet'],
    ['serviceNetwork', 'getAllNetworkIds'],
    ['serviceNetwork', 'getDeriveInfoItemsOfNetwork'],
    ['serviceNetwork', 'getDeriveTypeOrFallbackToGlobal'],
    ['servicePrimeTransfer', 'isInTransferImportOrBackupRestoreFlow'],
    ['serviceSwap', 'swapLimitOrdersFetchLoop'],
    ['simpleDb@browserTabs', 'getRawData'],
    ['simpleDb@marketTokenPreference', 'getPreference'],
    ['simpleDb@perp', 'getAllDexsAssetCtxsSnapshotCache'],
    ['simpleDb@perp', 'getOrderBookTickOptions'],
    ['simpleDb@perp', 'getPerpData'],
    ['serviceSwap', 'markAllSwapHistoryPreviewRead'],
    ['simpleDb@swapConfigs', 'getSwapProviderManager'],
    ['simpleDb@swapConfigs', 'setSwapProviderManager'],
    ['simpleDb@swapNetworksSort', 'getRawData'],
    ['simpleDb@swapNetworksSort', 'setRawData'],
    ['simpleDb@swapProSelectToken', 'getSwapProSelectToken'],
    ['simpleDb@swapProSelectToken', 'setSwapProSelectToken'],
  ])('allows %s.%s', (serviceName, methodName) => {
    expect(shouldRejectTravelModeServiceCall({ methodName, serviceName })).toBe(
      false,
    );
  });

  it('normalizes namespaced service names', () => {
    expect(
      shouldRejectTravelModeServiceCall({
        methodName: 'createAccount',
        serviceName: 'evm@serviceAccount',
      }),
    ).toBe(true);
  });

  it('does not widen the control plane for namespaced services', () => {
    expect(
      shouldRejectTravelModeServiceCall({
        methodName: 'setEnabled',
        serviceName: 'mobile@serviceTravelMode',
      }),
    ).toBe(false);
    expect(
      shouldRejectTravelModeServiceCall({
        methodName: 'getStatusForFutureFeature',
        serviceName: 'mobile@serviceTravelMode',
      }),
    ).toBe(true);
  });

  it('limits transition recovery to the exact restart retry command', () => {
    expect(
      isTravelModeRecoveryServiceCall({
        methodName: 'retryRestart',
        serviceName: 'mobile@serviceTravelMode',
      }),
    ).toBe(true);
    expect(
      isTravelModeRecoveryServiceCall({
        methodName: 'requestPageAdmission',
        serviceName: 'serviceTravelMode',
      }),
    ).toBe(false);
    expect(
      isTravelModeRecoveryServiceCall({
        methodName: 'restartApp',
        serviceName: 'serviceApp',
      }),
    ).toBe(false);
  });
});
