import { useTabNameContext as useNativeTabNameContext } from './TabNameContext';
import { useFocusedTab } from './useFocusedTab';

export const useTabNameContext = useNativeTabNameContext;

export const useIsFocusedTab = () => {
  const focusedTab = useFocusedTab();
  const tabName = useTabNameContext();
  return focusedTab === tabName;
};
