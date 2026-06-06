export enum EAtomNames {
  bannerCloseIdsAtom = 'bannerCloseIdsAtom',
  demoPriceAtom = 'demoPriceAtom',
  demoPriceInfoAtom = 'demoPriceInfoAtom',
  demoPriceNotPersistAtom = 'demoPriceNotPersistAtom',
  // accountIdAtom = 'accountIdAtom',
  settingsPersistAtom = 'settingsPersistAtom',
  settingsAtom = 'settingsAtom',
  devSettingsPersistAtom = 'devSettingsPersistAtom',
  currencyPersistAtom = 'currencyPersistAtom',
  settingsLastActivityAtom = 'settingsLastActivityAtom',
  cloudBackupPersistAtom = 'cloudBackupPersistAtom',
  cloudBackupStatusAtom = 'cloudBackupStatusAtom',
  cloudBackupExitPreventAtom = 'cloudBackupExitPreventAtom',
  passwordAtom = 'passwordAtom',
  passwordPromptPromiseTriggerAtom = 'passwordPromptPromiseTriggerAtom',
  passwordPersistAtom = 'passwordPersistAtom',
  passwordPersistManualLockStateAtom = 'passwordPersistManualLockStateAtom',
  jotaiContextStoreMapAtom = 'jotaiContextStoreMapAtom',
  addressBookPersistAtom = 'addressBookPersistAtom',
  hardwareUiStateAtom = 'hardwareUiStateAtom',
  hardwareUiStateCompletedAtom = 'hardwareUiStateCompletedAtom',
  thirdPartyHardwareUiStateAtom = 'thirdPartyHardwareUiStateAtom',
  thirdPartyAppInstallAtom = 'thirdPartyAppInstallAtom',
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
  keylessDialogAtom = 'keylessDialogAtom',
  keylessPinConfirmStatusAtom = 'keylessPinConfirmStatusAtom',
  keylessLastCancelVerifyPinTimeAtom = 'keylessLastCancelVerifyPinTimeAtom',
  keylessBackendShareV2MigrationPersistAtom = 'keylessBackendShareV2MigrationPersistAtom',
  accountSelectorAccountsListIsLoadingAtom = 'accountSelectorAccountsListIsLoadingAtom',
  accountSelectorStatusAtom = 'accountSelectorStatusAtom',
  allNetworksPersistAtom = 'allNetworksPersistAtom',
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
  perpsLastUsedLeverageAtom = 'perpsLastUsedLeverageAtom',
  perpsLayoutStateAtom = 'perpsLayoutStateAtom',
  perpsAbstractionModeAtom = 'perpsAbstractionModeAtom',
  perpsSpotDustingAtom = 'perpsSpotDustingAtom',
  perpsSpotBalancesAtom = 'perpsSpotBalancesAtom',
  perpsFooterTickerModePersistAtom = 'perpsFooterTickerModePersistAtom',
  // trading mode
  tradingModeAtom = 'tradingModeAtom',
  // spot
  spotActiveAssetAtom = 'spotActiveAssetAtom',
  spotActiveAssetCtxAtom = 'spotActiveAssetCtxAtom',
  spotBalancesAtom = 'spotBalancesAtom',
  spotTokenSelectorConfigPersistAtom = 'spotTokenSelectorConfigPersistAtom',
  spotTokenFavoritesPersistAtom = 'spotTokenFavoritesPersistAtom',
  spotAssetCtxsMapAtom = 'spotAssetCtxsMapAtom',
  spotActiveOpenOrdersAtom = 'spotActiveOpenOrdersAtom',
  spotPairDisplayMapAtom = 'spotPairDisplayMapAtom',
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
  marketCurrentTokenLiveDataAtom = 'marketCurrentTokenLiveDataAtom',
  chartPredictedSymbolAtom = 'chartPredictedSymbolAtom',

  // account selector values (async loaded)
  accountSelectorValuesMapAtom = 'accountSelectorValuesMapAtom',
  accountSelectorDeFiMapAtom = 'accountSelectorDeFiMapAtom',
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
};
