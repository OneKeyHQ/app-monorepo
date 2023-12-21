import { lazy } from 'react';

import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

import { galleryScreenList } from './pages/Gallery';
import TabDeveloper from './pages/TabDeveloper';
import { ETabDeveloperRoutes } from './type';

const DevHome = lazy(() => import('./pages/DevHome'));
const DevHomeStack1 = lazy(() => import('./pages/DevHomeStack1'));
const DevHomeStack2 = lazy(() => import('./pages/DevHomeStack2'));

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
