import { TabStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import type {
  ITabNavigatorConfig,
  ITabNavigatorExtraConfig,
} from '@onekeyhq/components/src/layouts/Navigation/Navigator/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HomePage } from '../../../views/Home';
import Swap from '../../../views/Swap';

import { galleryScreenList } from './Developer/Gallery';
import { ETabDeveloperRoutes } from './Developer/Routes';
import { ETabHomeRoutes } from './Home/Routes';
import { ETabMeRoutes } from './Me/Routes';
import TabMe from './Me/TabMe';
import { ETabRoutes } from './Routes';
import { ETabSwapRoutes } from './Swap/Routes';
import { EWebViewRoutes } from './WebView/Routes';

const config: ITabNavigatorConfig<ETabRoutes>[] = [
  {
    name: ETabRoutes.Home,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CreditCardSolid' : 'CreditCardOutline',
    translationId: 'wallet__wallet',
    freezeOnBlur: true,
    children: [
      {
        name: ETabHomeRoutes.TabHome,
        component: HomePage,
        translationId: 'wallet__wallet',
      },
    ],
  },
  {
    name: ETabRoutes.Swap,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CreditCardSolid' : 'CreditCardOutline',
    translationId: 'title__swap',
    freezeOnBlur: true,
    children: [
      {
        name: ETabSwapRoutes.TabSwap,
        component: Swap,
        translationId: 'title__swap',
      },
    ],
  },
  {
    name: ETabRoutes.Me,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'EmailSolid' : 'EmailOutline',
    translationId: 'title__me',
    freezeOnBlur: true,
    children: [
      {
        name: ETabMeRoutes.TabMe,
        component: TabMe,
        translationId: 'title__me',
      },
    ],
  },
  {
    name: ETabRoutes.Developer,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CodeBracketsSolid' : 'CodeBracketsOutline',
    translationId: 'form__dev_mode',
    freezeOnBlur: true,
    // disable: process.env.NODE_ENV === 'production',
    children: [
      {
        name: ETabDeveloperRoutes.TabDeveloper,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        component: require('./Developer/TabDeveloper').default,
        translationId: 'form__dev_mode',
      },
      ...galleryScreenList,
    ],
  },
];

const extraConfig: ITabNavigatorExtraConfig<ETabRoutes> | undefined =
  platformEnv.isDesktop
    ? {
        name: ETabRoutes.WebViewTab,
        children: [
          {
            name: EWebViewRoutes.WebView,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            component: require('./WebView/WebView').default,
            headerShown: false,
          },
        ],
      }
    : undefined;

export default function TabNavigator() {
  return (
    <TabStackNavigator<ETabRoutes> config={config} extraConfig={extraConfig} />
  );
}
