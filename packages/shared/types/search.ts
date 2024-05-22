import type { IServerNetwork } from '.';
import type { IAddressValidation } from './address';
import type { IMarketToken } from './market';

export enum EUniversalSearchType {
  Address = 'Address',
  MarketToken = 'MarketToken',
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

export type IUniversalSearchResultItem =
  | IUniversalSearchAddress
  | IUniversalSearchMarketToken;

export type IUniversalSearchMarketTokenResult = {
  items: IUniversalSearchMarketToken[];
};

export type IUniversalSearchBatchResult = {
  [EUniversalSearchType.Address]?: IUniversalSearchSingleResult;
  [EUniversalSearchType.MarketToken]?: IUniversalSearchMarketTokenResult;
};
