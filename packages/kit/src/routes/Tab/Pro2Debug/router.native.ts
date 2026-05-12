import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadRootTabPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { ETabPro2DebugRoutes } from '@onekeyhq/shared/src/routes';

const TabPro2Debug = LazyLoadRootTabPage(
  () => import('../../../views/Pro2Debug/TabPro2Debug'),
);

export const pro2DebugRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabPro2DebugRoutes.TabPro2Debug,
    component: TabPro2Debug,
    headerShown: false,
  },
];
