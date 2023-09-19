import { tabRouteWrapper } from '@onekeyhq/components/src/Navigation';

import { DemoTabChildRoutes, DemoTabRoutes } from '../../Modal/types';
import { tabRoutesConfigBaseMap } from '../tabRoutesConfigBase';
import DemoRootHome from '../View/DemoRootHome';
import DemoRootHomeOptions from '../View/DemoRootHomeOptions';
import DemoRootHomeSearch from '../View/DemoRootHomeSearch';

import type { DemoTabRouteConfig } from '../DemoTabRouteConfig';

const name = DemoTabRoutes.Home;
const config: DemoTabRouteConfig = {
  ...tabRoutesConfigBaseMap[name],
  component: tabRouteWrapper(DemoRootHome),
  children: [
    {
      name: DemoTabChildRoutes.DemoRootHomeSearch,
      component: DemoRootHomeSearch,
    },
    {
      name: DemoTabChildRoutes.DemoRootHomeOptions,
      component: DemoRootHomeOptions,
    },
  ],
};
export default config;
