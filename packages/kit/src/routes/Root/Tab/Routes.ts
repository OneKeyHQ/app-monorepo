import type { TabDiscoveryParamList } from './Discovery/Routes';
import type { TabHomeParamList } from './Home/Routes';
import type { TabMeParamList } from './Me/Routes';
import type { MultiTabBrowserParamList } from './MultiTabBrowser/Routes';
import type { TabSwapParamList } from './Swap/Routes';
import type { DemoDeveloperTabParamList } from '../../../views/Components/stories/NavigatorRoute/Tab/RouteParamTypes';

export enum TabRoutes {
  Home = 'Home',
  Discovery = 'Discovery',
  Me = 'Me',
  Developer = 'Developer',
  Swap = 'Swap',
  MultiTabBrowser = 'MultiTabBrowser',
}

export type TabStackParamList = {
  [TabRoutes.Home]: TabHomeParamList;
  [TabRoutes.Discovery]: TabDiscoveryParamList;
  [TabRoutes.Me]: TabMeParamList;
  [TabRoutes.Developer]: DemoDeveloperTabParamList;
  [TabRoutes.Swap]: TabSwapParamList;
  [TabRoutes.MultiTabBrowser]: MultiTabBrowserParamList;
};
