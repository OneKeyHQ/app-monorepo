import { createContext, useContext, useMemo } from 'react';

export type ContextActiveTab = {
  activeTabKey?: string;
  setActiveTabKey?: (key: string | undefined) => void;
};
export const ActiveTabContext = createContext<ContextActiveTab>({});

export const useActiveTabContext = () => useContext(ActiveTabContext);
export const useActiveTabKey = () => {
  const { activeTabKey } = useActiveTabContext();
  return useMemo(() => activeTabKey, [activeTabKey]);
};

export const TabStatusContext = createContext({
  isTabActive: false,
});

export const useTabStatus = () => useContext(TabStatusContext);
