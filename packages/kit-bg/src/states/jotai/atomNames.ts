export enum EAtomNames {
  bannerCloseIdsAtom = 'bannerCloseIdsAtom',
  demoPriceAtom = 'demoPriceAtom',
  demoPriceInfoAtom = 'demoPriceInfoAtom',
  demoPriceNotPersistAtom = 'demoPriceNotPersistAtom',
  // accountIdAtom = 'accountIdAtom',
  settingsPersistAtom = 'settingsPersistAtom',
  inscriptionProtectionControlPersistAtom = 'inscriptionProtectionControlPersistAtom',
  settingsAtom = 'settingsAtom',
  devSettingsPersistAtom = 'devSettingsPersistAtom',
  currencyPersistAtom = 'currencyPersistAtom',
  settingsLastActivityAtom = 'settingsLastActivityAtom',
  cloudBackupPersistAtom = 'cloudBackupPersistAtom',
  cloudBackupStatusAtom = 'cloudBackupStatusAtom',
  cloudBackupExitPreventAtom = 'cloudBackupExitPreventAtom',
  passwordAtom = 'passwordAtom',
  hyperLiquidAgentPasswordStatusAtom = 'hyperLiquidAgentPasswordStatusAtom',
  passwordPromptPromiseTriggerAtom = 'passwordPromptPromiseTriggerAtom',
  passwordPersistAtom = 'passwordPersistAtom',
  passwordPersistManualLockStateAtom = 'passwordPersistManualLockStateAtom',
  localDbOpenErrorAtom = 'localDbOpenErrorAtom',
  jotaiContextStoreMapAtom = 'jotaiContextStoreMapAtom',
  addressBookPersistAtom = 'addressBookPersistAtom',
  hardwareUiStateAtom = 'hardwareUiStateAtom',
  hardwareUiStateCompletedAtom = 'hardwareUiStateCompletedAtom',
  deviceStageAtom = 'deviceStageAtom',
  thirdPartyHardwareUiStateAtom = 'thirdPartyHardwareUiStateAtom',
  thirdPartyAppInstallAtom = 'thirdPartyAppInstallAtom',
  thirdPartyBatchInstallAtom = 'thirdPartyBatchInstallAtom',
  hardwareWalletXfpStatusAtom = 'hardwareWalletXfpStatusAtom',
  // firmwareUpdatesDetectStatusAtom is reserved for firmwareUpdatesDetectStatusPersistAtom
  firmwareUpdatesDetectStatusPersistAtom = 'firmwareUpdatesDetectStatusPersistAtom', // persist
  firmwareUpdateStepInfoAtom = 'firmwareUpdateStepInfoAtom',
  firmwareUpdateRetryAtom = 'firmwareUpdateRetryAtom',
  firmwareUpdateWorkflowRunningAtom = 'firmwareUpdateWorkflowRunningAtom',
  firmwareUpdateDevSettingsPersistAtom = 'firmwareUpdateDevSettingsPersistAtom',
  firmwareUpdateResultVerifyAtom = 'firmwareUpdateResultVerifyAtom',
  notificationsDevSettingsPersistAtom = 'notificationsDevSettingsPersistAtom',
  appUpdatePersistAtom = 'appUpdatePersistAtom',
  spotlightPersistAtom = 'spotlightPersistAtom',
  onboardingConnectWalletLoadingAtom = 'onboardingConnectWalletLoadingAtom',
  onboardingCloudBackupListRefreshAtom = 'onboardingCloudBackupListRefreshAtom',
  isOnBoardingOpenAtom = 'isOnBoardingOpenAtom',
  inAppNotificationAtom = 'inAppNotificationAtom',
  v4migrationAtom = 'v4migrationAtom',
  v4migrationPersistAtom = 'v4migrationPersistAtom',
  accountIsAutoCreatingAtom = 'accountIsAutoCreatingAtom',
  indexedAccountAddressCreationStateAtom = 'indexedAccountAddressCreationStateAtom',
  accountManualCreatingAtom = 'accountManualCreatingAtom',
  galleryPersistAtom = 'galleryPersistAtom',
  activeAccountValueAtom = 'activeAccountValueAtom',
  settingsValuePersistAtom = 'settingsValuePersistAtom',
  settingsTronRentalPersistAtom = 'settingsTronRentalPersistAtom',
  settingsFiatPaySiteWhitelistPersistAtom = 'settingsFiatPaySiteWhitelistPersistAtom',

  // notificationsAtom, notificationsPersistAtom is reserved for notificationsPersistAtom
  notificationsAtom = 'notificationsAtom', // persist
  notificationsReadedAtom = 'notificationsReadedAtom',
  notificationStatusAtom = 'notificationStatusAtom',
  // prime
  primePersistAtom = 'primePersistAtom',
  primeCloudSyncPersistAtom = 'primeCloudSyncPersistAtom',
  primeMasterPasswordPersistAtom = 'primeMasterPasswordPersistAtom',
  primeServerMasterPasswordStatusAtom = 'primeServerMasterPasswordStatusAtom',
  primeInitAtom = 'primeInitAtom',
  primeLoginDialogAtom = 'primeLoginDialogAtom',
  primeTransferAtom = 'primeTransferAtom',
  keylessPinConfirmStatusAtom = 'keylessPinConfirmStatusAtom',
  keylessLastCancelVerifyPinTimeAtom = 'keylessLastCancelVerifyPinTimeAtom',
  keylessBackendShareV2MigrationPersistAtom = 'keylessBackendShareV2MigrationPersistAtom',
  accountSelectorAccountsListIsLoadingAtom = 'accountSelectorAccountsListIsLoadingAtom',
  accountSelectorStatusAtom = 'accountSelectorStatusAtom',
  allNetworksPersistAtom = 'allNetworksPersistAtom',
  bulkExportHistorySupportedNetworksPersistAtom = 'bulkExportHistorySupportedNetworksPersistAtom',
  tokenSelectorFilterPersistAtom = 'tokenSelectorFilterPersistAtom',
  desktopBluetoothAtom = 'desktopBluetoothAtom',
  hardwareForceTransportAtom = 'hardwareForceTransportAtom',
  // perps
  perpsActiveAccountAtom = 'perpsActiveAccountAtom',
  perpsActiveAccountRefreshHookAtom = 'perpsActiveAccountRefreshHookAtom',
  perpsActiveAccountSummaryAtom = 'perpsActiveAccountSummaryAtom',
  perpsAccountDisplaySnapshotAtom = 'perpsAccountDisplaySnapshotAtom',
  perpsActiveAccountStatusInfoAtom = 'perpsActiveAccountStatusInfoAtom',
  perpsAccountLoadingInfoAtom = 'perpsAccountLoadingInfoAtom',
  perpsActiveAssetAtom = 'perpsActiveAssetAtom',
  perpsActiveAssetCtxAtom = 'perpsActiveAssetCtxAtom',
  perpsActiveAssetCtxDisplayAtom = 'perpsActiveAssetCtxDisplayAtom',
  perpsActiveAssetDataAtom = 'perpsActiveAssetDataAtom',
  perpsActiveOrderBookOptionsAtom = 'perpsActiveOrderBookOptionsAtom',
  perpsCustomSettingsAtom = 'perpsCustomSettingsAtom',
  perpsTradingPreferencesAtom = 'perpsTradingPreferencesAtom',
  perpsCommonConfigPersistAtom = 'perpsCommonConfigPersistAtom',
  perpsUserConfigPersistAtom = 'perpsUserConfigPersistAtom',
  perpsNetworkStatusAtom = 'perpsNetworkStatusAtom',
  perpsDepositNetworksAtom = 'perpsDepositNetworksAtom',
  perpsDepositTokensAtom = 'perpsDepositTokensAtom',
  perpsWebSocketReadyStateAtom = 'perpsWebSocketReadyStateAtom',
  perpsTradesHistoryRefreshHookAtom = 'perpsTradesHistoryRefreshHookAtom',
  perpsTradesHistoryDataAtom = 'perpsTradesHistoryDataAtom',
  perpsCandlesWebviewReloadHookAtom = 'perpsCandlesWebviewReloadHookAtom',
  perpsCandlesWebviewMountedAtom = 'perpsCandlesWebviewMountedAtom',
  perpsWebSocketDataUpdateTimesAtom = 'perpsWebSocketDataUpdateTimesAtom',
  perpTokenSelectorConfigPersistAtom = 'perpTokenSelectorConfigPersistAtom',
  perpTokenSelectorTabsAtom = 'perpTokenSelectorTabsAtom',
  perpTokenFavoritesPersistAtom = 'perpTokenFavoritesPersistAtom',
  perpsDepositOrderAtom = 'perpsDepositOrderAtom',
  perpsUnifoldActiveRecipientAtom = 'perpsUnifoldActiveRecipientAtom',
  perpsUnifoldDepositTrackingAtom = 'perpsUnifoldDepositTrackingAtom',
  perpsLastUsedLeverageAtom = 'perpsLastUsedLeverageAtom',
  perpsLayoutStateAtom = 'perpsLayoutStateAtom',
  perpsPendingInfoPanelTabAtom = 'perpsPendingInfoPanelTabAtom',
  perpsAbstractionModeAtom = 'perpsAbstractionModeAtom',
  perpsSpotDustingAtom = 'perpsSpotDustingAtom',
  perpsSpotBalancesAtom = 'perpsSpotBalancesAtom',
  perpsFooterTickerModePersistAtom = 'perpsFooterTickerModePersistAtom',
  // trading mode
  tradingModeAtom = 'tradingModeAtom',
  // borrow
  borrowSelectedMarketAtom = 'borrowSelectedMarketAtom',
  // spot
  spotActiveAssetAtom = 'spotActiveAssetAtom',
  spotActiveAssetCtxAtom = 'spotActiveAssetCtxAtom',
  spotBalancesAtom = 'spotBalancesAtom',
  spotTokenSelectorConfigPersistAtom = 'spotTokenSelectorConfigPersistAtom',
  spotTokenFavoritesPersistAtom = 'spotTokenFavoritesPersistAtom',
  spotAssetCtxsMapAtom = 'spotAssetCtxsMapAtom',
  spotActiveOpenOrdersAtom = 'spotActiveOpenOrdersAtom',
  spotPairDisplayMapAtom = 'spotPairDisplayMapAtom',
  spotPairDisplayNameMapAtom = 'spotPairDisplayNameMapAtom',
  spotExternalMarketCapsAtom = 'spotExternalMarketCapsAtom',
  perpsFavoritesOrderPersistAtom = 'perpsFavoritesOrderPersistAtom',
  // network doctor
  networkDoctorStateAtom = 'networkDoctorStateAtom',

  // translate
  translateSettingsPersistAtom = 'translateSettingsPersistAtom',

  // swap
  swapProJumpTokenAtom = 'swapProJumpTokenAtom',
  swapFromMarketJumpTokenAtom = 'swapFromMarketJumpTokenAtom',
  // market
  marketSelectedTabAtom = 'marketSelectedTabAtom',
  marketBannerListSortAtom = 'marketBannerListSortAtom',
  marketTokenSelectorConfigAtom = 'marketTokenSelectorConfigAtom',
  marketTradingViewChartSettingsPersistAtom = 'marketTradingViewChartSettingsPersistAtom',
  marketTradingViewIndicatorSettingsPersistAtom = 'marketTradingViewIndicatorSettingsPersistAtom',
  marketTradingViewSubIndicatorCountPersistAtom = 'marketTradingViewSubIndicatorCountPersistAtom',
  marketDetailChartDisplayModePersistAtom = 'marketDetailChartDisplayModePersistAtom',
  marketPriceSourceAtom = 'marketPriceSourceAtom',
  marketCurrentTokenLiveDataAtom = 'marketCurrentTokenLiveDataAtom',

  // account selector values (async loaded)
  accountSelectorValuesMapAtom = 'accountSelectorValuesMapAtom',
  accountSelectorDeFiMapAtom = 'accountSelectorDeFiMapAtom',

  // batch tx sign
  batchTxSignAtom = 'batchTxSignAtom',
}
export type IAtomNameKeys = keyof typeof EAtomNames;
export const atomsConfig: Partial<
  Record<IAtomNameKeys, { deepCompare?: boolean; mergeInitialValue?: boolean }>
