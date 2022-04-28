import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import uuid from 'react-native-uuid';

import { LocaleSymbol } from '@onekeyhq/components/src/locale';
import { ThemeVariant } from '@onekeyhq/components/src/Provider/theme';
import { getTimeStamp } from '@onekeyhq/kit/src/utils/helper';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ValidationFields } from '../../components/Protected/types';

type SettingsState = {
  theme: ThemeVariant | 'system';
  locale: LocaleSymbol;
  version: string;
  buildNumber?: string;
  instanceId: string;
  enableAppLock: boolean;
  enableLocalAuthentication: boolean;
  selectedFiatMoneySymbol: string;
  appLockDuration: number;
  refreshTimeStamp: number;
  autoRefreshTimeStamp: number;
  swapSlippagePercent: string;
  validationState: {
    [ValidationFields.Unlock]?: boolean;
    [ValidationFields.Payment]?: boolean;
    [ValidationFields.Wallet]?: boolean;
    [ValidationFields.Account]?: boolean;
    [ValidationFields.Secret]?: boolean;
  };
};

const initialState: SettingsState = {
  theme: 'system',
  locale: 'zh-CN',
  version: process.env.VERSION ?? '1.0.0',
  buildNumber: process.env.BUILD_NUMBER ?? '2022010100',
  instanceId: uuid.v4() as string,
  enableAppLock: false,
  enableLocalAuthentication: false,
  appLockDuration: 5,
  selectedFiatMoneySymbol: 'usd',
  refreshTimeStamp: getTimeStamp(),
  autoRefreshTimeStamp: getTimeStamp(),
  swapSlippagePercent: '3',
  validationState: {
    [ValidationFields.Unlock]: true,
    [ValidationFields.Payment]: true,
    [ValidationFields.Wallet]: true,
    [ValidationFields.Account]: true,
    [ValidationFields.Secret]: true,
  },
};

export const THEME_PRELOAD_STORAGE_KEY = 'ONEKEY_THEME_PRELOAD';
export function setThemePreloadToLocalStorage(
  value: string,
  forceUpdate = true,
) {
  try {
    const key = THEME_PRELOAD_STORAGE_KEY;
    if (platformEnv.isBrowser) {
      if (forceUpdate || !localStorage.getItem(key)) {
        localStorage.setItem(key, value);
      }
    }
  } catch (error) {
    console.error(error);
  }
}
setThemePreloadToLocalStorage(initialState.theme, false);

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateVersionAndBuildNumber: (
      state,
      action: PayloadAction<Pick<SettingsState, 'version' | 'buildNumber'>>,
    ) => {
      state.version = action.payload.version;
      state.buildNumber = action.payload.buildNumber;
    },
    setTheme: (state, action: PayloadAction<ThemeVariant | 'system'>) => {
      state.theme = action.payload;
    },
    setLocale: (state, action: PayloadAction<LocaleSymbol>) => {
      state.locale = action.payload;
    },
    setEnableAppLock: (state, action: PayloadAction<boolean>) => {
      state.enableAppLock = action.payload;
    },
    toggleEnableLocalAuthentication: (state) => {
      state.enableLocalAuthentication = !state.enableLocalAuthentication;
    },
    setEnableLocalAuthentication: (state, action: PayloadAction<boolean>) => {
      state.enableLocalAuthentication = action.payload;
    },
    setAppLockDuration: (state, action: PayloadAction<number>) => {
      state.appLockDuration = action.payload;
    },
    setSelectedFiatMoneySymbol: (
      state,
      action: PayloadAction<SettingsState['selectedFiatMoneySymbol']>,
    ) => {
      state.selectedFiatMoneySymbol = action.payload;
    },
    setRefreshTS: (state) => {
      state.refreshTimeStamp = getTimeStamp();
    },
    setAutoRefreshTimeStamp: (state) => {
      state.autoRefreshTimeStamp = getTimeStamp();
    },
    setSwapSlippagePercent: (state, action: PayloadAction<string>) => {
      state.swapSlippagePercent = action.payload;
    },
    setValidationState: (
      state,
      action: PayloadAction<{ key: ValidationFields; value: boolean }>,
    ) => {
      if (!state.validationState) {
        state.validationState = {};
      }
      const { key, value } = action.payload;
      state.validationState[key] = value;
    },
  },
});

export const {
  setTheme,
  setLocale,
  setEnableAppLock,
  toggleEnableLocalAuthentication,
  setSelectedFiatMoneySymbol,
  setRefreshTS,
  setAppLockDuration,
  setAutoRefreshTimeStamp,
  updateVersionAndBuildNumber,
  setEnableLocalAuthentication,
  setSwapSlippagePercent,
  setValidationState,
} = settingsSlice.actions;

export default settingsSlice.reducer;
