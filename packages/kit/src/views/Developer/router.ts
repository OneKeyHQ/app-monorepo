import { lazy } from 'react';

import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

import DevHomeStack1 from './pages/DevHomeStack1';
import DevHomeStack2 from './pages/DevHomeStack2';
import { galleryScreenList } from './pages/Gallery';
import TabDeveloper from './pages/TabDeveloper';
import { ETabDeveloperRoutes } from './type';

const DevHome = lazy(() => import('./pages/DevHome'));

export const developerRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabDeveloperRoutes.TabDeveloper,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    component: TabDeveloper,
    translationId: 'form__dev_mode',
    rewrite: '/',
  },
  ...galleryScreenList,
  {
    name: ETabDeveloperRoutes.DevHome,
    component: DevHome,
    translationId: 'wallet__wallet',
  },
  {
    name: ETabDeveloperRoutes.DevHomeStack1,
    component: DevHomeStack1,
    translationId: 'wallet__wallet',
  },
  {
    name: ETabDeveloperRoutes.DevHomeStack2,
    component: DevHomeStack2,
    translationId: 'wallet__wallet',
  },
];
