import { SimpleDbEntityBase } from './SimpleDbEntityBase';

import type { NFTListItems } from '../../../types/nft';

export type ISimpleDbEntityNFTData = Record<string, NFTListItems>;

class SimpleDbEntityNFT extends SimpleDbEntityBase<ISimpleDbEntityNFTData> {
  entityName = 'nft';

  override enableCache = false;

  async setNFTs(nfts: NFTListItems, key: string): Promise<void> {
    let savaData: ISimpleDbEntityNFTData = {};
    const rawData = await this.getRawData();
    if (rawData) {
      savaData = rawData;
    }
    savaData[key] = nfts;
    this.setRawData(savaData);
  }

  async getNFTs(key: string): Promise<NFTListItems> {
    const rawData = await this.getRawData();
    if (rawData) {
      return rawData[key] ?? [];
    }
    return [];
  }
}

export { SimpleDbEntityNFT };
