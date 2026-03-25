export enum EModalSettingRoutes {
  SettingListModal = 'SettingListModal',
  SettingListSubModal = 'SettingListSubModal',
  SettingCurrencyModal = 'SettingCurrencyModal',
  SettingClearAppCache = 'SettingClearAppCache',
  SettingAccountDerivationModal = 'SettingAccountDerivationModal',
  SettingSpendUTXOModal = 'SettingSpendUTXOModal',
  SettingCustomRPC = 'SettingCustomRPC',
  SettingCustomTransaction = 'SettingCustomTransaction',
  SettingCustomNetwork = 'SettingCustomNetwork',
  SettingAppAutoLockModal = 'SettingAppAutoLockModal',
  SettingProtectModal = 'SettingProtectModal',
  SettingSignatureRecordModal = 'SettingSignatureRecordModal',
  SettingDevFirmwareUpdateModal = 'SettingDevFirmwareUpdateModal',
  SettingDevAppUpdateModal = 'SettingDevAppUpdateModal',
  SettingDevV4MigrationModal = 'SettingDevV4MigrationModal',
  SettingDevUnitTestsModal = 'SettingDevUnitTestsModal',
  SettingDevDesktopApiProxyTestModal = 'SettingDevDesktopApiProxyTestModal',
  SettingDevPerpGalleryModal = 'SettingDevPerpGalleryModal',
  SettingDevCryptoGalleryModal = 'SettingDevCryptoGalleryModal',
  SettingDevCloudBackupGalleryModal = 'SettingDevCloudBackupGalleryModal',
  SettingDevAuthGalleryModal = 'SettingDevAuthGalleryModal',
  SettingDevKeylessWalletGallery = 'SettingDevKeylessWalletGallery',
  SettingDevStorageGalleryModal = 'SettingDevStorageGalleryModal',
  SettingExportCustomNetworkConfig = 'SettingExportCustomNetworkConfig',
  SettingNotifications = 'SettingNotifications',
  SettingManageAccountActivity = 'SettingManageAccountActivity',
  SettingAlignPrimaryAccount = 'SettingAlignPrimaryAccount',
  SettingFloatingIconModal = 'SettingFloatingIconModal',
  // Dev JS Bundle Manager
  SettingDevBundleManagerModal = 'SettingDevBundleManagerModal',
  SettingDevBundleVersionList = 'SettingDevBundleVersionList',
  SettingDevBundleList = 'SettingDevBundleList',
  SettingDevLocalBundleList = 'SettingDevLocalBundleList',
  SettingDevBundleUpdateStatusModal = 'SettingDevBundleUpdateStatusModal',
  // OneKey ID sub-pages
  SettingOneKeyIdPersonalInfo = 'SettingOneKeyIdPersonalInfo',
  SettingOneKeyIdSignInSecurity = 'SettingOneKeyIdSignInSecurity',
  SettingOneKeyIdKeylessWallet = 'SettingOneKeyIdKeylessWallet',
}

export type IModalSettingParamList = {
  [EModalSettingRoutes.SettingListModal]: { flag?: string } | undefined;
  [EModalSettingRoutes.SettingListSubModal]:
    | {
        name: string;
        title?: string;
      }
    | undefined;
  [EModalSettingRoutes.SettingCurrencyModal]: undefined;
  [EModalSettingRoutes.SettingClearAppCache]: undefined;
  [EModalSettingRoutes.SettingAccountDerivationModal]: undefined;
  [EModalSettingRoutes.SettingSpendUTXOModal]: undefined;
  [EModalSettingRoutes.SettingCustomRPC]: undefined;
  [EModalSettingRoutes.SettingCustomNetwork]: undefined;
  [EModalSettingRoutes.SettingCustomTransaction]: undefined;
  [EModalSettingRoutes.SettingAppAutoLockModal]: undefined;
  [EModalSettingRoutes.SettingProtectModal]: undefined;
  [EModalSettingRoutes.SettingSignatureRecordModal]: undefined;
  [EModalSettingRoutes.SettingDevFirmwareUpdateModal]: undefined;
  [EModalSettingRoutes.SettingDevAppUpdateModal]: undefined;
  [EModalSettingRoutes.SettingDevV4MigrationModal]: undefined;
  [EModalSettingRoutes.SettingDevUnitTestsModal]: undefined;
  [EModalSettingRoutes.SettingDevDesktopApiProxyTestModal]: undefined;
  [EModalSettingRoutes.SettingDevPerpGalleryModal]: undefined;
  [EModalSettingRoutes.SettingDevCryptoGalleryModal]: undefined;
  [EModalSettingRoutes.SettingDevCloudBackupGalleryModal]: undefined;
  [EModalSettingRoutes.SettingDevAuthGalleryModal]: undefined;
  [EModalSettingRoutes.SettingDevStorageGalleryModal]: undefined;
  [EModalSettingRoutes.SettingExportCustomNetworkConfig]: undefined;
  [EModalSettingRoutes.SettingNotifications]: undefined;
  [EModalSettingRoutes.SettingManageAccountActivity]: undefined;
  [EModalSettingRoutes.SettingAlignPrimaryAccount]: undefined;
  [EModalSettingRoutes.SettingFloatingIconModal]: undefined;
  // Dev JS Bundle Manager
  [EModalSettingRoutes.SettingDevBundleManagerModal]: undefined;
  [EModalSettingRoutes.SettingDevBundleVersionList]: undefined;
  [EModalSettingRoutes.SettingDevBundleList]: { version: string };
  [EModalSettingRoutes.SettingDevLocalBundleList]: undefined;
  [EModalSettingRoutes.SettingDevBundleUpdateStatusModal]: undefined;
  // OneKey ID sub-pages
  [EModalSettingRoutes.SettingOneKeyIdPersonalInfo]: undefined;
  [EModalSettingRoutes.SettingOneKeyIdSignInSecurity]: undefined;
  [EModalSettingRoutes.SettingOneKeyIdKeylessWallet]: undefined;
};
