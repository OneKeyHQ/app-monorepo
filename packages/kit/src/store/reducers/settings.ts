import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import uuid from 'react-native-uuid';

import { LocaleSymbol } from '@onekeyhq/components/src/locale';
import { ThemeVariant } from '@onekeyhq/components/src/Provider/theme';
import { getTimeStamp } from '@onekeyhq/kit/src/utils/helper';

type SettingsState = {
  theme: ThemeVariant | 'system';
  locale: LocaleSymbol;
  version: string;
  instanceId: string;
  enableAppLock: boolean;
  enableLocalAuthentication: boolean;
  selectedFiatMoneySymbol: string;
  refreshTimeStamp: number;
};

const initialState: SettingsState = {
  theme: 'dark',
  locale: 'zh-CN',
  version: '1.0.0',
  instanceId: uuid.v4() as string,
  enableAppLock: false,
  enableLocalAuthentication: false,
  selectedFiatMoneySymbol: 'usd',
  refreshTimeStamp: getTimeStamp(),
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<ThemeVariant | 'system'>) => {
      state.theme = action.payload;
    },
    setLocale: (state, action: PayloadAction<LocaleSymbol>) => {
      state.locale = action.payload;
    },
    setEnableAppLock: (state, action: PayloadAction<boolean>) => {
      state.enableAppLock = action.payload;
    },
    setEnableLocalAuthentication: (state, action: PayloadAction<boolean>) => {
      state.enableLocalAuthentication = action.payload;
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
  },
});

export const {
  setTheme,
  setLocale,
  setEnableAppLock,
  setEnableLocalAuthentication,
  setSelectedFiatMoneySymbol,
  setRefreshTS,
} = settingsSlice.actions;

export default settingsSlice.reducer;
