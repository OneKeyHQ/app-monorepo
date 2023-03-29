import { withTabLayout } from '@onekeyhq/components/src/Layout/withTabLayout';

import { toFocusedLazy } from '../../../../../components/LazyRenderWhenFocus';
import SwapHistory from '../../../../../views/Swap/History';
import { ScreenSwap } from '../../../../../views/Swap/ScreenSwap';
import { HomeRoutes, TabRoutes } from '../../../../routesEnum';

import { tabRoutesConfigBaseMap } from './tabRoutes.base';

import type { TabRouteConfig } from '../../../../types';

const name = TabRoutes.Swap;
const config: TabRouteConfig = {
  ...tabRoutesConfigBaseMap[name],
  hideDesktopNavHeader: true,
  component: toFocusedLazy(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    withTabLayout(ScreenSwap, name),
    {
      rootTabName: name,
    },
  ),
  children: [
    {
      name: HomeRoutes.SwapHistory,
      component: SwapHistory,
    },
  ],
};
export default config;
