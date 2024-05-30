import type { IDemoDeveloperTabParamList } from '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NavigatorRoute/Tab/RouteParamTypes';
import type {
  IMultiTabBrowserParamList,
  ITabDiscoveryParamList,
  ITabHomeParamList,
  ITabMeParamList,
  ITabSwapParamList,
} from '@onekeyhq/shared/src/routes';

import type { ITabMarketParamList } from './tabMarket';

export enum ETabRoutes {
  Home = 'Home',
  Market = 'Market',
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
  [ETabRoutes.Market]: ITabMarketParamList;
  [ETabRoutes.Swap]: ITabSwapParamList;
  [ETabRoutes.MultiTabBrowser]: IMultiTabBrowserParamList;
};
