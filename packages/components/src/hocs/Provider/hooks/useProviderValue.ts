import { createContext, useContext } from 'react';

import type { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';

export type IContextValue = {
  theme: 'light' | 'dark';
  locale: ILocaleSymbol;
  HyperlinkText: typeof HyperlinkText;
};

export const Context = createContext<IContextValue>({} as IContextValue);

export const useSettingConfig = () => useContext(Context);
