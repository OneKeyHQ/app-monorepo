import { useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useNavigation from './useNavigation';

// TODO official support:
//      https://reactnavigation.org/docs/web-support/
function useAutoRedirectToRoute() {
  const navigation = useNavigation();
  useEffect(() => {
    // noop
    if (platformEnv.isExtension) {
      const searchParams = new URLSearchParams(window.location.search);
      const routerName = searchParams.get('route');
      if (routerName) {
        navigation.navigate(routerName as any);
      }
    }
  }, [navigation]);
}

export default useAutoRedirectToRoute;
