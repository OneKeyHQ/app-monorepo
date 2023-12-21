import { Suspense, lazy } from 'react';

import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

import { galleryScreenList } from './pages/Gallery';
import TabDeveloper from './pages/TabDeveloper';
import { ETabDeveloperRoutes } from './type';

// eslint-disable-next-line react/display-name
const makeSuspense = (Component: any) => (props: any) =>
  (
    <Suspense>
      <Component {...props} />
    </Suspense>
  );

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
    component: makeSuspense(DevHome),
    translationId: 'wallet__wallet',
  },
  {
    name: ETabDeveloperRoutes.DevHomeStack1,
    component: makeSuspense(DevHomeStack1),
    translationId: 'wallet__wallet',
  },
  {
    name: ETabDeveloperRoutes.DevHomeStack2,
    component: makeSuspense(DevHomeStack2),
    translationId: 'wallet__wallet',
  },
];
