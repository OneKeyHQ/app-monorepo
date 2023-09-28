import type { RootModalParams } from './Modal/RouteParamTypes';
import type { DemoRootRoutes } from './Routes';
import type { TabStackParams } from './Tab/RouteParamTypes';
import type { DemoTabRoutes } from './Tab/Routes';

export type DemoHomeRoutesParams = {
  [DemoTabRoutes.Home]: undefined;
  [DemoTabRoutes.Developer]: undefined;
};

export type GlobalRouteParams = {
  [DemoRootRoutes.Main]: TabStackParams;
  [DemoRootRoutes.Modal]: RootModalParams;
};
