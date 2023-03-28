import { useEffect } from 'react';

import useAppNavigation from '../../hooks/useAppNavigation';
import {
  HomeRoutes,
  MainRoutes,
  RootRoutes,
  TabRoutes,
} from '../../routes/routesEnum';

const RedirectOldPathToRevokePage = () => {
  const navigation = useAppNavigation();
  useEffect(() => {
    // if (platformEnv.isWeb) {
    //   window.location.href = '/revoke';
    // }
    navigation?.navigate(RootRoutes.Main, {
      screen: MainRoutes.Tab,
      params: {
        screen: TabRoutes.Home,
        params: {
          screen: HomeRoutes.Revoke,
        },
      },
    });
  }, [navigation]);

  return null;
};

export default RedirectOldPathToRevokePage;
