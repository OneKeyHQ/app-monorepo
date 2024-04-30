import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { EMultiTabBrowserRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const MultiTabBrowser = LazyLoadRootTabPage(
  () => import('../../../views/Discovery/pages/Browser/Browser'),
);

export const multiTabBrowserRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: EMultiTabBrowserRoutes.MultiTabBrowser,
    component: MultiTabBrowser,
  },
];
