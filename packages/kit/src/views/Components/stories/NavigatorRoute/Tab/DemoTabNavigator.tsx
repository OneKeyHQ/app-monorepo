/* eslint-disable @typescript-eslint/no-unused-vars */

import type { TabNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import { TabStackNavigator } from '@onekeyhq/components/src/Navigation/Navigator';

import {
  DemoDeveloperTabRoutes,
  DemoHomeTabRoutes,
  DemoMeTabRoutes,
  DemoTabRoutes,
  DemoTabsTabRoutes,
} from './Routes';
import DemoRootDeveloper from './View/DemoRootDeveloper';
import DemoRootDeveloperOptions from './View/DemoRootDeveloperOptions';
import DemoRootHome from './View/DemoRootHome';
import DemoRootHomeOptions from './View/DemoRootHomeOptions';
import DemoRootHomeSearch from './View/DemoRootHomeSearch';
import DemoRootMe from './View/DemoRootMe';
import DemoRootTabs from './View/DemoRootTabs';

const config: TabNavigatorConfig<DemoTabRoutes>[] = [
  {
    name: DemoTabRoutes.Home,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CreditCardSolid' : 'CreditCardOutline',
    translationId: 'wallet__wallet',
    freezeOnBlur: true,
    children: [
      {
        name: DemoHomeTabRoutes.DemoRootHome,
        component: DemoRootHome,
        translationId: 'Home',
      },
      {
        name: DemoHomeTabRoutes.DemoRootHomeSearch,
        component: DemoRootHomeSearch,
        translationId: 'RootHomeSearch',
      },
      {
        name: DemoHomeTabRoutes.DemoRootHomeOptions,
        component: DemoRootHomeOptions,
        translationId: 'RootHomeOptions',
      },
    ],
  },
  {
    name: DemoTabRoutes.Me,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'MailOpenMini' : 'EmailOutline',
    translationId: 'form__me',
    freezeOnBlur: true,
    children: [
      {
        name: DemoMeTabRoutes.DemoRootMe,
        component: DemoRootMe,
        translationId: 'Me',
      },
    ],
  },
  {
    name: DemoTabRoutes.Tabs,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'ChatGptSolid' : 'ChatGptOutline',
    translationId: 'form__tabs',
    freezeOnBlur: true,
    children: [
      {
        name: DemoTabsTabRoutes.DemoRootTabs,
        component: DemoRootTabs,
        translationId: 'Tabs',
      },
    ],
  },
  {
    name: DemoTabRoutes.Developer,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CodeBracketSquareMini' : 'CodeBracketMini',
    translationId: 'form__dev_mode',
    freezeOnBlur: true,
    children: [
      {
        name: DemoDeveloperTabRoutes.DemoRootDeveloper,
        component: DemoRootDeveloper,
        translationId: 'Developer',
      },
      {
        name: DemoDeveloperTabRoutes.DemoRootDeveloperOptions,
        component: DemoRootDeveloperOptions,
        translationId: 'RootDeveloperOptions',
      },
    ],
  },
];

function DemoTabNavigator() {
  return <TabStackNavigator<DemoTabRoutes> config={config} />;
}

export default DemoTabNavigator;
