export enum EModalSettingRoutes {
  SettingListModal = 'SettingListModal',
  SettingCurrencyModal = 'SettingCurrencyModal',
  SettingThemeModal = 'SettingThemeModal',
  SettingLanguageModal = 'SettingLanguageModal',
  SettingAccountDerivationModal = 'SettingAccountDerivationModal',
  SettingHardwareSdkUrlModal = 'SettingHardwareSdkUrlModal',
  SettingSpendUTXOModal = 'SettingSpendUTXOModal',
  SettingAppLockModal = 'SettingAppLockModal',
}

export type IModalSettingParamList = {
  [EModalSettingRoutes.SettingListModal]: undefined;
  [EModalSettingRoutes.SettingCurrencyModal]: undefined;
  [EModalSettingRoutes.SettingThemeModal]: undefined;
  [EModalSettingRoutes.SettingLanguageModal]: undefined;
  [EModalSettingRoutes.SettingAccountDerivationModal]: undefined;
  [EModalSettingRoutes.SettingHardwareSdkUrlModal]: undefined;
  [EModalSettingRoutes.SettingSpendUTXOModal]: undefined;
  [EModalSettingRoutes.SettingAppLockModal]: undefined;
};
