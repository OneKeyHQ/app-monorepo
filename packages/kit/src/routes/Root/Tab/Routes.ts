import type { TabHomeParamList } from './Home/Routes';
import type { TabMeParamList } from './Me/Routes';
import type { TabSwapParamList } from './Swap/Routes';
import type { WebViewParamList } from './WebView/Routes';
import type { IDemoDeveloperTabParamList } from '../../../views/Components/stories/NavigatorRoute/Tab/RouteParamTypes';

export enum TabRoutes {
  Home = 'Home',
  Me = 'Me',
  Developer = 'Developer',
  Swap = 'Swap',
  WebViewTab = 'WebViewTab',
}

export type ITabStackParamList = {
  [TabRoutes.Home]: TabHomeParamList;
  [TabRoutes.Me]: TabMeParamList;
  [TabRoutes.Developer]: IDemoDeveloperTabParamList;
  [TabRoutes.Swap]: TabSwapParamList;
  [TabRoutes.WebViewTab]: WebViewParamList;
};
