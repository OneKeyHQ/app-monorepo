import { createContext, useContext } from 'react';

import type { ILocaleSymbol } from '../../../locale';

export type IContextValue = {
  theme: 'light' | 'dark';
  locale: ILocaleSymbol;
};

export const Context = createContext<IContextValue>({} as IContextValue);

export const useSettingConfig = () => useContext(Context);
