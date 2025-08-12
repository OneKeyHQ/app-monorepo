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
  SettingDevV4MigrationModal = 'SettingDevV4MigrationModal',
  SettingDevUnitTestsModal = 'SettingDevUnitTestsModal',
  SettingDevDesktopApiProxyTestModal = 'SettingDevDesktopApiProxyTestModal',
  SettingDevPerpGalleryModal = 'SettingDevPerpGalleryModal',
  SettingExportCustomNetworkConfig = 'SettingExportCustomNetworkConfig',
  SettingNotifications = 'SettingNotifications',
  SettingManageAccountActivity = 'SettingManageAccountActivity',
  SettingAlignPrimaryAccount = 'SettingAlignPrimaryAccount',
  SettingFloatingIconModal = 'SettingFloatingIconModal',
}

export type IModalSettingParamList = {
  [EModalSettingRoutes.SettingListModal]: { flag?: string } | undefined;
  [EModalSettingRoutes.SettingListSubModal]:
    | {
        name: string;
        title: string;
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
  [EModalSettingRoutes.SettingDevV4MigrationModal]: undefined;
  [EModalSettingRoutes.SettingDevUnitTestsModal]: undefined;
  [EModalSettingRoutes.SettingDevDesktopApiProxyTestModal]: undefined;
  [EModalSettingRoutes.SettingDevPerpGalleryModal]: undefined;
  [EModalSettingRoutes.SettingExportCustomNetworkConfig]: undefined;
  [EModalSettingRoutes.SettingNotifications]: undefined;
  [EModalSettingRoutes.SettingManageAccountActivity]: undefined;
  [EModalSettingRoutes.SettingAlignPrimaryAccount]: undefined;
  [EModalSettingRoutes.SettingFloatingIconModal]: undefined;
};
