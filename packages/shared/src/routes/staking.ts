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
  //
  UniversalStake = 'UniversalStake',
  UniversalWithdraw = 'UniversalWithdraw',
  UniversalProtocolDetails = 'UniversalProtocolDetails',
  AssetProtocolList = 'AssetProtocolList',
  UniversalApproveBaseStake = 'UniversalApproveBaseStake',
}

type IBaseRouteParams = {
  networkId: string;
  accountId: string;
};

export type IModalStakingParamList = {
  [EModalStakingRoutes.EarnTokenDetail]: IBaseRouteParams;
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
    balance: string;
    price: string;
    token: IToken;
    rate?: string;
    symbol: string;
    provider: string;
    details: IStakeProtocolDetails;
  };
  [EModalStakingRoutes.AssetProtocolList]: IBaseRouteParams & {
    symbol: string;
  };
};
