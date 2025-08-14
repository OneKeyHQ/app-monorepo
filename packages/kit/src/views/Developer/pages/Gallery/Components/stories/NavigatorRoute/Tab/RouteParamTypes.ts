import type {
  EDemoDeveloperTabRoutes,
  EDemoHomeTabRoutes,
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

export type ITabStackParamList = {
  [EDemoTabRoutes.Home]: IDemoHomeTabParamList;
  [EDemoTabRoutes.Developer]: IDemoDeveloperTabParamList;
};
