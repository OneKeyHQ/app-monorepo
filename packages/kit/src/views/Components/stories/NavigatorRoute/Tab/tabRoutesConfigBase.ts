import { DemoTabRoutes } from '../Modal/types';

import type { DemoTabRouteConfigBase } from './DemoTabRouteConfig';

export const tabRoutesConfigBaseMap: Record<
  DemoTabRoutes,
  DemoTabRouteConfigBase
> = {
  [DemoTabRoutes.Home]: {
    name: DemoTabRoutes.Home,
    tabBarIcon: (focused) =>
      focused ? 'CreditCardSolid' : 'CreditCardOutline',
    translationId: 'wallet__wallet',
    navHeaderType: 'AccountSelector',
  },
  [DemoTabRoutes.Developer]: {
    name: DemoTabRoutes.Developer,
    tabBarIcon: (focused) =>
      focused ? 'CodeBracketSquareMini' : 'CodeBracketMini',
    translationId: 'form__dev_mode',
    // FIXME: Production version should be true
    hideOnProduction: false,
  },
};
