import { useAppSelector } from './redux';

export const useWebTabs = () => useAppSelector((s) => s.webTabs.tabs);

export const useCurrentTabId = () =>
  useAppSelector((s) => s.webTabs.currentTabId);

export const useWebTab = (id?: string) => {
  const { tabs, currentTabId } = useAppSelector((s) => s.webTabs);
  const curId = id || currentTabId;
  return tabs.find((tab) => tab.id === curId);
};
