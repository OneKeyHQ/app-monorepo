import type { IRootStackNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { RootStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import ModalNavigator from './Modal/ModalNavigator';
import NativeFullScreenNavigator from './NativeFullScreenNavigator/NativeFullScreenNavigator';
import { ERootRoutes } from './Routes';
import TabNavigator from './Tab/TabNavigator';

const rootConfig: IRootStackNavigatorConfig<ERootRoutes, any>[] = [
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
    name: ERootRoutes.NativeFullScreen,
    component: NativeFullScreenNavigator,
    type: 'nativeFullScreen',
  },
];

export function RootNavigator() {
  return <RootStackNavigator<ERootRoutes, any> config={rootConfig} />;
}
