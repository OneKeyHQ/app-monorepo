/* eslint-disable @typescript-eslint/no-unused-vars */

import type { TabNavigatorProps } from '@onekeyhq/components/src/Navigation/Navigator';
import { TabStackNavigator } from '@onekeyhq/components/src/Navigation/Navigator';

import { DemoHomeTabRoutes, DemoTabRoutes } from './Routes';
import DemoRootDeveloper from './View/DemoRootDeveloper';
import DemoRootHome from './View/DemoRootHome';
import DemoRootHomeOptions from './View/DemoRootHomeOptions';
import DemoRootHomeSearch from './View/DemoRootHomeSearch';

const config: TabNavigatorProps<any, any> = [
  {
    name: DemoTabRoutes.Home,
    tabBarIcon: (focused: boolean) =>
      focused ? 'CreditCardSolid' : 'CreditCardOutline',
    translationId: 'wallet__wallet',
    component: DemoRootHome,
    children: [
      {
        name: DemoHomeTabRoutes.DemoRootHomeSearch,
        component: DemoRootHomeSearch,
      },
      {
        name: DemoHomeTabRoutes.DemoRootHomeOptions,
        component: DemoRootHomeOptions,
      },
    ],
  },
  {
    name: DemoTabRoutes.Developer,
    tabBarIcon: (focused: boolean) =>
      focused ? 'CodeBracketSquareMini' : 'CodeBracketMini',
    translationId: 'form__dev_mode',
    component: DemoRootDeveloper,
  },
];

function DemoTabNavigator() {
  return <TabStackNavigator config={config} />;
}

export default DemoTabNavigator;
