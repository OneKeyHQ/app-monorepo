export enum EModalWalletAddressRoutes {
  DeriveTypesAddress = 'DeriveTypesAddress',
  WalletAddress = 'WalletAddress',
}

export type IModalWalletAddressParamList = {
  [EModalWalletAddressRoutes.DeriveTypesAddress]: {
    networkId: string;
    accountId: string;
  };
  [EModalWalletAddressRoutes.WalletAddress]: {
    accountId: string;
    indexedAccountId: string;
  };
};
