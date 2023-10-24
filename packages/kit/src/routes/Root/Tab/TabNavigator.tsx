import type { TabNavigatorConfig } from '@onekeyhq/components/src/Navigation/Navigator';
import { TabStackNavigator } from '@onekeyhq/components/src/Navigation/Navigator';

import Swap from '../../../views/Swap';
import HomePage from '../../../views/Tab/Home/HomePageTabs';

import { TabDeveloperRoutes } from './Developer/Routes';
import { TabHomeRoutes } from './Home/Routes';
import TabHomeStack1 from './Home/TabHomeStack1';
import TabHomeStack2 from './Home/TabHomeStack2';
import { TabMeRoutes } from './Me/Routes';
import TabMe from './Me/TabMe';
import { TabRoutes } from './Routes';
import { TabSwapRoutes } from './Swap/Routes';

const config: TabNavigatorConfig<TabRoutes>[] = [
  {
    name: TabRoutes.Home,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CreditCardSolid' : 'CreditCardOutline',
    translationId: 'wallet__wallet',
    freezeOnBlur: true,
    children: [
      {
        name: TabHomeRoutes.TabHome,
        component: HomePage,
        translationId: 'wallet__wallet',
      },
      {
        name: TabHomeRoutes.TabHomeStack1,
        component: TabHomeStack1,
        translationId: 'wallet__wallet',
      },
      {
        name: TabHomeRoutes.TabHomeStack2,
        component: TabHomeStack2,
        translationId: 'wallet__wallet',
      },
    ],
  },
  {
    name: TabRoutes.Swap,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CreditCardSolid' : 'CreditCardOutline',
    translationId: 'title__swap',
    freezeOnBlur: true,
    children: [
      {
        name: TabSwapRoutes.TabSwap,
        component: Swap,
        translationId: 'title__swap',
      },
    ],
  },
  {
    name: TabRoutes.Me,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'EmailSolid' : 'EmailOutline',
    translationId: 'title__me',
    freezeOnBlur: true,
    children: [
      {
        name: TabMeRoutes.TabMe,
        component: TabMe,
        translationId: 'title__me',
      },
    ],
  },
  {
    name: TabRoutes.Developer,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CodeBracketsSolid' : 'CodeBracketsOutline',
    translationId: 'form__dev_mode',
    freezeOnBlur: true,
    // disable: process.env.NODE_ENV === 'production',
    children: [
      {
        name: TabDeveloperRoutes.TabDeveloper,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        component: require('./Developer/TabDeveloper').default,
        translationId: 'form__dev_mode',
      },
    ],
  },
];

export default function TabNavigator() {
  return <TabStackNavigator<TabRoutes> config={config} />;
}
