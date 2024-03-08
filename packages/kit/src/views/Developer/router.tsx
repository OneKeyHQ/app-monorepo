import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';

import { galleryScreenList } from './pages/Gallery';
import { ETabDeveloperRoutes } from './type';

const TabDeveloper = LazyLoadPage(() => import('./pages/TabDeveloper'));
const DevHome = LazyLoadPage(() => import('./pages/DevHome'));
const DevHomeStack1 = LazyLoadPage(() => import('./pages/DevHomeStack1'));
const DevHomeStack2 = LazyLoadPage(() => import('./pages/DevHomeStack2'));

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
