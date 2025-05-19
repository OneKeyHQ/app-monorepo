import type { IServerNetwork } from '.';
import type { IAddressValidation } from './address';
import type { IMarketToken } from './market';
import type { IAccountToken, ITokenFiat } from './token';

export enum EUniversalSearchType {
  Address = 'Address',
  MarketToken = 'MarketToken',
  AccountAssets = 'AccountAssets',
}
export type IUniversalSearchAddress = {
  type: EUniversalSearchType.Address;
  payload: {
    addressInfo: IAddressValidation;
    network: IServerNetwork;
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

export type IUniversalSearchResultItem =
  | IUniversalSearchAddress
  | IUniversalSearchMarketToken
  | IUniversalSearchAccountAssets;

export type IUniversalSearchMarketTokenResult = {
  items: IUniversalSearchMarketToken[];
};

export type IUniversalSearchAccountAssetsResult = {
  items: IUniversalSearchAccountAssets[];
};

export type IUniversalSearchBatchResult = {
  [EUniversalSearchType.Address]?: IUniversalSearchSingleResult;
  [EUniversalSearchType.MarketToken]?: IUniversalSearchMarketTokenResult;
  [EUniversalSearchType.AccountAssets]?: IUniversalSearchAccountAssetsResult;
};

export interface IIUniversalRecentSearchItem {
  id: string;
  text: string;
  timestamp: number;
  type: EUniversalSearchType;
  extra?: Record<string, string>;
}

export type IUniversalSearchAtomData = {
  recentSearch: IIUniversalRecentSearchItem[];
};
