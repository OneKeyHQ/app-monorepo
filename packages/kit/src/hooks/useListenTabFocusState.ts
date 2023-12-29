import { useEffect } from 'react';

import { useNavigationState } from '@react-navigation/native';

import { rootNavigationRef } from '@onekeyhq/components';

export default function useListenTabFocusState(
  tabName: string,
  callback: (isFocus: boolean) => void,
) {
  const currentTabName = useNavigationState((state) => {
    const rootState = rootNavigationRef.current
      ?.getState()
      .routes.find(({ name }) => name === 'main')?.state;
    return rootState?.routeNames?.[rootState?.index || 0] || '';
  });
  useEffect(() => {
    callback(currentTabName === tabName);
  }, [callback, currentTabName, tabName]);
}
