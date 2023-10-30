import { createContext, useContext } from 'react';

export type ContextValue = {
  themeVariant: 'light' | 'dark';
  reduxReady?: boolean;
};

export const Context = createContext<ContextValue>({} as ContextValue);

const useProviderValue = () => useContext(Context);
export default useProviderValue;
