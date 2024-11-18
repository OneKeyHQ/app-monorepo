import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';

import { ModalAssetDetailsStack } from '../../AssetDetails/router';

const InvestmentDetails = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/InvestmentDetails'),
);

const ProtocolDetails = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/ProtocolDetails'),
);

const Withdraw = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/Withdraw'),
);

const Stake = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/Stake'),
);

const Claim = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Staking/pages/Claim'),
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
  EModalStakingRoutes | EModalAssetDetailRoutes,
  IModalStakingParamList & IModalAssetDetailsParamList
>[] = [
  {
    name: EModalStakingRoutes.ProtocolDetails,
    component: ProtocolDetails,
    exact: true,
    rewrite: '/earn/staking/:symbol/:provider',
  },
  {
    name: EModalStakingRoutes.Stake,
    component: Stake,
  },
  {
    name: EModalStakingRoutes.Withdraw,
    component: Withdraw,
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
    name: EModalStakingRoutes.Claim,
    component: Claim,
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
  ...(ModalAssetDetailsStack as IModalFlowNavigatorConfig<
    EModalStakingRoutes | EModalAssetDetailRoutes,
    IModalStakingParamList & IModalAssetDetailsParamList
  >[]),
];
