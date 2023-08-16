import { TabRoutes } from '../../../../routesEnum';

import AppRootTabDiscover from './AppRootTabDiscover';
import AppRootTabHome from './AppRootTabHome';
import AppRootTabMarket from './AppRootTabMarket';
import AppRootTabMe from './AppRootTabMe';
// import AppRootTabNFT from './AppRootTabNFT';
import AppRootTabSwap from './AppRootTabSwap';
import { tabRoutesOrders } from './tabRoutes.base';

import type { TabRouteConfig } from '../../../../types';

const allRoutes: TabRouteConfig[] = [
  AppRootTabHome,
  AppRootTabMarket,
  AppRootTabSwap,
  // AppRootTabNFT,
  AppRootTabDiscover,
  AppRootTabMe,
];
export const tabRoutes: TabRouteConfig[] = tabRoutesOrders
  .map((name) => {
    let r = allRoutes.find((item) => item.name === name);
    if (process.env.NODE_ENV !== 'production') {
      if (!r && name === TabRoutes.Developer) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
        r = require('./AppRootTabDeveloper').default;
      }
    }
    if (r) {
      if (r.hideOnProduction && process.env.NODE_ENV === 'production') {
        return undefined;
      }
      return r;
    }
    return undefined;
  })
  .filter(Boolean);
