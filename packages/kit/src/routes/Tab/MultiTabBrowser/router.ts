import type { ITabSubNavigatorConfig } from '@onekeyhq/components';

import { EMultiTabBrowserRoutes } from './type';

export const multiTabBrowserRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    name: EMultiTabBrowserRoutes.MultiTabBrowser,
    component:
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      require('../../../views/Discovery/container/Browser/Browser').default,
  },
];
