import { useCurrentTabName } from './TabNameContext';
import { useFocusedTab } from './useFocusedTab';

export const useIsFocusedTab = () => {
  const focusedTab = useFocusedTab();
  const tabName = useCurrentTabName();
  return focusedTab === tabName;
};

export * from './hooks';
