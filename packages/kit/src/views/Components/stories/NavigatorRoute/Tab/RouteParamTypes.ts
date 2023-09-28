import type {
  DemoDeveloperTabRoutes,
  DemoHomeTabRoutes,
  DemoTabRoutes,
} from './Routes';
import type { NavigatorScreenParams } from '@react-navigation/native';

export type DemoHomeTabParamList = {
  [DemoHomeTabRoutes.DemoRootHomeSearch]: undefined;
  [DemoHomeTabRoutes.DemoRootHomeOptions]: undefined;
};

export type DemoDeveloperTabParamList = {
  [DemoDeveloperTabRoutes.DemoRootDeveloperSearch]: undefined;
  [DemoDeveloperTabRoutes.DemoRootDeveloperOptions]: undefined;
};

// export type TabStackParams = DemoHomeTabParams | DemoDeveloperTabParams;

export type TabStackParams = {
  [DemoTabRoutes.Home]: NavigatorScreenParams<DemoHomeTabParamList>;
  [DemoTabRoutes.Developer]: NavigatorScreenParams<DemoDeveloperTabParamList>;
};
