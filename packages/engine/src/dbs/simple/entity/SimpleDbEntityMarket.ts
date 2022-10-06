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

  async saveFavoriteMarketTokens(coingeckoIds: string[]): Promise<void> {
    const data = await this.getRawDateWithDefault();
    const { favorites } = data;
    const newFavorites = [...new Set(favorites.concat(coingeckoIds))];
    data.favorites = newFavorites;
    await this.setRawData(data);
  }

  async getFavoriteMarketTokens(): Promise<string[]> {
    const data = await this.getRawDateWithDefault();
    return data.favorites;
  }

  async deleteFavoriteMarketToken(coingeckoId: string) {
    const data = await this.getRawDateWithDefault();
    const { favorites } = data;
    const newFavorites = favorites.filter((f) => f !== coingeckoId);
    data.favorites = newFavorites;
    await this.setRawData(data);
  }

  async unshiftFavoriteMarketToken(coingeckoId: string) {
    const data = await this.getRawDateWithDefault();
    const { favorites } = data;
    const newFavorites = favorites.filter((f) => f !== coingeckoId);
    newFavorites.unshift(coingeckoId);
    data.favorites = newFavorites;
    await this.setRawData(data);
  }
}