> = {
  [EAtomNames.notificationsAtom]: {
    deepCompare: true,
  },
  [EAtomNames.primePersistAtom]: {
    mergeInitialValue: false,
  },
  // Nested force-target arrays must replace, not lodash-merge. merge({},
  // {targets:['boot']}, {targets:[]}) keeps ['boot'], so the Pro2 switches
  // cannot turn off (and look like they "don't toggle").
  [EAtomNames.firmwareUpdateDevSettingsPersistAtom]: {
    mergeInitialValue: false,
  },
  // This state is written as a complete snapshot so legacy chart namespace
  // fields can be removed instead of being merged back on every write.
  [EAtomNames.marketTradingViewSubIndicatorCountPersistAtom]: {
    mergeInitialValue: false,
  },
  [EAtomNames.marketTradingViewIndicatorSettingsPersistAtom]: {
    mergeInitialValue: false,
  },
  // These Perps states are written as complete snapshots. Lodash merge keeps
  // old array tails and ignores undefined, which can resurrect stale fields.
  [EAtomNames.perpsActiveAssetAtom]: {
    mergeInitialValue: false,
  },
  [EAtomNames.perpsAccountDisplaySnapshotAtom]: {
    mergeInitialValue: false,
  },
  [EAtomNames.spotActiveAssetAtom]: {
    mergeInitialValue: false,
  },
  // A bare string value, where lodash merge is not merely lossy but destructive:
  // it spreads the string into a character-indexed object, so every later
  // `=== 'spot'` comparison fails and the app behaves as if it were on perp.
  [EAtomNames.tradingModeAtom]: {
    mergeInitialValue: false,
  },
  [EAtomNames.perpsCommonConfigPersistAtom]: {
    mergeInitialValue: false,
  },
  [EAtomNames.perpTokenFavoritesPersistAtom]: {
    mergeInitialValue: false,
  },
  [EAtomNames.spotTokenFavoritesPersistAtom]: {
    mergeInitialValue: false,
  },
  [EAtomNames.perpsFavoritesOrderPersistAtom]: {
    mergeInitialValue: false,
  },
  [EAtomNames.perpsDepositOrderAtom]: {
    mergeInitialValue: false,
  },
  [EAtomNames.perpsUnifoldDepositTrackingAtom]: {
    mergeInitialValue: false,
  },
};
