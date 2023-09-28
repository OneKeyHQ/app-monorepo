import type { DemoCreateModalParamList } from './DemoCreateModal';
import type { DemoDoneModalParamList } from './DemoDoneModal';
import type {
  DemoCreateModalRoutes,
  DemoDoneModalRoutes,
  RootModalRoutes,
} from './Routes';
import type { NavigatorScreenParams } from '@react-navigation/native';

type DemoCreateModalParams = {
  screen: DemoCreateModalRoutes;
  params?: DemoCreateModalParamList;
};

type DemoDoneModalParams = {
  screen: DemoDoneModalRoutes;
  params?: DemoDoneModalParamList;
};

export type RootModalParams = DemoCreateModalParams | DemoDoneModalParams;

export type DemoModalRoutesParams = {
  [RootModalRoutes.DemoCreateModal]: NavigatorScreenParams<DemoCreateModalParamList>;
  [RootModalRoutes.DemoDoneModal]: NavigatorScreenParams<DemoDoneModalParamList>;
};
