import { useAppSelector } from './redux';

export const useWebTabs = () => useAppSelector((s) => s.webTabs.tabs);

export const useCurrentTabId = () =>
  useAppSelector((s) => s.webTabs.currentTabId);
