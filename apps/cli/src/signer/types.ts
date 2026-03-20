import type { ICoreApiGetAddressItem } from '@onekeyhq/core/src/types';

export interface ISigner {
  getAddress(impl: string, networkId: string): Promise<ICoreApiGetAddressItem>;
}
