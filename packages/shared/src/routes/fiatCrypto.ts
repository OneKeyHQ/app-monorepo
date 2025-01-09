import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import type { IDeriveTypesAddressParams } from './walletAddress';

export enum EModalFiatCryptoRoutes {
  BuyModal = 'Buy',
  SellModal = 'Sell',
  DeriveTypesAddress = 'DeriveTypesAddress',
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
  [EModalFiatCryptoRoutes.DeriveTypesAddress]: IDeriveTypesAddressParams;
};
