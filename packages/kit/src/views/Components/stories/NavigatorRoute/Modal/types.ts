import type { DemoCreateModalParamList } from './DemoCreateModal';
import type { DemoDoneModalParamList } from './DemoDoneModal';
import type { DemoRootModalRoutes } from './RootModalRoutes';

export type RootModalRouteParams = {
  screen: DemoRootModalRoutes;
  params?: DemoCreateModalParamList | DemoDoneModalParamList;
};

export type RootModalStackParamList = {
  [DemoRootModalRoutes.DemoCreateModal]: undefined;
  [DemoRootModalRoutes.DemoDoneModal]: undefined;
};
