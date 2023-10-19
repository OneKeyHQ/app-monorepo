import { createContext, useContext } from 'react';

export const ActiveTabContext = createContext({
  activeTabName: '',
});

export const useActiveTab = () => useContext(ActiveTabContext);

export const TabStatusContext = createContext({
  isTabActive: false,
});

export const useTabStatus = () => useContext(TabStatusContext);
