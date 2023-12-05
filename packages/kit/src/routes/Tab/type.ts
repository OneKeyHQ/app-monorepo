import type { ITabDiscoveryParamList } from './Discovery/Routes';
import type { ITabHomeParamList } from './Home/Routes';
import type { ITabMeParamList } from './Me/Routes';
import type { IMultiTabBrowserParamList } from './MultiTabBrowser/Routes';
import type { ITabSwapParamList } from './Swap/Routes';
import type { IDemoDeveloperTabParamList } from '../../views/Components/stories/NavigatorRoute/Tab/RouteParamTypes';

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
