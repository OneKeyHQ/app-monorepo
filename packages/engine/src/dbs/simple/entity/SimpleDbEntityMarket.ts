import { MARKET_SEARCH_HISTORY_MAX } from '@onekeyhq/kit/src/store/reducers/market';
import { cloneDeep } from 'lodash';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISimpleSearchHistoryToken = {
  coingeckoId: string;
  iconUrl: string;
  symbol: string;
};

export type ISimpleDbEntityMarktData = {
  favorites: string[];
  searchHistory: ISimpleSearchHistoryToken[];
};

const dataDefault: ISimpleDbEntityMarktData = {
  favorites: [],
  searchHistory: [],
};

export class SimpleDbEntityMarket extends SimpleDbEntityBase<ISimpleDbEntityMarktData> {
  entityName = 'market';

  async getRawDateWithDefault() {
    return (await this.getRawData()) ?? cloneDeep(dataDefault);
  }

  async saveMarketSearchHistoryToken(token: ISimpleSearchHistoryToken) {
    const data = await this.getRawDateWithDefault();
    const searchHistory = data.searchHistory ? [...data.searchHistory] : [];
    const findIndex = searchHistory.findIndex(
      (t) => t.coingeckoId === token.coingeckoId,
    );
    if (findIndex !== -1) {
      searchHistory.splice(findIndex, 1);
    }
    if (searchHistory.length >= MARKET_SEARCH_HISTORY_MAX) {
      searchHistory.pop();
    }
    data.searchHistory = [token, ...searchHistory];
    this.setRawData(data);
  }

  async clearMarketSearchHistoryToken() {
    const data = await this.getRawDateWithDefault();
    data.searchHistory = [];
    this.setRawData(data);
  }

  async getMarketSearchHistoryToken(): Promise<ISimpleSearchHistoryToken[]> {
    const data = await this.getRawDateWithDefault();
    return data.searchHistory;
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
