import { useEffect } from 'react';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import useNavigation from './useNavigation';

function useAutoRedirectToRoute() {
  const navigation = useNavigation();
  useEffect(() => {
    // noop
    if (platformEnv.isExtension) {
      const searchParams = new URLSearchParams(window.location.search);
      const routerName = searchParams.get('router');
      if (routerName) {
        navigation.navigate(routerName as any);
      }
    }
  }, [navigation]);
}

export default useAutoRedirectToRoute;
