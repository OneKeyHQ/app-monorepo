import { SimpleDbEntityBase } from './SimpleDbEntityBase';

import type { Collection } from '../../../types/nft';

export type ISimpleDbEntityNFTData = Record<string, Collection[]>;

class SimpleDbEntityNFT extends SimpleDbEntityBase<ISimpleDbEntityNFTData> {
  entityName = 'nft';

  override enableCache = false;

  async setNFTs(collections: Collection[], key: string): Promise<void> {
    let savaData: ISimpleDbEntityNFTData = {};
    const rawData = await this.getRawData();
    if (rawData) {
      savaData = rawData;
    }
    savaData[key] = collections;
    this.setRawData(savaData);
  }

  async getNFTs(key: string): Promise<Collection[]> {
    const rawData = await this.getRawData();
    if (rawData) {
      return rawData[key] ?? [];
    }
    return [];
  }
}

export { SimpleDbEntityNFT };
