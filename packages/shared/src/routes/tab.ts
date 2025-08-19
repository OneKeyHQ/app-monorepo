import type { IDemoDeveloperTabParamList } from '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NavigatorRoute/Tab/RouteParamTypes';
import type {
  IModalDeviceManagementParamList,
  IModalReferFriendsParamList,
  IMultiTabBrowserParamList,
  ITabDiscoveryParamList,
  ITabHomeParamList,
  ITabMeParamList,
  ITabSwapParamList,
} from '@onekeyhq/shared/src/routes';

import type { ITabEarnParamList } from './tabEarn';
import type { ITabMarketParamList } from './tabMarket';

export enum ETabRoutes {
  Home = 'Home',
  Market = 'Market',
  Discovery = 'Discovery',
  Me = 'Me',
  Developer = 'Developer',
  Earn = 'Earn',
  Swap = 'Swap',
  WebviewPerpTrade = 'WebviewPerpTrade',
  MultiTabBrowser = 'MultiTabBrowser',
  DeviceManagement = 'DeviceManagement',
  ReferFriends = 'ReferFriends',
}

export type ITabStackParamList = {
  [ETabRoutes.Home]: ITabHomeParamList;
  [ETabRoutes.Discovery]: ITabDiscoveryParamList;
  [ETabRoutes.Me]: ITabMeParamList;
  [ETabRoutes.Developer]: IDemoDeveloperTabParamList;
  [ETabRoutes.Earn]: ITabEarnParamList;
  [ETabRoutes.Market]: ITabMarketParamList;
  [ETabRoutes.Swap]: ITabSwapParamList;
  [ETabRoutes.WebviewPerpTrade]: undefined;
  [ETabRoutes.MultiTabBrowser]: IMultiTabBrowserParamList;
  [ETabRoutes.DeviceManagement]: IModalDeviceManagementParamList;
  [ETabRoutes.ReferFriends]: IModalReferFriendsParamList;
};
