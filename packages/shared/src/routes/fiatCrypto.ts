import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

export enum EModalFiatCryptoRoutes {
  BuyModal = 'Buy',
  SellModal = 'Sell',
}

export type IModalFiatCryptoParamList = {
  [EModalFiatCryptoRoutes.BuyModal]: {
    networkId: string;
    accountId?: string;
    tokens?: IAccountToken[];
    map?: Record<string, ITokenFiat>;
  };
  [EModalFiatCryptoRoutes.SellModal]: {
    networkId: string;
    accountId?: string;
    tokens?: IAccountToken[];
    map?: Record<string, ITokenFiat>;
  };
};
