import type { IMultiTabBrowserParamList } from '@onekeyhq/kit/src/routes/Tab/MultiTabBrowser/type';
import type { IDemoDeveloperTabParamList } from '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NavigatorRoute/Tab/RouteParamTypes';
import type {
  ITabDiscoveryParamList,
  ITabHomeParamList,
  ITabMeParamList,
  ITabSwapParamList,
} from '@onekeyhq/shared/src/routes';

export enum ETabRoutes {
  Home = 'Home',
  Discovery = 'Discovery',
  Me = 'Me',
  Developer = 'Developer',
  Swap = 'Swap',
  MultiTabBrowser = 'MultiTabBrowser',
}

export type ITabStackParamList = {
  [ETabRoutes.Home]: ITabHomeParamList;
  [ETabRoutes.Discovery]: ITabDiscoveryParamList;
  [ETabRoutes.Me]: ITabMeParamList;
  [ETabRoutes.Developer]: IDemoDeveloperTabParamList;
  [ETabRoutes.Swap]: ITabSwapParamList;
  [ETabRoutes.MultiTabBrowser]: IMultiTabBrowserParamList;
};
