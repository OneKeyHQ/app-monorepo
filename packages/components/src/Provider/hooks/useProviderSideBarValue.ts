import { createContext, useContext } from 'react';

export type ContextScreenLayoutValue = {
  leftSidebarCollapsed?: boolean;
  setLeftSidebarCollapsed?: (value: boolean) => void;
};

export const ContextSideBar = createContext<ContextScreenLayoutValue>(
  {} as ContextScreenLayoutValue,
);

const useProviderSideBarValue = () => useContext(ContextSideBar);
export default useProviderSideBarValue;
