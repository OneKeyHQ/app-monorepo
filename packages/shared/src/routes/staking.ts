import type { IStakeProtocolDetails } from '../../types/staking';
import type { IToken } from '../../types/token';

export enum EModalStakingRoutes {
  InvestmentDetails = 'InvestmentDetails',
  Stake = 'Stake',
  Withdraw = 'Withdraw',
  Claim = 'Claim',
  ProtocolDetails = 'ProtocolDetails',
  ProtocolDetailsV2 = 'ProtocolDetailsV2',
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

interface IClaimOptionsParams extends IBaseRouteParams {
  accountId: string;
  networkId: string;
  token: IToken;
  provider: {
    name: string;
    vault: string;
    logoURI: string;
  };
}
export type IModalStakingParamList = {
  [EModalStakingRoutes.InvestmentDetails]: undefined;
  [EModalStakingRoutes.ProtocolDetails]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details?: IStakeProtocolDetails;
    vault?: string;
  };
  [EModalStakingRoutes.ProtocolDetailsV2]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details?: IStakeProtocolDetails;
    vault?: string;
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
  [EModalStakingRoutes.Claim]: IBaseRouteParams &
    IClaimOptionsParams & {
      amount?: string;
      onSuccess?: () => void;
      identity?: string;
      claimableAmount?: string;
    };
  [EModalStakingRoutes.ClaimOptions]: IBaseRouteParams & IClaimOptionsParams;
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
    morphoVault?: string;
    filterType?: string;
  };
};
