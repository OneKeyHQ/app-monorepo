import { createElement } from 'react';

import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';
import { RootTabLoadingFallback } from '../RootTabLoadingFallback';

const EarnHome = LazyLoadRootTabPage(
  () => import('../../../views/Earn/EarnHome'),
  createElement(RootTabLoadingFallback, { tabRoute: ETabRoutes.Earn }),
);

const EarnProtocols = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnProtocols'),
);

const EarnTokens = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnTokens'),
);

const EarnFixedRateTokens = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnFixedRateTokens'),
);

const EarnAllProtocols = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnAllProtocols'),
);

const EarnProtocolTokens = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnProtocolTokens'),
);

const EarnProtocolDetails = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnProtocolDetails'),
);

const EarnLendingDetails = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnLendingDetails'),
);

const EarnLoanRouter = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnLoanRouter'),
);

const BorrowReserveDetails = LazyLoadRootTabPage(
  () => import('../../../views/Borrow/pages/ReserveDetails'),
);

// The desktop home has no Earn | Borrow switch, so Borrow and the positions
// page are pages of their own here, as they already are on native
const BorrowHome = LazyLoadRootTabPage(
  () => import('../../../views/Borrow/pages/BorrowHomePage'),
);

const EarnPositions = LazyLoadRootTabPage(
  () => import('../../../views/Earn/pages/EarnPositions'),
);

export const earnRouters: ITabSubNavigatorConfig<any, any>[] = [
  {
    rewrite: '/',
    name: ETabEarnRoutes.EarnHome,
    component: EarnHome,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.BorrowHome,
    component: BorrowHome,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnPositions,
    component: EarnPositions,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnProtocols,
    component: EarnProtocols,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnTokens,
    component: EarnTokens,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnFixedRateTokens,
    component: EarnFixedRateTokens,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnAllProtocols,
    component: EarnAllProtocols,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnProtocolTokens,
    component: EarnProtocolTokens,
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
    name: ETabEarnRoutes.EarnLendingDetails,
    component: EarnLendingDetails,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.EarnLoanRouter,
    component: EarnLoanRouter,
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
