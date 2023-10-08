import type {
  DemoDeveloperTabRoutes,
  DemoHomeTabRoutes,
  DemoMeTabRoutes,
  DemoTabRoutes,
} from './Routes';

export type DemoHomeTabParamList = {
  [DemoHomeTabRoutes.DemoRootHome]: undefined;
  [DemoHomeTabRoutes.DemoRootHomeSearch]: undefined;
  [DemoHomeTabRoutes.DemoRootHomeOptions]: undefined;
};

export type DemoDeveloperTabParamList = {
  [DemoDeveloperTabRoutes.DemoRootDeveloper]: undefined;
  [DemoDeveloperTabRoutes.DemoRootDeveloperOptions]: {
    from: string;
  };
};

export type DemoMeTabParamList = {
  [DemoMeTabRoutes.DemoRootMe]: undefined;
};

export type TabStackParamList = {
  [DemoTabRoutes.Home]: DemoHomeTabParamList;
  [DemoTabRoutes.Me]: DemoMeTabParamList;
  [DemoTabRoutes.Developer]: DemoDeveloperTabParamList;
};
