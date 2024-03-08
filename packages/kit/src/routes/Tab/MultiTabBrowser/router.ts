import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

import { EMultiTabBrowserRoutes } from './type';

const MultiTabBrowser = LazyLoadPage(
  () => import('../../../views/Discovery/pages/Browser/Browser'),
);

export const multiTabBrowserRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: EMultiTabBrowserRoutes.MultiTabBrowser,
    component: MultiTabBrowser,
  },
];
