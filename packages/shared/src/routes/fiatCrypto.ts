export enum EModalFiatCryptoRoutes {
  BuyModal = 'Buy',
  SellModal = 'Sell',
}

export type IModalFiatCryptoParamList = {
  [EModalFiatCryptoRoutes.BuyModal]: { networkId: string; accountId: string };
  [EModalFiatCryptoRoutes.SellModal]: {
    networkId: string;
    accountId: string;
  };
};
