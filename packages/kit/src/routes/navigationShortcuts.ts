import { getAppNavigation } from '../hooks/useAppNavigation';

import { buildTabName } from './Root/Main/Tab/tabNavHeader';
import { MainRoutes, RootRoutes, TabRoutes } from './routesEnum';

function navigateToHome() {
  const navigation = getAppNavigation();
  // @ts-ignore
  navigation?.navigate(RootRoutes.Main, {
    screen: MainRoutes.Tab,
    params: {
      screen: TabRoutes.Home,
      params: {
        screen: buildTabName(TabRoutes.Home),
      },
    },
  });
}

export default {
  navigateToHome,
};
