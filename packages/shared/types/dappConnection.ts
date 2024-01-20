import type { IInjectedProviderNamesStrings } from '@onekeyfe/cross-inpage-provider-types';

type IConnectionProviderNames = IInjectedProviderNamesStrings | 'walletconnect';
interface IConnectionAccountInfo {
  type: IInjectedProviderNamesStrings;
  walletId: string;
  indexedAccountId: string;
  networkId: string;
  accountId: string;
}
type IInjectedProviderConnectionMap = {
  [K in IConnectionProviderNames]?: IConnectionAccountInfo;
};
export interface IConnectionItem {
  origin: string;
  imageURL: string;
  connectionMap: IInjectedProviderConnectionMap;
}
