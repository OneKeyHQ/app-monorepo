import { createContext, useContext } from 'react';

import type { ThemeVariant } from '../theme';

export type ContextValue = {
  themeVariant: ThemeVariant;
  reduxReady?: boolean;
};

export const Context = createContext<ContextValue>({} as ContextValue);

const useProviderValue = () => useContext(Context);
export default useProviderValue;
