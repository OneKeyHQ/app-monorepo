const TRAVEL_MODE_ALLOWED_METHODS: Readonly<
  Record<string, ReadonlySet<string>>
> = {
  $root: new Set(['getAtomStates', 'setAtomValue']),
  accountSelector: new Set([
    'getRawData',
    'getSelectedAccount',
    'getSelectedAccountsMap',
  ]),
  browserTabs: new Set(['getRawData']),
  marketTokenPreference: new Set(['getPreference']),
  perp: new Set([
    'getAllDexsAssetCtxsSnapshotCache',
    'getOrderBookTickOptions',
    'getPerpData',
  ]),
  swapConfigs: new Set([
    'getBridgeProviderManager',
    'getSwapProviderManager',
    'getSwapUserCloseTips',
    'setBridgeProviderManager',
    'setSwapProviderManager',
  ]),
  swapNetworksSort: new Set(['getRawData', 'setRawData']),
  swapProSelectToken: new Set([
    'getSwapProSelectToken',
    'setSwapProSelectToken',
  ]),
  serviceAccount: new Set([
    'clearAccountCache',
    'getAllHdHwQrWallets',
    'getSingletonAccountsOfWallet',
    'getWallets',
  ]),
  serviceAccountSelector: new Set([
    'buildActiveAccountInfoFromSelectedAccount',
    'fixDeriveTypesForInitAccountSelectorMap',
    'getGlobalDeriveType',
    'mergeHomeDataToSwapMap',
    'shouldUseGlobalDeriveType',
  ]),
  serviceApp: new Set(['isAppLocked', 'restartApp']),
  serviceDiscovery: new Set(['fetchDiscoveryHomePageData', 'getBookmarkData']),
  serviceHyperliquid: new Set([
    'cancelPendingActiveAssetChange',
    'changeActiveAsset',
    'changeActivePerpsAccount',
    'getActiveTradeInstrumentTarget',
    'getL2BookSnapshotCache',
    'getSpotMeta',
    'getTokenSearchAliases',
    'getTradingUniverse',
    'hydrateActiveAssetCtxSnapshotCache',
    'prepareInitialSymbolSelect',
    'refreshActiveAssetCtxSnapshot',
    'refreshSpotMeta',
    'refreshTradingMeta',
    'updatePerpsConfigByServer',
    'updatePerpsConfigByServerSilently',
    'updatePerpsConfigByServerWithCache',
  ]),
  serviceHyperliquidSubscription: new Set([
    'connect',
    'disableSubscriptionsHandler',
    'disconnect',
    'enableSubscriptionsHandler',
    'forceReloadCandlesWebview',
    'getSubscriptionsHandlerDisabledCount',
    'pauseSubscriptions',
    'reconnect',
    'recoverSubscriptionsAfterLivenessProof',
    'refreshAllPerpsData',
    'resumeSubscriptions',
    'setRouteSubscriptionState',
    'updateSubscriptions',
  ]),
  serviceMarketV2: new Set(['fetchMarketBasicConfig']),
  serviceNetwork: new Set([
    'getAllNetworkIds',
    'getDeriveInfoItemsOfNetwork',
    'getDeriveTypeOrFallbackToGlobal',
    'getGlobalDeriveTypeOfNetwork',
  ]),
  servicePassword: new Set([
    'cancelPasswordPromptDialog',
    'checkLockStatus',
    'encodeSensitiveText',
    'lockApp',
    'promptPasswordVerify',
    'refreshHyperLiquidAgentPasswordStatus',
    'rejectPasswordPromptDialog',
    'resetPasswordStatus',
    'resolvePasswordPromptDialog',
    'setAppLockDuration',
    'setEnableSystemIdleLock',
    'unLockApp',
    'verifyPassword',
    'waitPasswordEncryptorReady',
  ]),
  servicePrimeTransfer: new Set(['isInTransferImportOrBackupRestoreFlow']),
  serviceSetting: new Set([
    'refreshLastActivity',
    'setCurrency',
    'setHapticFeedbackEnabled',
    'setLocale',
    'setSelectedBrowserTab',
    'setTheme',
  ]),
  serviceSwap: new Set([
    'checkStableCoinsList',
    'cleanApprovingInterval',
    'cleanSpeedSwapApprovingInterval',
    'fetchSwapConfigs',
    'fetchSwapNativeTokenConfig',
    'fetchSwapNetworks',
    'fetchSpeedSwapConfig',
    'fetchSwapTokenDetails',
    'fetchSwapTips',
    'getSwapProviderManager',
    'markAllSwapHistoryPreviewRead',
    'swapHistoryStatusFetchLoop',
    'swapLimitOrdersFetchLoop',
    'swapRecentTokenSync',
  ]),
  serviceTravelMode: new Set([
    'enterPage',
    'leavePage',
    'requestPageAdmission',
    'retryRestart',
    'setEnabled',
  ]),
};

function normalizeServiceName(serviceName: string): string | undefined {
  if (serviceName === '') {
    return '$root';
  }
  const parts = serviceName.split('@');
  if (parts.length === 1) {
    return parts[0] || undefined;
  }
  if (parts.length === 2 && parts[0] && parts[1]) {
    return parts[1];
  }
  return undefined;
}

export function shouldRejectTravelModeServiceCall({
  methodName,
  serviceName,
}: {
  methodName: string;
  serviceName: string;
}): boolean {
  const normalizedServiceName = normalizeServiceName(serviceName);
  if (!normalizedServiceName) {
    return true;
  }
  const allowedMethods = TRAVEL_MODE_ALLOWED_METHODS[normalizedServiceName];
  return !allowedMethods?.has(methodName);
}

export function isTravelModeRecoveryServiceCall({
  methodName,
  serviceName,
}: {
  methodName: string;
  serviceName: string;
}): boolean {
  return (
    normalizeServiceName(serviceName) === 'serviceTravelMode' &&
    methodName === 'retryRestart'
  );
}
