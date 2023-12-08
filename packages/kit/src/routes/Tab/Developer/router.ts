import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

import { galleryScreenList } from './Gallery';
import DevHome from './Gallery/DevHome';
import DevHomeStack1 from './Gallery/DevHomeStack1';
import DevHomeStack2 from './Gallery/DevHomeStack2';
import { ETabDeveloperRoutes } from './type';

export const developerRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabDeveloperRoutes.TabDeveloper,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    component: require('./TabDeveloper').default,
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
