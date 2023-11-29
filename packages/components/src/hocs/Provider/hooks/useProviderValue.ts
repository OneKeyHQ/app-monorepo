import { createContext, useContext } from 'react';

export type IContextValue = {
  themeVariant: 'light' | 'dark';
  reduxReady?: boolean;
};

export const Context = createContext<IContextValue>({} as IContextValue);

const useProviderValue = () => useContext(Context);
export default useProviderValue;
