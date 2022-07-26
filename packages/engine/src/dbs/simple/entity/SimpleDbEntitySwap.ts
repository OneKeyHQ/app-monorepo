import { SimpleDbEntityBase } from './SimpleDbEntityBase';

type Coin = {
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
  swftcCoins: Coin[];
};

export class SimpleDbEntitySwap extends SimpleDbEntityBase<ISimpleDbEntitySwapData> {
  entityName = 'swap';

  async setSwftcCoins(coins: Coin[]): Promise<void> {
    const rawData = await this.getRawData();
    this.setRawData({ ...rawData, swftcCoins: coins });
  }

  async getSwftcCoins(): Promise<Coin[] | undefined> {
    const rawData = await this.getRawData();
    return rawData?.swftcCoins;
  }
}
