import type { IRootStackNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { ERootRoutes } from './enum';
import { IOSFullScreenNavigator } from './iOSFullScreen/Navigator';
import { ModalNavigator } from './Modal/Navigator';
import TabNavigator from './Tab/TabNavigator';

export const rootRouter: IRootStackNavigatorConfig<ERootRoutes, any>[] = [
  {
    name: ERootRoutes.Main,
    component: TabNavigator,
    initialRoute: true,
  },
  {
    name: ERootRoutes.Modal,
    component: ModalNavigator,
    type: 'modal',
  },
  {
    name: ERootRoutes.iOSFullScreen,
    component: IOSFullScreenNavigator,
    type: 'iOSFullScreen',
  },
];
