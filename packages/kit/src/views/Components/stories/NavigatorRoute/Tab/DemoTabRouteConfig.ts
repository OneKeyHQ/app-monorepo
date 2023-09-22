import type { FC } from 'react';

import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { HeaderTitleProps } from '@onekeyhq/components/src/NavHeader/HeaderTitle';

import type { DemoTabChildRoutes, DemoTabRoutes } from '../Modal/types';

export interface DemoTabRouteConfigBase {
  name: DemoTabRoutes;
  translationId: LocaleIds;
  tabBarIcon: (props: { focused?: boolean }) => string;
  hideOnMobile?: boolean;
  hideOnProduction?: boolean;
  hideDesktopNavHeader?: boolean;
  hideMobileNavHeader?: boolean;
}

export interface DemoTabRouteConfig extends DemoTabRouteConfigBase {
  component: FC;
  children?: ({
    name: DemoTabChildRoutes;
    component: FC<any>;
    alwaysShowBackButton?: boolean;
  } & HeaderTitleProps)[];
}
