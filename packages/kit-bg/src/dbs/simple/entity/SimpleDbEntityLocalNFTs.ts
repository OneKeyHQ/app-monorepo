import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface ILocalNFTs {
  data: Record<string, IAccountNFT>; // <networkId_collectionAddress_nftId, nft>
}

export class SimpleDbEntityLocalNFTs extends SimpleDbEntityBase<ILocalNFTs> {
  entityName = 'localNFTs';

  override enableCache = false;

  @backgroundMethod()
  async updateNFTs(nftMap: Record<string, IAccountNFT>) {
    const rawData = await this.getRawData();
    return this.setRawData({
      data: {
        ...rawData?.data,
        ...nftMap,
      },
    });
  }
}
