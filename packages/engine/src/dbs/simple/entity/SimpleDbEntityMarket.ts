import { cloneDeep } from 'lodash';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISimpleDbEntityMarktData = {
  favorites: string[];
};

const dataDefault: ISimpleDbEntityMarktData = {
  favorites: [],
};

export class SimpleDbEntityMarket extends SimpleDbEntityBase<ISimpleDbEntityMarktData> {
  entityName = 'market';

  async getRawDateWithDefault() {
    return (await this.getRawData()) ?? cloneDeep(dataDefault);
  }

  async saveFavoriteCoin(coingeckoId: string): Promise<void> {
    const data = await this.getRawDateWithDefault();
    const { favorites } = data;
    if (!favorites.includes(coingeckoId)) {
      favorites.push(coingeckoId);
      await this.setRawData(data);
    }
  }

  async getFavoriteCoins(): Promise<string[]> {
    const data = await this.getRawDateWithDefault();
    return data.favorites;
  }

  async deleteFavoriteCoin(coingeckoId: string) {
    const data = await this.getRawDateWithDefault();
    const { favorites } = data;
    const newFavorites = favorites.filter((f) => f !== coingeckoId);
    data.favorites = newFavorites;
    await this.setRawData(data);
  }
}
