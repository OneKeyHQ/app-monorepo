export enum EAtomNames {
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
  // firmwareUpdatesDetectStatusAtom is reserved for firmwareUpdatesDetectStatusPersistAtom
  firmwareUpdatesDetectStatusPersistAtom = 'firmwareUpdatesDetectStatusPersistAtom', // persist
  firmwareUpdateStepInfoAtom = 'firmwareUpdateStepInfoAtom',
  firmwareUpdateRetryAtom = 'firmwareUpdateRetryAtom',
  firmwareUpdateWorkflowRunningAtom = 'firmwareUpdateWorkflowRunningAtom',
  firmwareUpdateDevSettingsPersistAtom = 'firmwareUpdateDevSettingsPersistAtom',
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
  // notificationsAtom, notificationsPersistAtom is reserved for notificationsPersistAtom
  notificationsAtom = 'notificationsAtom', // persist
  notificationsReadedAtom = 'notificationsReadedAtom',
  primePersistAtom = 'primePersistAtom',
  primeInitAtom = 'primeInitAtom',
  primeLoginDialogAtom = 'primeLoginDialogAtom',
  accountSelectorAccountsListIsLoadingAtom = 'accountSelectorAccountsListIsLoadingAtom',
}
export type IAtomNameKeys = keyof typeof EAtomNames;
export const atomsConfig: Partial<
  Record<IAtomNameKeys, { deepCompare?: boolean }>
> = {
  [EAtomNames.notificationsAtom]: {
    deepCompare: true,
  },
};
