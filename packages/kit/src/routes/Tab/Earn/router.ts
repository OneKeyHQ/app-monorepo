import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabEarnRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const EarnHome = LazyLoadRootTabPage(
  () => import(/* webpackPrefetch: true */ '../../../views/Earn/EarnHome'),
);

const EarnProtocols = LazyLoadRootTabPage(
  () =>
    import(
      /* webpackPrefetch: true */ '../../../views/Earn/pages/EarnProtocols'
    ),
);

const EarnProtocolDetails = LazyLoadRootTabPage(
  () =>
    import(
      /* webpackPrefetch: true */ '../../../views/Earn/pages/EarnProtocolDetails'
    ),
);

const BorrowReserveDetails = LazyLoadRootTabPage(
  () =>
    import(
      /* webpackPrefetch: true */ '../../../views/Borrow/pages/ReserveDetails'
    ),
);

export const earnRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabEarnRoutes.EarnHome,
    component: EarnHome,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnProtocols,
    component: EarnProtocols,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnProtocolDetails,
    component: EarnProtocolDetails,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnProtocolDetailsShare,
    component: EarnProtocolDetails,
    exact: true,
    rewrite: '/earn/:network/:symbol/:provider',
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.BorrowReserveDetails,
    component: BorrowReserveDetails,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.BorrowReserveDetailsShare,
    component: BorrowReserveDetails,
    exact: true,
    rewrite: '/borrow/:networkId/:symbol/:provider',
    headerShown: !platformEnv.isNative,
  },
];
