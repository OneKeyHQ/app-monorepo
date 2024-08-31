import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';

const InvestmentDetails = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/InvestmentDetails'),
);

const ProtocolDetails = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/ProtocolDetails'),
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

const ApproveBaseStake = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/ApproveBaseStake'),
);

const ClaimOptions = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/ClaimOptions'),
);

const WithdrawOptions = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/WithdrawOptions'),
);

const PortfolioDetails = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/PortfolioDetails'),
);

const HistoryList = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/HistoryList'),
);

export const StakingModalRouter: IModalFlowNavigatorConfig<
  EModalStakingRoutes,
  IModalStakingParamList
>[] = [
  {
    name: EModalStakingRoutes.ProtocolDetails,
    component: ProtocolDetails,
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
    name: EModalStakingRoutes.ApproveBaseStake,
    component: ApproveBaseStake,
  },
  {
    name: EModalStakingRoutes.UniversalClaim,
    component: UniversalClaim,
  },
  {
    name: EModalStakingRoutes.ClaimOptions,
    component: ClaimOptions,
  },
  {
    name: EModalStakingRoutes.WithdrawOptions,
    component: WithdrawOptions,
  },
  {
    name: EModalStakingRoutes.InvestmentDetails,
    component: InvestmentDetails,
  },
  {
    name: EModalStakingRoutes.PortfolioDetails,
    component: PortfolioDetails,
  },
  {
    name: EModalStakingRoutes.HistoryList,
    component: HistoryList,
  },
];
