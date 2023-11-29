/* eslint-disable @typescript-eslint/no-unused-vars */

import type { ITabNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { TabStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import {
  EDemoDeveloperTabRoutes,
  EDemoHomeTabRoutes,
  EDemoMeTabRoutes,
  EDemoTabRoutes,
  EDemoTabsTabRoutes,
} from './Routes';
import DemoRootDeveloper from './View/DemoRootDeveloper';
import DemoRootDeveloperOptions from './View/DemoRootDeveloperOptions';
import DemoRootHome from './View/DemoRootHome';
import DemoRootHomeOptions from './View/DemoRootHomeOptions';
import DemoRootHomeSearch from './View/DemoRootHomeSearch';
import DemoRootMe from './View/DemoRootMe';
import DemoRootTabs from './View/DemoRootTabs';

const config: ITabNavigatorConfig<EDemoTabRoutes>[] = [
  {
    name: EDemoTabRoutes.Home,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CreditCardSolid' : 'CreditCardOutline',
    translationId: 'wallet__wallet',
    freezeOnBlur: true,
    children: [
      {
        name: EDemoHomeTabRoutes.DemoRootHome,
        component: DemoRootHome,
        // @ts-expect-error
        translationId: 'Home',
      },
      {
        name: EDemoHomeTabRoutes.DemoRootHomeSearch,
        component: DemoRootHomeSearch,
        // @ts-expect-error
        translationId: 'RootHomeSearch',
      },
      {
        name: EDemoHomeTabRoutes.DemoRootHomeOptions,
        component: DemoRootHomeOptions,
        // @ts-expect-error
        translationId: 'RootHomeOptions',
      },
    ],
  },
  {
    name: EDemoTabRoutes.Me,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'EmailSolid' : 'EmailOutline',
    translationId: 'msg__mine',
    freezeOnBlur: true,
    children: [
      {
        name: EDemoMeTabRoutes.DemoRootMe,
        component: DemoRootMe,
        translationId: 'msg__mine',
      },
    ],
  },
  {
    name: EDemoTabRoutes.Tabs,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'ChatGptSolid' : 'ChatGptOutline',
    translationId: 'title__str_tabs',
    freezeOnBlur: true,
    children: [
      {
        name: EDemoTabsTabRoutes.DemoRootTabs,
        component: DemoRootTabs,
        translationId: 'title__str_tabs',
      },
    ],
  },
  {
    name: EDemoTabRoutes.Developer,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CodeBracketsSolid' : 'CodeBracketsOutline',
    translationId: 'form__dev_mode',
    freezeOnBlur: true,
    children: [
      {
        name: EDemoDeveloperTabRoutes.DemoRootDeveloper,
        component: DemoRootDeveloper,
        // @ts-expect-error
        translationId: 'Developer',
      },
      {
        name: EDemoDeveloperTabRoutes.DemoRootDeveloperOptions,
        component: DemoRootDeveloperOptions,
        // @ts-expect-error
        translationId: 'RootDeveloperOptions',
      },
    ],
  },
];

function DemoTabNavigator() {
  return <TabStackNavigator<EDemoTabRoutes> config={config} />;
}

export default DemoTabNavigator;
