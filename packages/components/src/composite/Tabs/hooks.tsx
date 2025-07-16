import { useTabNameContext } from './TabNameContext';
import { useFocusedTab } from './useFocusedTab';

export const useIsFocusedTab = () => {
  const focusedTab = useFocusedTab();
  const tabName = useTabNameContext();
  return focusedTab === tabName;
};
