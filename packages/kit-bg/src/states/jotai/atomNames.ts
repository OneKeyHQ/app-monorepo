export enum EAtomNames {
  bannerCloseIdsAtom = 'bannerCloseIdsAtom',
  demoPriceAtom = 'demoPriceAtom',
  demoPriceNotPersistAtom = 'demoPriceNotPersistAtom',
  // accountIdAtom = 'accountIdAtom',
  settingsPersistAtom = 'settingsPersistAtom',
  settingsAtom = 'settingsAtom',
  devSettingsPersistAtom = 'devSettingsPersistAtom',
  currencyPersistAtom = 'currencyPersistAtom',
  settingsLastActivityAtom = 'settingsLastActivityAtom',
  cloudBackupPersistAtom = 'cloudBackupPersistAtom',
  passwordAtom = 'passwordAtom',
  passwordPromptPromiseTriggerAtom = 'passwordPromptPromiseTriggerAtom',
  passwordPersistAtom = 'passwordPersistAtom',
  jotaiContextStoreMapAtom = 'jotaiContextStoreMapAtom',
  addressBookPersistAtom = 'addressBookPersistAtom',
  hardwareUiStateAtom = 'hardwareUiStateAtom',
  hardwareUiStateCompletedAtom = 'hardwareUiStateCompletedAtom',
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
  // notificationsAtom, notificationsPersistAtom is reserved for notificationsPersistAtom
  notificationsAtom = 'notificationsAtom', // persist
  notificationsReadedAtom = 'notificationsReadedAtom',
  notificationStatusAtom = 'notificationStatusAtom',
  // prime
  primePersistAtom = 'primePersistAtom',
  primeCloudSyncPersistAtom = 'primeCloudSyncPersistAtom',
  primeMasterPasswordPersistAtom = 'primeMasterPasswordPersistAtom',
  primeInitAtom = 'primeInitAtom',
  primeLoginDialogAtom = 'primeLoginDialogAtom',
  primeTransferAtom = 'primeTransferAtom',
  accountSelectorAccountsListIsLoadingAtom = 'accountSelectorAccountsListIsLoadingAtom',
  accountSelectorStatusAtom = 'accountSelectorStatusAtom',
  allNetworksPersistAtom = 'allNetworksPersistAtom',
  desktopBluetoothAtom = 'desktopBluetoothAtom',
  hardwareForceTransportAtom = 'hardwareForceTransportAtom',
}
export type IAtomNameKeys = keyof typeof EAtomNames;
export const atomsConfig: Partial<
  Record<IAtomNameKeys, { deepCompare?: boolean }>
> = {
  [EAtomNames.notificationsAtom]: {
    deepCompare: true,
  },
};
