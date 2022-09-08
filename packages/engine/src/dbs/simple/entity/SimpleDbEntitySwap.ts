import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISwftcCoin = {
  coinAllCode: string;
  coinCode: string;
  coinImageUrl: string;
  coinName: string;
  contact: string;
  isSupportAdvanced: string;
  mainNetwork: string;
  noSupportCoin: string;
};

export type ISimpleDbEntitySwapData = {
  swftcCoins: ISwftcCoin[];
};

export class SimpleDbEntitySwap extends SimpleDbEntityBase<ISimpleDbEntitySwapData> {
  entityName = 'swap';

  async setSwftcCoins(coins: ISwftcCoin[]): Promise<void> {
    const rawData = await this.getRawData();
    this.setRawData({ ...rawData, swftcCoins: coins });
  }

  async getSwftcCoins(): Promise<ISwftcCoin[] | undefined> {
    const rawData = await this.getRawData();
    return rawData?.swftcCoins;
  }
}
