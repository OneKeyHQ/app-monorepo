import type { IRootStackNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import { RootStackNavigator } from '@onekeyhq/components/src/Navigation/Navigator';

import DemoModalStackScreen from './Modal';
import { DemoRootRoutes } from './Routes';
import Tab from './Tab/DemoTabNavigator';

const rootConfig: IRootStackNavigatorConfig<DemoRootRoutes, any>[] = [
  {
    name: DemoRootRoutes.Main,
    component: Tab,
    initialRoute: true,
  },
  {
    name: DemoRootRoutes.Modal,
    component: DemoModalStackScreen,
    type: 'modal',
  },
];

export const DemoRootApp = () => (
  <RootStackNavigator<DemoRootRoutes, any> config={rootConfig} />
);
