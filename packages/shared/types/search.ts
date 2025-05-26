import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { IServerNetwork } from '.';
import type { INetworkAccount } from './account';
import type { IAddressValidation } from './address';
import type { IDApp } from './discovery';
import type { IMarketToken } from './market';
import type { IAccountToken, ITokenFiat } from './token';

export enum EUniversalSearchType {
  Address = 'Address',
  MarketToken = 'MarketToken',
  AccountAssets = 'AccountAssets',
  Dapp = 'Dapp',
}

export enum ESearchStatus {
  init = 'init',
  loading = 'loading',
  done = 'done',
}

export type IUniversalSearchAccountInfo = {
  accountId: string;
  formattedName: string;
  accountName?: string;
};

export type IUniversalSearchAddress = {
  type: EUniversalSearchType.Address;
  payload: {
    wallet: IDBWallet | undefined;
    account?: INetworkAccount;
    indexedAccount?: IDBIndexedAccount;
    network?: IServerNetwork;
    addressInfo?: IAddressValidation;
    accountInfo?: IUniversalSearchAccountInfo;
    accountsValue?: {
      accountId: string;
      value: Record<string, string> | string | undefined;
      currency: string | undefined;
    };
    isSearchedByAccountName?: boolean;
  };
};

export type IUniversalSearchSingleResult = {
  items: IUniversalSearchAddress[];
};

export type IUniversalSearchMarketToken = {
  type: EUniversalSearchType.MarketToken;
  payload: IMarketToken;
};

export type IUniversalSearchAccountAssets = {
  type: EUniversalSearchType.AccountAssets;
  payload: {
    token: IAccountToken;
    tokenFiat: ITokenFiat;
  };
};

export type IUniversalSearchDapp = {
  type: EUniversalSearchType.Dapp;
  payload: IDApp;
};

export type IUniversalSearchResultItem =
  | IUniversalSearchAddress
  | IUniversalSearchMarketToken
  | IUniversalSearchAccountAssets
  | IUniversalSearchDapp;

export type IUniversalSearchMarketTokenResult = {
  items: IUniversalSearchMarketToken[];
};

export type IUniversalSearchAccountAssetsResult = {
  items: IUniversalSearchAccountAssets[];
};

export type IUniversalSearchDappResult = {
  items: IUniversalSearchDapp[];
};

export type IUniversalSearchBatchResult = {
  [EUniversalSearchType.Address]?: IUniversalSearchSingleResult;
  [EUniversalSearchType.MarketToken]?: IUniversalSearchMarketTokenResult;
  [EUniversalSearchType.AccountAssets]?: IUniversalSearchAccountAssetsResult;
  [EUniversalSearchType.Dapp]?: IUniversalSearchDappResult;
};

export interface IIUniversalRecentSearchItem {
  id: string;
  text: string;
  timestamp: number;
  type: EUniversalSearchType;
  extra?: Record<string, string | boolean>;
}

export type IUniversalSearchAtomData = {
  recentSearch: IIUniversalRecentSearchItem[];
};
