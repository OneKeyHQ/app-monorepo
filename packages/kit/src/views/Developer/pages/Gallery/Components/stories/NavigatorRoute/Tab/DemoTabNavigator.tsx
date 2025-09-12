/* eslint-disable @typescript-eslint/no-unused-vars */

import type { ITabNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { TabStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  EDemoDeveloperTabRoutes,
  EDemoHomeTabRoutes,
  EDemoTabRoutes,
} from './Routes';
import DemoRootDeveloper from './View/DemoRootDeveloper';
import DemoRootDeveloperOptions from './View/DemoRootDeveloperOptions';
import DemoRootHome from './View/DemoRootHome';
import DemoRootHomeOptions from './View/DemoRootHomeOptions';
import DemoRootHomeSearch from './View/DemoRootHomeSearch';

const config: ITabNavigatorConfig<EDemoTabRoutes>[] = [
  {
    name: EDemoTabRoutes.Home,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CreditCardSolid' : 'CreditCardOutline',
    translationId: ETranslations.global_wallet,
    freezeOnBlur: true,
    children: [
      {
        name: EDemoHomeTabRoutes.DemoRootHome,
        component: DemoRootHome,
        translationId: ETranslations.global_homescreen,
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
    name: EDemoTabRoutes.Developer,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CodeBracketsSolid' : 'CodeBracketsOutline',
    // @ts-expect-error
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
