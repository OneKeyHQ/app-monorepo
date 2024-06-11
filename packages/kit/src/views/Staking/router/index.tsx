import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';

const EthLidoOverview = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/EthLidoOverview'),
);

const EthLidoStake = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/EthLidoStake'),
);

const EthLidoWithdraw = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/EthLidoWithdraw'),
);

const EthLidoHistory = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/EthLidoHistory'),
);

const MaticLidoOverview = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/MaticLidoOverview'),
);

const MaticLidoStake = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/MaticLidoStake'),
);

const MaticLidoWithdraw = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/MaticLidoWithdraw'),
);

const MaticLidoHistory = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/MaticLidoHistory'),
);

const MaticLidoClaim = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/MaticLidoClaim'),
);

export const StakingModalRouter: IModalFlowNavigatorConfig<
  EModalStakingRoutes,
  IModalStakingParamList
>[] = [
  {
    name: EModalStakingRoutes.EthLidoOverview,
    component: EthLidoOverview,
  },
  {
    name: EModalStakingRoutes.EthLidoStake,
    component: EthLidoStake,
  },
  {
    name: EModalStakingRoutes.EthLidoWithdraw,
    component: EthLidoWithdraw,
  },
  {
    name: EModalStakingRoutes.EthLidoHistory,
    component: EthLidoHistory,
  },
  {
    name: EModalStakingRoutes.MaticLidoOverview,
    component: MaticLidoOverview,
  },
  {
    name: EModalStakingRoutes.MaticLidoStake,
    component: MaticLidoStake,
  },
  {
    name: EModalStakingRoutes.MaticLidoWithdraw,
    component: MaticLidoWithdraw,
  },
  {
    name: EModalStakingRoutes.MaticLidoHistory,
    component: MaticLidoHistory,
  },
  {
    name: EModalStakingRoutes.MaticLidoClaim,
    component: MaticLidoClaim,
  },
];
