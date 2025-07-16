import { createContext, useContext } from 'react';

export const TabNameContext = createContext<string>('');
export const useTabNameContext = () => {
  return useContext(TabNameContext);
};
