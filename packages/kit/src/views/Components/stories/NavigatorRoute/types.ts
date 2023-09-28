import type { RootStackParamList } from './DemoRootApp';
import type { DemoCreateModalParamList } from './Modal/DemoCreateModal';
import type { DemoDoneModalParamList } from './Modal/DemoDoneModal';
import type { DemoRootModalRoutes } from './Modal/RootModalRoutes';
import type { RootModalStackParamList } from './Modal/types';
import type { DemoRootRoutes, DemoTabRoutes } from './RootRoutes';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { RootModalRouteParams } from './Modal/types';

export type DemoModalRoutesParams = {
  [DemoRootModalRoutes.DemoCreateModal]: NavigatorScreenParams<DemoCreateModalParamList>;
  [DemoRootModalRoutes.DemoDoneModal]: NavigatorScreenParams<DemoDoneModalParamList>;
};

export type DemoTabRoutesParams = {
  [DemoTabRoutes.Home]: NavigatorScreenParams<DemoHomeRoutesParams> | undefined;
  [DemoTabRoutes.Developer]:
    | NavigatorScreenParams<DemoHomeRoutesParams>
    | undefined;
};

export type DemoHomeRoutesParams = {
  [DemoTabRoutes.Home]: undefined;
  [DemoTabRoutes.Developer]: undefined;
};

export type GlobalRouteParams = {
  [DemoRootRoutes.Main]: RootStackParamList;
  [DemoRootRoutes.Modal]: RootModalRouteParams;
};
