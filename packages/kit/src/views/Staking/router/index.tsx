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

const InvestmentDetails = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/InvestmentDetails'),
);

const UniversalProtocolDetails = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/Staking/pages/UniversalProtocolDetails'),
);

const UniversalWithdraw = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/UniversalWithdraw'),
);

const UniversalStake = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/UniversalStake'),
);

const UniversalClaim = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/UniversalClaim'),
);

const AssetProtocolList = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/AssetProtocolList'),
);

const UniversalApproveBaseStake = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/Staking/pages/UniversalApproveBaseStake'),
);

const UniversalClaimOptions = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/UniversalClaimOptions'),
);

const UniversalWithdrawOptions = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/Staking/pages/UniversalWithdrawOptions'),
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
  {
    name: EModalStakingRoutes.UniversalProtocolDetails,
    component: UniversalProtocolDetails,
  },
  {
    name: EModalStakingRoutes.UniversalStake,
    component: UniversalStake,
  },
  {
    name: EModalStakingRoutes.UniversalWithdraw,
    component: UniversalWithdraw,
  },
  {
    name: EModalStakingRoutes.AssetProtocolList,
    component: AssetProtocolList,
  },
  {
    name: EModalStakingRoutes.UniversalApproveBaseStake,
    component: UniversalApproveBaseStake,
  },
  {
    name: EModalStakingRoutes.UniversalClaim,
    component: UniversalClaim,
  },
  {
    name: EModalStakingRoutes.UniversalClaimOptions,
    component: UniversalClaimOptions,
  },
  {
    name: EModalStakingRoutes.UniversalWithdrawOptions,
    component: UniversalWithdrawOptions,
  },
  {
    name: EModalStakingRoutes.InvestmentDetails,
    component: InvestmentDetails,
  },
];
