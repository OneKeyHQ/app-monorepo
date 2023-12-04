import type { ITabHomeParamList } from './Home/Routes';
import type { ITabMeParamList } from './Me/Routes';
import type { ITabSwapParamList } from './Swap/Routes';
import type { IWebViewParamList } from './WebView/Routes';
import type { IDemoDeveloperTabParamList } from '../../views/Components/stories/NavigatorRoute/Tab/RouteParamTypes';

export enum ETabRoutes {
  Home = 'Home',
  Me = 'Me',
  Developer = 'Developer',
  Swap = 'Swap',
  WebViewTab = 'WebViewTab',
}

export type ITabStackParamList = {
  [ETabRoutes.Home]: ITabHomeParamList;
  [ETabRoutes.Me]: ITabMeParamList;
  [ETabRoutes.Developer]: IDemoDeveloperTabParamList;
  [ETabRoutes.Swap]: ITabSwapParamList;
  [ETabRoutes.WebViewTab]: IWebViewParamList;
};
