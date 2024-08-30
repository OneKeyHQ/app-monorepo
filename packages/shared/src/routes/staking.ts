import type {
  ILidoMaticRequest,
  IStakeProtocolDetails,
} from '../../types/staking';
import type { IToken } from '../../types/token';

export enum EModalStakingRoutes {
  EthLidoOverview = 'EthLidoOverview',
  EthLidoStake = 'EthLidoStake',
  EthLidoWithdraw = 'EthLidoWithdraw',
  EthLidoHistory = 'EthLidoHistory',
  MaticLidoOverview = 'MaticLidoOverview',
  MaticLidoStake = 'MaticLidoStake',
  MaticLidoWithdraw = 'MaticLidoWithdraw',
  MaticLidoHistory = 'MaticLidoHistory',
  MaticLidoClaim = 'MaticLidoClaim',
  EarnTokenDetail = 'EarnTokenDetail',
  InvestmentDetails = 'InvestmentDetails',
  //
  UniversalStake = 'UniversalStake',
  UniversalWithdraw = 'UniversalWithdraw',
  UniversalClaim = 'UniversalClaim',
  UniversalProtocolDetails = 'UniversalProtocolDetails',
  AssetProtocolList = 'AssetProtocolList',
  UniversalApproveBaseStake = 'UniversalApproveBaseStake',
  UniversalClaimOptions = 'UniversalClaimOptions',
  UniversalWithdrawOptions = 'UniversalWithdrawOptions',
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
  [EModalStakingRoutes.EthLidoOverview]: IBaseRouteParams;
  [EModalStakingRoutes.EthLidoStake]: IBaseRouteParams & {
    price: string;
    balance: string;
    token: IToken;
    stToken: IToken;
    apr?: number;
    minTransactionFee?: string;
  };
  [EModalStakingRoutes.EthLidoWithdraw]: IBaseRouteParams & {
    balance: string;
    price: string;
    token: IToken;
    receivingToken: IToken;
    rate?: string;
  };
  [EModalStakingRoutes.EthLidoHistory]: IBaseRouteParams;
  [EModalStakingRoutes.MaticLidoOverview]: IBaseRouteParams;
  [EModalStakingRoutes.MaticLidoStake]: IBaseRouteParams & {
    price: string;
    balance: string;
    token: IToken;
    stToken: IToken;
    currentAllowance: string;
    apr?: number;
    rate?: string;
  };
  [EModalStakingRoutes.MaticLidoWithdraw]: IBaseRouteParams & {
    balance: string;
    price: string;
    token: IToken;
    receivingToken: IToken;
    rate?: string;
  };
  [EModalStakingRoutes.MaticLidoHistory]: IBaseRouteParams;
  [EModalStakingRoutes.MaticLidoClaim]: IBaseRouteParams & {
    requests: ILidoMaticRequest[];
    token: IToken;
  };
  [EModalStakingRoutes.UniversalProtocolDetails]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details?: IStakeProtocolDetails;
  };
  [EModalStakingRoutes.UniversalStake]: IBaseRouteParams & {
    price: string;
    balance: string;
    token: IToken;
    apr?: number;
    minTransactionFee?: string;
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
  };
  [EModalStakingRoutes.UniversalApproveBaseStake]: IBaseRouteParams & {
    price: string;
    balance: string;
    token: IToken;
    apr?: number;
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
    // identity is nft id (lido matic nft)/ pubkey(solana)
    identity?: string;
    //
    amount?: string;
  };
  [EModalStakingRoutes.UniversalClaim]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
    // identity is nft id (lido matic nft)/ pubkey(solana)
    identity?: string;
    //
    amount?: string;
  };
  [EModalStakingRoutes.UniversalClaimOptions]: IBaseRouteParams & {
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
  };
  [EModalStakingRoutes.UniversalWithdrawOptions]: IBaseRouteParams & {
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
