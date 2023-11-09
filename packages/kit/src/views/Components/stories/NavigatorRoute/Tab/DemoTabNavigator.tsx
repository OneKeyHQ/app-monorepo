/* eslint-disable @typescript-eslint/no-unused-vars */

import type { ITabNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
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

const config: ITabNavigatorConfig<DemoTabRoutes>[] = [
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
        // @ts-expect-error
        translationId: 'Home',
      },
      {
        name: DemoHomeTabRoutes.DemoRootHomeSearch,
        component: DemoRootHomeSearch,
        // @ts-expect-error
        translationId: 'RootHomeSearch',
      },
      {
        name: DemoHomeTabRoutes.DemoRootHomeOptions,
        component: DemoRootHomeOptions,
        // @ts-expect-error
        translationId: 'RootHomeOptions',
      },
    ],
  },
  {
    name: DemoTabRoutes.Me,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'EmailSolid' : 'EmailOutline',
    translationId: 'msg__mine',
    freezeOnBlur: true,
    children: [
      {
        name: DemoMeTabRoutes.DemoRootMe,
        component: DemoRootMe,
        translationId: 'msg__mine',
      },
    ],
  },
  {
    name: DemoTabRoutes.Tabs,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'ChatGptSolid' : 'ChatGptOutline',
    translationId: 'title__str_tabs',
    freezeOnBlur: true,
    children: [
      {
        name: DemoTabsTabRoutes.DemoRootTabs,
        component: DemoRootTabs,
        translationId: 'title__str_tabs',
      },
    ],
  },
  {
    name: DemoTabRoutes.Developer,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CodeBracketsSolid' : 'CodeBracketsOutline',
    translationId: 'form__dev_mode',
    freezeOnBlur: true,
    children: [
      {
        name: DemoDeveloperTabRoutes.DemoRootDeveloper,
        component: DemoRootDeveloper,
        // @ts-expect-error
        translationId: 'Developer',
      },
      {
        name: DemoDeveloperTabRoutes.DemoRootDeveloperOptions,
        component: DemoRootDeveloperOptions,
        // @ts-expect-error
        translationId: 'RootDeveloperOptions',
      },
    ],
  },
];

function DemoTabNavigator() {
  return <TabStackNavigator<DemoTabRoutes> config={config} />;
}

export default DemoTabNavigator;
