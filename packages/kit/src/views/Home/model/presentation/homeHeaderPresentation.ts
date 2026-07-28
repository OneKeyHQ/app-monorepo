import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

export type IHomeHeaderAccountPresentation = {
  account?: INetworkAccount;
  accountName: string;
  compatibleNetworks: readonly IServerNetwork[];
  compatibleNetworksReady: boolean;
  compatibleNetworksWithoutAccountCount: number;
  copyDisabled: boolean;
  dbAccount?: IDBAccount;
  indexedAccount?: IDBIndexedAccount;
  isAccountSelectorSyncLoading: boolean;
  isAllNetworks: boolean;
  isOthersWallet: boolean;
  network?: IServerNetwork;
  ready: boolean;
  wallet?: IDBWallet;
};

export type IHomeHeaderPresentation = {
  account: IHomeHeaderAccountPresentation;
  accountPresentationRevision: number;
};

export function createInitialHomeHeaderPresentation(): IHomeHeaderPresentation {
  return {
    account: {
      accountName: '',
      compatibleNetworks: [],
      compatibleNetworksReady: false,
      compatibleNetworksWithoutAccountCount: 0,
      copyDisabled: false,
      isAccountSelectorSyncLoading: false,
      isAllNetworks: false,
      isOthersWallet: false,
      ready: false,
    },
    accountPresentationRevision: 0,
  };
}
