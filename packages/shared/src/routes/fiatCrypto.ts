import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import type { IDeriveTypesAddressParams } from './walletAddress';

export enum EModalFiatCryptoRoutes {
  BuyModal = 'Buy',
  DeriveTypesAddress = 'DeriveTypesAddress',
}

export type IModalFiatCryptoParamList = {
  [EModalFiatCryptoRoutes.BuyModal]: {
    networkId: string;
    accountId?: string;
    tokens?: IAccountToken[];
    map?: Record<string, ITokenFiat>;
    defaultTab?: 'buy' | 'sell';
  };
  [EModalFiatCryptoRoutes.DeriveTypesAddress]: IDeriveTypesAddressParams;
};
