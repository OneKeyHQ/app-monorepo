import type {
  IEarnTokenInfo,
  IProtocolInfo,
  IStakeProtocolDetails,
} from '../../types/staking';

export enum EModalStakingRoutes {
  InvestmentDetails = 'InvestmentDetails',
  Stake = 'Stake',
  Withdraw = 'Withdraw',
  Claim = 'Claim',
  ProtocolDetails = 'ProtocolDetails',
  ProtocolDetailsV2 = 'ProtocolDetailsV2',
  AssetProtocolList = 'AssetProtocolList',
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

interface IDetailPageInfoParams extends IBaseRouteParams {
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
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
  [EModalStakingRoutes.Stake]: IDetailPageInfoParams & {
    currentAllowance: string;
    onSuccess?: () => void;
  };
  [EModalStakingRoutes.Withdraw]: IDetailPageInfoParams & {
    rate?: string;
    identity?: string;
    amount?: string;
    fromPage?: EModalStakingRoutes.WithdrawOptions;
    onSuccess?: () => void;
  };
  [EModalStakingRoutes.Claim]: IDetailPageInfoParams &
    IDetailPageInfoParams & {
      amount?: string;
      onSuccess?: () => void;
      identity?: string;
      claimableAmount?: string;
    };
  [EModalStakingRoutes.ClaimOptions]: IDetailPageInfoParams;
  [EModalStakingRoutes.WithdrawOptions]: IDetailPageInfoParams;
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
