import type { ILidoMaticRequest } from '../../types/staking';
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
}

type IBaseRouteParams = {
  networkId: string;
  accountId: string;
};

export type IModalStakingParamList = {
  [EModalStakingRoutes.EthLidoOverview]: IBaseRouteParams;
  [EModalStakingRoutes.EthLidoStake]: IBaseRouteParams & {
    price: string;
    balance: string;
    token: IToken;
    stToken: IToken;
    apr?: number;
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
};
