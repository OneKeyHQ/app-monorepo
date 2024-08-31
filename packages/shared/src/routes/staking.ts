import type { IStakeProtocolDetails } from '../../types/staking';

export enum EModalStakingRoutes {
  InvestmentDetails = 'InvestmentDetails',
  UniversalStake = 'UniversalStake',
  UniversalWithdraw = 'UniversalWithdraw',
  UniversalClaim = 'UniversalClaim',
  ProtocolDetails = 'UniversalProtocolDetails',
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
  [EModalStakingRoutes.UniversalStake]: IBaseRouteParams & {
    minTransactionFee?: string;
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
  };
  [EModalStakingRoutes.ApproveBaseStake]: IBaseRouteParams & {
    minTransactionFee?: string;
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
    currentAllowance: string;
  };
  [EModalStakingRoutes.UniversalWithdraw]: IBaseRouteParams & {
    rate?: string;
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
    identity?: string; // identity is nft id (lido matic nft)/ pubkey(solana)
    amount?: string;
  };
  [EModalStakingRoutes.UniversalClaim]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
    identity?: string; // identity is nft id (lido matic nft)/ pubkey(solana)
    amount?: string;
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
  };
  [EModalStakingRoutes.PortfolioDetails]: IBaseRouteParams & {
    symbol: string;
    provider: string;
  };
  [EModalStakingRoutes.HistoryList]: IBaseRouteParams & {
    symbol: string;
    provider: string;
  };
};
