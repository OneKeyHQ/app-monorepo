import { useEffect } from 'react';

import { useNavigationState } from '@react-navigation/native';

export default function useListenTabFocusState(
  tabName: string,
  callback: (isFocus: boolean) => void,
) {
  const currentTabName = useNavigationState((state) => {
    const rootState = state.routes.find(({ name }) => name === 'main')?.state;
    console.log('rootState', rootState);
    console.log('state--', state);
    return rootState?.routeNames?.[rootState?.index || 0] || '';
  });
  useEffect(() => {
    callback(currentTabName === tabName);
  }, [callback, currentTabName, tabName]);
}
