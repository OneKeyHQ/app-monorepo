import type { DemoCreateModalRoutesParams } from './Modal/DemoCreateModal';
import type { DemoDoneModalRoutesParams } from './Modal/DemoDoneModal';
import type { DemoModalRoutes, DemoTabRoutes } from './Routes';
import type { NavigatorScreenParams } from '@react-navigation/native';

export type DemoModalRoutesParams = {
  [DemoModalRoutes.DemoCreateModal]: NavigatorScreenParams<DemoCreateModalRoutesParams>;
  [DemoModalRoutes.DemoDoneModal]: NavigatorScreenParams<DemoDoneModalRoutesParams>;
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
