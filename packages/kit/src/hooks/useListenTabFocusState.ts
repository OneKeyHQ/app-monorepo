import { useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

/**
 * Note that this method is only effective in the current routing structure.
 * If the hierarchical relationship between the root route and the tab route changes, it may be necessary to recheck its availability.
 */

export default function useListenTabFocusState(
  tabName: string,
  callback: (isFocus: boolean) => void,
) {
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', (state) => {
      // state.data corresponds to the root home route.
      // state.data.state corresponds to the root tab route.
      const { routeNames, index } = state.data?.state?.routes?.[0].state || {};
      if (routeNames && index) {
        callback(routeNames[index] === tabName);
      }
    });
    return unsubscribe;
  }, [callback, navigation, tabName]);
}
