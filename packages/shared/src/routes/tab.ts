import type { IDemoDeveloperTabParamList } from '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NavigatorRoute/Tab/RouteParamTypes';
import type {
  IMultiTabBrowserParamList,
  ITabDiscoveryParamList,
  ITabHomeParamList,
  ITabSwapParamList,
} from '@onekeyhq/shared/src/routes';

import type { ITabDeviceManagementParamList } from './tabDeviceManagement';
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
  BulkSend = 'BulkSend',
  // Used by sub-pages (e.g. ApprovalList, BulkSend) that render a clean
  // TabPageHeader without the parent tab's account-selector controls.
  SubPage = 'SubPage',
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
  [ETabRoutes.DeviceManagement]: ITabDeviceManagementParamList;
  [ETabRoutes.ReferFriends]: ITabReferFriendsParamList;
  [ETabRoutes.BulkSend]: undefined;
  [ETabRoutes.SubPage]: undefined;
};
