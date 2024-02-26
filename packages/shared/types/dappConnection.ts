import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';

import type { IInjectedProviderNamesStrings } from '@onekeyfe/cross-inpage-provider-types';

export type IConnectionAccountInfo = IAccountSelectorSelectedAccount & {
  networkImpl: string;
  accountId: string;
  address: string;
};
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

export type IConnectionItemWithAccountSelectorNum = IConnectionItem & {
  num: number;
};

export type IStorageType = 'injectedProvider' | 'walletConnect';

export interface IGetDAppAccountInfoParams {
  origin: string;
  scope?: IInjectedProviderNamesStrings;
  isWalletConnectRequest?: boolean;
  options?: {
    networkImpl?: string;
  };
}

export type IConnectionAccountInfoWithNum = IConnectionAccountInfo & {
  num: number;
  storageType: IStorageType;
};
