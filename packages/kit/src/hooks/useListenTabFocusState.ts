import { useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import { useRouteAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/route';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

/**
 * Note that this method is only effective in the current routing structure.
 * If the hierarchical relationship between the root route and the tab route changes, it may be necessary to recheck its availability.
 */

export default function useListenTabFocusState(
  tabName: string,
  callback: (isFocus: boolean) => void,
) {
  const [route] = useRouteAtom();
  useEffect(() => {
    callback(route.currentTab === tabName);
  }, [callback, route.currentTab, tabName]);
}
