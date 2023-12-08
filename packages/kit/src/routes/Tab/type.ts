import type { ITabDiscoveryParamList } from './Discovery/type';
import type { ITabMeParamList } from './Me/type';
import type { IMultiTabBrowserParamList } from './MultiTabBrowser/type';
import type { ITabSwapParamList } from './Swap/type';
import type { IDemoDeveloperTabParamList } from '../../views/Developer/pages/Gallery/Components/stories/NavigatorRoute/Tab/RouteParamTypes';
import type { ITabHomeParamList } from '../../views/Home/type';

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
