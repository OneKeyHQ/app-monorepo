import type { IDemoDeveloperTabParamList } from '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NavigatorRoute/Tab/RouteParamTypes';
import type {
  IModalDeviceManagementParamList,
  IMultiTabBrowserParamList,
  ITabDiscoveryParamList,
  ITabHomeParamList,
  ITabSwapParamList,
} from '@onekeyhq/shared/src/routes';

import type { ITabEarnParamList } from './tabEarn';
import type { ITabMarketParamList } from './tabMarket';
import type { ITabReferFriendsParamList } from './tabReferFriends';

export enum ETabRoutes {
  Home = 'Home',
  Market = 'Market',
  Discovery = 'Discovery',
  Developer = 'Developer',
  Earn = 'Earn',
  Swap = 'Swap',
  Perp = 'Perp',
  WebviewPerpTrade = 'WebviewPerpTrade',
  MultiTabBrowser = 'MultiTabBrowser',
  DeviceManagement = 'DeviceManagement',
  ReferFriends = 'ReferFriends',
}

export type ITabStackParamList = {
  [ETabRoutes.Home]: ITabHomeParamList;
  [ETabRoutes.Discovery]: ITabDiscoveryParamList;
  [ETabRoutes.Developer]: IDemoDeveloperTabParamList;
  [ETabRoutes.Earn]: ITabEarnParamList;
  [ETabRoutes.Market]: ITabMarketParamList;
  [ETabRoutes.Swap]: ITabSwapParamList;
  [ETabRoutes.Perp]: undefined;
  [ETabRoutes.WebviewPerpTrade]: undefined;
  [ETabRoutes.MultiTabBrowser]: IMultiTabBrowserParamList;
  [ETabRoutes.DeviceManagement]: IModalDeviceManagementParamList;
  [ETabRoutes.ReferFriends]: ITabReferFriendsParamList;
};
