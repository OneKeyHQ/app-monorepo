import type { IInjectedProviderNamesStrings } from '@onekeyfe/cross-inpage-provider-types';

export type IConnectionProviderNames =
  | IInjectedProviderNamesStrings
  | 'walletconnect';
export interface IConnectionAccountInfo {
  networkImpl: string;
  walletId: string;
  indexedAccountId: string;
  networkId: string;
  accountId: string;
  address: string;
}
export interface IConnectionItem {
  origin: string;
  imageURL: string;
  // accountSelectorNumber -> accountInfo
  connectionMap: {
    [accountSelectorNumber in number]: IConnectionAccountInfo;
  };
  // networkImpl -> connectionMap keys
  networkImplMap: {
    [networkImpl in string]: number[];
  };
  // address -> connectionMap keys
  addressMap: {
    [address in string]: number[];
  };
}

export type IStorageType = 'injectedProvider' | 'walletConnect';

export interface IGetDAppAccountInfoParams {
  origin: string;
  scope: IConnectionProviderNames;
  options?: {
    networkImpl?: string;
  };
}
