import { tabRouteWrapper } from '@onekeyhq/components/src/Navigation';

import { DemoTabRoutes } from '../../Modal/types';
import { tabRoutesConfigBaseMap } from '../tabRoutesConfigBase';
import DemoRootDeveloper from '../View/DemoRootDeveloper';

import type { DemoTabRouteConfig } from '../DemoTabRouteConfig';

const name = DemoTabRoutes.Developer;
const config: DemoTabRouteConfig = {
  ...tabRoutesConfigBaseMap[name],
  component: tabRouteWrapper(DemoRootDeveloper),
  children: [],
};
export default config;
