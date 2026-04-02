import { createContext, useContext } from 'react';

import type { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';

export type ISettingConfigContextValue = {
  // Resolved theme variant actually used for rendering.
  theme: 'light' | 'dark';
  // Raw user setting ("system"/"auto" vs forced light/dark). Optional for
  // hosts that don't have a persisted settings store.
  themeSetting?: 'light' | 'dark' | 'system';
  locale: ILocaleSymbol;
  HyperlinkText: typeof HyperlinkText;
};

export const SettingConfigContext = createContext<ISettingConfigContextValue>(
  {} as ISettingConfigContextValue,
);

export const useSettingConfig = () => useContext(SettingConfigContext);
