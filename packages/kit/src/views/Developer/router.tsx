import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import {
  LazyLoadPage,
  LazyLoadRootTabPage,
} from '@onekeyhq/kit/src/components/LazyLoadPage';
import { ETabDeveloperRoutes } from '@onekeyhq/shared/src/routes';

import { galleryScreenList } from './pages/Gallery';

const TabDeveloper = LazyLoadRootTabPage(() => import('./pages/TabDeveloper'));
const DevHome = LazyLoadPage(() => import('./pages/DevHome'));
const DevHomeStack1 = LazyLoadPage(() => import('./pages/DevHomeStack1'));
const DevHomeStack2 = LazyLoadPage(() => import('./pages/DevHomeStack2'));
const SignatureRecord = LazyLoadPage(() => import('./pages/SignatureRecord'));

export const developerRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: ETabDeveloperRoutes.TabDeveloper,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    component: TabDeveloper,
    rewrite: '/',
  },
  ...galleryScreenList,
  {
    name: ETabDeveloperRoutes.DevHome,
    component: DevHome,
  },
  {
    name: ETabDeveloperRoutes.DevHomeStack1,
    component: DevHomeStack1,
  },
  {
    name: ETabDeveloperRoutes.DevHomeStack2,
    component: DevHomeStack2,
  },
  {
    name: ETabDeveloperRoutes.SignatureRecord,
    component: SignatureRecord,
  },
];
