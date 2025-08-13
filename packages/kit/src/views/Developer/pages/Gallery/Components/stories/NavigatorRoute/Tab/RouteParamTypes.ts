import type {
  EDemoDeveloperTabRoutes,
  EDemoHomeTabRoutes,
  EDemoMeTabRoutes,
  EDemoTabRoutes,
} from './Routes';

export type IDemoHomeTabParamList = {
  [EDemoHomeTabRoutes.DemoRootHome]: undefined;
  [EDemoHomeTabRoutes.DemoRootHomeSearch]: undefined;
  [EDemoHomeTabRoutes.DemoRootHomeOptions]: undefined;
};

export type IDemoDeveloperTabParamList = {
  [EDemoDeveloperTabRoutes.DemoRootDeveloper]: undefined;
  [EDemoDeveloperTabRoutes.DemoRootDeveloperOptions]: {
    from: string;
  };
};

export type IDemoMeTabParamList = {
  [EDemoMeTabRoutes.DemoRootMe]: undefined;
};

export type ITabStackParamList = {
  [EDemoTabRoutes.Home]: IDemoHomeTabParamList;
  [EDemoTabRoutes.Me]: IDemoMeTabParamList;
  [EDemoTabRoutes.Developer]: IDemoDeveloperTabParamList;
};
