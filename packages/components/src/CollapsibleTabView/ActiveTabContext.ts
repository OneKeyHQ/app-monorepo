import { createContext, useContext } from 'react';

export const ActiveTabContext = createContext({
  activeTabName: '',
});

export const useActiveTab = () => useContext(ActiveTabContext);
