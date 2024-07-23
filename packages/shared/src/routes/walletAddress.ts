export enum EModalWalletAddressRoutes {
  DeriveTypesAddress = 'DeriveTypesAddress',
  WalletAddress = 'WalletAddress',
}

type IBaseRouteParams = {
  networkId: string;
  accountId: string;
};

export type IModalWalletAddressParamList = {
  [EModalWalletAddressRoutes.DeriveTypesAddress]: IBaseRouteParams;
  [EModalWalletAddressRoutes.WalletAddress]: IBaseRouteParams;
};
