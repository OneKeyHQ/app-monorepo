import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { EMultiTabBrowserRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const MultiTabBrowser = LazyLoadPage(
  () => import('../../../views/Discovery/pages/Browser/Browser'),
);

export const multiTabBrowserRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: EMultiTabBrowserRoutes.MultiTabBrowser,
    component: MultiTabBrowser,
  },
];
