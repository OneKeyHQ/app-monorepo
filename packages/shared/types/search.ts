import type { IServerNetwork } from '.';
import type { IAddressValidation } from './address';

export enum EUniversalSearchType {
  Address = 'Address',
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

export type IUniversalSearchBatchResult = {
  [EUniversalSearchType.Address]?: IUniversalSearchSingleResult;
};
