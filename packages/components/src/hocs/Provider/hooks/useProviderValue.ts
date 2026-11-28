import { createContext, useContext } from 'react';

import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';

import type { IHyperlinkTextComponent } from '../types';

export type ISettingConfigContextValue = {
  // Resolved theme variant actually used for rendering.
  theme: 'light' | 'dark';
  // Raw user setting ("system"/"auto" vs forced light/dark). Optional for
  // hosts that don't have a persisted settings store.
  themeSetting?: 'light' | 'dark' | 'system';
  locale: ILocaleSymbol;
  hapticFeedbackEnabled: boolean;
  HyperlinkText: IHyperlinkTextComponent;
};

export const SettingConfigContext = createContext<ISettingConfigContextValue>(
  {} as ISettingConfigContextValue,
);

export const useSettingConfig = () => useContext(SettingConfigContext);
