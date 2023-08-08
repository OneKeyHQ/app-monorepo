import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectSettings = (state: IAppState) => state.settings;

export const selectLocale = createSelector(selectSettings, (s) => s.locale);
export const selectTheme = createSelector(selectSettings, (s) => s.theme);

export const selectEnableAppLock = createSelector(
  selectSettings,
  (s) => s.enableAppLock,
);

export const selectAppLockDuration = createSelector(
  selectSettings,
  (s) => s.appLockDuration,
);

export const selectFiatMoneySymbol = createSelector(
  selectSettings,
  (s) => s.selectedFiatMoneySymbol,
);

export const selectInstanceId = createSelector(
  selectSettings,
  (s) => s.instanceId,
);

export const selectEnableHaptics = createSelector(
  selectSettings,
  (s) => s.enableHaptics,
);

export const selectEnableLocalAuthentication = createSelector(
  selectSettings,
  (s) => s.enableLocalAuthentication,
);

export const selectGasPanelEIP1559Enabled = createSelector(
  selectSettings,
  (s) => s.gasPanelEIP1559Enabled,
);

export const selectDeviceUpdates = createSelector(
  selectSettings,
  (s) => s.deviceUpdates,
);

export const selectBuildNumber = createSelector(
  selectSettings,
  (s) => s.buildNumber,
);

export const selectVersion = createSelector(selectSettings, (s) => s.version);

export const selectDevMode = createSelector(selectSettings, (s) => s.devMode);

export const selectSwapSlippagePercent = createSelector(
  selectSettings,
  (s) => s.swapSlippagePercent,
);

export const selectPushNotification = createSelector(
  selectSettings,
  (s) => s.pushNotification,
);

export const selectValidationSetting = createSelector(
  selectSettings,
  (s) => s.validationSetting,
);

export const selectUpdateSetting = createSelector(
  selectSettings,
  (s) => s.updateSetting,
);

export const selectEnableWebAuthn = createSelector(
  selectSettings,
  (s) => s.enableWebAuthn,
);

export const selectHideRiskTokens = createSelector(
  selectSettings,
  (s) => s.hideRiskTokens,
);
export const selectHideSmallBalance = createSelector(
  selectSettings,
  (s) => s.hideSmallBalance,
);

export const selectPutMainTokenOnTop = createSelector(
  selectSettings,
  (s) => s.putMainTokenOnTop,
);

export const selectIncludeNFTsInTotal = createSelector(
  selectSettings,
  (s) => s.includeNFTsInTotal,
);

export const selectAdvancedSettings = createSelector(
  selectSettings,
  (s) => s.advancedSettings,
);

export const selectWalletSwitchData = createSelector(
  selectSettings,
  (s) => s.walletSwitchData,
);

export const selectHideScamHistory = createSelector(
  selectSettings,
  (s) => s.hideScamHistory,
);

export const selectDisableExtSwitchTips = createSelector(
  selectSettings,
  (s) => s.disableExtSwitchTips,
);

export const selectHardwareConnectSrc = createSelector(
  selectSettings,
  (s) => s.hardwareConnectSrc,
);

export const selectSettingsHardware = createSelector(
  selectSettings,
  (s) => s.hardware,
);

export const selectLeftSidebarCollapsed = createSelector(
  selectSettings,
  (s) => s.leftSidebarCollapsed,
);

export const selectDisableSwapExactApproveAmount = createSelector(
  selectSettings,
  (s) => s.disableSwapExactApproveAmount,
);
