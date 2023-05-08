import { withTabLayout } from '@onekeyhq/components/src/Layout/withTabLayout';

import { toFocusedLazy } from '../../../../../components/LazyRenderWhenFocus';
import DiscoverScreen from '../../../../../views/Discover';
import DAppList from '../../../../../views/Discover/DAppList';
import DiscoverHome from '../../../../../views/Discover/Home';
import MyDAppList from '../../../../../views/Discover/MyDAppList';
import { HomeRoutes, TabRoutes } from '../../../../routesEnum';

import { tabRoutesConfigBaseMap } from './tabRoutes.base';

import type { TabRouteConfig } from '../../../../types';

const name = TabRoutes.Discover;
const config: TabRouteConfig = {
  ...tabRoutesConfigBaseMap[name],
  component: withTabLayout(
    toFocusedLazy(DiscoverScreen, {
      rootTabName: name,
    }),
    name,
  ),
  children: [
    {
      name: HomeRoutes.ExploreScreen,
      component: DiscoverHome,
    },
    {
      name: HomeRoutes.DAppListScreen,
      component: DAppList,
    },
    {
      name: HomeRoutes.MyDAppListScreen,
      component: MyDAppList,
    },
  ],
};
export default config;
