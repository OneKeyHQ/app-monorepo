import { createContext, useContext } from 'react';

export type IContextScreenLayoutValue = {
  leftSidebarCollapsed?: boolean;
  setLeftSidebarCollapsed?: (value: boolean) => void;
  leftSidebarCollapsedAfterAnimated?: boolean;
  setLeftSidebarCollapsedAfterAnimated?: (value: boolean) => void;
};

export const ContextSideBar = createContext<IContextScreenLayoutValue>(
  {} as IContextScreenLayoutValue,
);

const useProviderSideBarValue = () => useContext(ContextSideBar);
export default useProviderSideBarValue;
