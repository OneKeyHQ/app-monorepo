import { withTabLayout } from '@onekeyhq/components/src/Layout/withTabLayout';

import { toFocusedLazy } from '../../../../../components/LazyRenderWhenFocus';
import MarketDetail from '../../../../../views/Market/MarketDetail';
import { ScreenMarket } from '../../../../../views/Market/ScreenMarket';
import { HomeRoutes, TabRoutes } from '../../../../routesEnum';

import { tabRoutesConfigBaseMap } from './tabRoutes.base';

import type { TabRouteConfig } from '../../../../types';

const name = TabRoutes.Market;
const config: TabRouteConfig = {
  ...tabRoutesConfigBaseMap[name],
  component: toFocusedLazy(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    withTabLayout(ScreenMarket, name),
    {
      rootTabName: name,
    },
  ),
  children: [
    {
      name: HomeRoutes.MarketDetail,
      component: MarketDetail,
      alwaysShowBackButton: true,
    },
  ],
};
export default config;
