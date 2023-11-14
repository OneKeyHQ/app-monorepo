export enum EModalSettingRoutes {
  SettingListModal = 'SettingListModal',
  SettingCurrencyModal = 'SettingCurrencyModal',
  SettingThemeModal = 'SettingThemeModal',
  SettingLanguageModal = 'SettingLanguageModal',
}

export type IModalSettingParamList = {
  [EModalSettingRoutes.SettingListModal]: undefined;
  [EModalSettingRoutes.SettingCurrencyModal]: undefined;
  [EModalSettingRoutes.SettingThemeModal]: undefined;
  [EModalSettingRoutes.SettingLanguageModal]: undefined;
};
