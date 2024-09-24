import type { IStakeProtocolDetails } from '../../types/staking';

export enum EModalStakingRoutes {
  InvestmentDetails = 'InvestmentDetails',
  Stake = 'Stake',
  Withdraw = 'Withdraw',
  Claim = 'Claim',
  ProtocolDetails = 'ProtocolDetails',
  AssetProtocolList = 'AssetProtocolList',
  ApproveBaseStake = 'ApproveBaseStake',
  ClaimOptions = 'ClaimOptions',
  WithdrawOptions = 'WithdrawOptions',
  PortfolioDetails = 'PortfolioDetails',
  HistoryList = 'HistoryList',
}

type IBaseRouteParams = {
  networkId: string;
  accountId: string;
  indexedAccountId?: string;
};

export type IModalStakingParamList = {
  [EModalStakingRoutes.InvestmentDetails]: undefined;
  [EModalStakingRoutes.ProtocolDetails]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details?: IStakeProtocolDetails;
  };
  [EModalStakingRoutes.Stake]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
    onSuccess?: () => void;
  };
  [EModalStakingRoutes.ApproveBaseStake]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
    currentAllowance: string;
    onSuccess?: () => void;
  };
  [EModalStakingRoutes.Withdraw]: IBaseRouteParams & {
    rate?: string;
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
    identity?: string;
    amount?: string;
    onSuccess?: () => void;
  };
  [EModalStakingRoutes.Claim]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
    identity?: string;
    amount?: string;
    onSuccess?: () => void;
  };
  [EModalStakingRoutes.ClaimOptions]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
  };
  [EModalStakingRoutes.WithdrawOptions]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
  };
  [EModalStakingRoutes.AssetProtocolList]: IBaseRouteParams & {
    symbol: string;
    filter?: boolean;
  };
  [EModalStakingRoutes.PortfolioDetails]: IBaseRouteParams & {
    symbol: string;
    provider: string;
  };
  [EModalStakingRoutes.HistoryList]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    stakeTag?: string;
  };
};
