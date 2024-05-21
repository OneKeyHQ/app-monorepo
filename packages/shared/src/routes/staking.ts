import type { IToken } from '../../types/token';

export enum EModalStakingRoutes {
  EthLidoOverview = 'EthLidoOverview',
  EthLidoStake = 'EthLidoStake',
  EthLidoWithdraw = 'EthLidoWithdraw',
  MaticLidoOverview = 'MaticLidoOverview',
  MaticLidoStake = 'MaticLidoStake',
  MaticLidoWithdraw = 'MaticLidoWithdraw',
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
    apr?: number;
  };
  [EModalStakingRoutes.EthLidoWithdraw]: IBaseRouteParams & {
    balance: string;
    token: IToken;
  };
  [EModalStakingRoutes.MaticLidoOverview]: IBaseRouteParams;
  [EModalStakingRoutes.MaticLidoStake]: IBaseRouteParams & {
    price: string;
    balance: string;
    token: IToken;
    apr?: number;
  };
  [EModalStakingRoutes.MaticLidoWithdraw]: IBaseRouteParams & {
    balance: string;
    token: IToken;
  };
};
