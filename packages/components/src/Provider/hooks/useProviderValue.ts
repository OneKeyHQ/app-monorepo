import { createContext, useContext } from 'react';

import type { LocaleSymbol } from '../../locale';
import type { DeviceState } from '../device';
import type { ThemeVariant } from '../theme';

export type ContextValue = {
  themeVariant: ThemeVariant;
  locale: LocaleSymbol;
  device: DeviceState;
  hapticsEnabled: boolean;
};

export const Context = createContext<ContextValue>({} as ContextValue);

const useProviderValue = () => useContext(Context);
export default useProviderValue;
