import type { TabHomeParamList } from './Home/Routes';
import type { TabMeParamList } from './Me/Routes';
import type { TabSwapParamList } from './Swap/Routes';
import type { DemoDeveloperTabParamList } from '../../../views/Components/stories/NavigatorRoute/Tab/RouteParamTypes';

export enum TabRoutes {
  Home = 'Home',
  Me = 'Me',
  Developer = 'Developer',
  Swap = 'Swap',
}

export type TabStackParamList = {
  [TabRoutes.Home]: TabHomeParamList;
  [TabRoutes.Me]: TabMeParamList;
  [TabRoutes.Developer]: DemoDeveloperTabParamList;
  [TabRoutes.Swap]: TabSwapParamList;
};
