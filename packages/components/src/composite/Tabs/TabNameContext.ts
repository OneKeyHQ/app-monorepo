import { createContext, useContext } from 'react';

export const TabNameContext = createContext<string>('');
export const useCurrentTabName = () => {
  return useContext(TabNameContext);
};
