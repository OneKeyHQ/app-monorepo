import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import uuid from 'react-native-uuid';

import { LocaleSymbol } from '@onekeyhq/components/src/locale';
import { ThemeVariant } from '@onekeyhq/components/src/Provider/theme';

type SettingsState = {
  theme: ThemeVariant;
  locale: LocaleSymbol;
  version: string;
  instanceId: string;
};

const initialState: SettingsState = {
  theme: 'dark',
  locale: 'zh-CN',
  version: '1.0.0',
  instanceId: uuid.v4() as string,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<ThemeVariant>) => {
      state.theme = action.payload;
    },
    setLocale: (state, action: PayloadAction<LocaleSymbol>) => {
      state.locale = action.payload;
    },
  },
});

export const { setTheme, setLocale } = settingsSlice.actions;

export default settingsSlice.reducer;
