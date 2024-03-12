import type { IAccountSelectorAvailableNetworksMap } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';

import type { IInjectedProviderNamesStrings } from '@onekeyfe/cross-inpage-provider-types';
import type { SessionTypes } from '@walletconnect/types';

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
  walletConnectTopic?: string;
}

export type IConnectionItemWithAccountSelectorNum = IConnectionItem & {
  num: number;
};

export type IConnectionItemWithStorageType = IConnectionItem & {
  storageType: IConnectionStorageType;
  availableNetworksMap?: IAccountSelectorAvailableNetworksMap;
};

export type IConnectionStorageType = 'injectedProvider' | 'walletConnect';

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
  storageType: IConnectionStorageType;
  availableNetworkIds?: string[];
};

export type IWalletConnectSessionProposalResult = {
  accountsInfo: IConnectionAccountInfo[];
  supportedNamespaces: Record<string, SessionTypes.BaseNamespace>;
  storageType: IConnectionStorageType;
};
