import type { IFiatCryptoToken } from '@onekeyhq/shared/types/fiatCrypto';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import type { IDeriveTypesAddressParams } from './walletAddress';

export enum EModalFiatCryptoRoutes {
  BuyModal = 'Buy',
  DeriveTypesAddress = 'DeriveTypesAddress',
  HeadlessBuy = 'HeadlessBuy',
  HeadlessBuyTokenSelector = 'HeadlessBuyTokenSelector',
  HeadlessBuySuccess = 'HeadlessBuySuccess',
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
  // Buy-only by design — sell always stays on the web widget, so the page
  // carries no `type` param.
  [EModalFiatCryptoRoutes.HeadlessBuy]: {
    networkId: string;
    accountId?: string;
    tokenAddress: string;
    // Full token object when navigating from the token list; direct-buy entry
    // points pass only tokenAddress and the page resolves the rest.
    token?: IFiatCryptoToken;
  };
  [EModalFiatCryptoRoutes.HeadlessBuyTokenSelector]: {
    networkId: string;
    accountId?: string;
    // Invoked with the picked token before the selector pops itself.
    // realAccountId may differ from accountId on merge-derive networks
    // (address-type selection happens inside the list rows).
    onSelected: (params: {
      token: IFiatCryptoToken;
      realAccountId?: string;
    }) => void;
  };
  // Display-only: the order is already submitted when this page mounts. It is
  // reached via CommonActions.reset (the spent buy flow is wiped from the
  // stack — the consumed native pay button must be unreachable via back).
  [EModalFiatCryptoRoutes.HeadlessBuySuccess]: {
    fiatAmount: number;
    tokenSymbol: string;
    networkId: string;
    networkName?: string;
    payout?: number;
    providerName?: string;
    address?: string;
    checkoutId?: string;
  };
};
