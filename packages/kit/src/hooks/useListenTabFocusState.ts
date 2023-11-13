import { useEffect } from 'react';
import { useNavigationState } from '@react-navigation/native';

/**
 * Note that this method is only effective in the current routing structure.
 * If the hierarchical relationship between the root route and the tab route changes, it may be necessary to recheck its availability.
 */

export default function useListenTabFocusState(
  tabName: string,
  callback: (isFocus: boolean) => void,
) {
  const routes = useNavigationState((state) => state.routes);
  console.log(routes)
  // useEffect(() => {
  //   callback(route.currentTab === tabName);
  // }, [callback, route.currentTab, tabName]);
}
