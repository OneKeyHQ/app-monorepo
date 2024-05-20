import type { IServerNetwork } from '.';
import type { IAddressValidation } from './address';
import type { IMarketToken } from './market';

export enum EUniversalSearchType {
  Address = 'Address',
  MarketToken = 'MarketToken',
}
export type IUniversalSearchResultItem = {
  type: EUniversalSearchType.Address;
  payload: {
    addressInfo: IAddressValidation;
    network: IServerNetwork;
  };
};
export type IUniversalSearchSingleResult = {
  items: IUniversalSearchResultItem[];
};

export type IUniversalSearchMarketToken = IMarketToken;

export type IUniversalSearchMarketTokenResult = {
  items: IUniversalSearchMarketToken[];
};

export type IUniversalSearchBatchResult = {
  [EUniversalSearchType.Address]?: IUniversalSearchSingleResult;
  [EUniversalSearchType.MarketToken]?: IUniversalSearchMarketTokenResult;
};
