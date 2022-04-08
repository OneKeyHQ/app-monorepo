import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import uuid from 'react-native-uuid';

import { LocaleSymbol } from '@onekeyhq/components/src/locale';
import { ThemeVariant } from '@onekeyhq/components/src/Provider/theme';
import { getTimeStamp } from '@onekeyhq/kit/src/utils/helper';

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
};

const initialState: SettingsState = {
  theme: 'dark',
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
};

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
} = settingsSlice.actions;

export default settingsSlice.reducer;
