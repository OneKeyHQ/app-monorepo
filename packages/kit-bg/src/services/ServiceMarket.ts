import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IMarketCategory,
  IMarketDetailPool,
  IMarketToken,
  IMarketTokenChart,
  IMarketTokenDetail,
  IMarketWatchListItem,
} from '@onekeyhq/shared/types/market';

// import { marketWatchListPersistAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

const ONEKEY_SEARCH_TRANDING = 'onekey-search-trending';

@backgroundClass()
class ServiceMarket extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async fetchCategories(filters = [ONEKEY_SEARCH_TRANDING]) {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: IMarketCategory[];
    }>('/utility/v1/market/category/list');
    const { code, data } = response.data;
    data[0].name = 'Watchlist';
    return filters.length
      ? data.filter((i) => !filters.includes(i.categoryId))
      : data;
  }

  @backgroundMethod()
  async fetchSearchTrending() {
    const categories = await this.fetchCategories([]);
    const searchTrendingCategory = categories.find(
      (i) => i.categoryId === ONEKEY_SEARCH_TRANDING,
    );
    return searchTrendingCategory
      ? this.fetchCategory(
          searchTrendingCategory.categoryId,
          searchTrendingCategory.coingeckoIds,
        )
      : [];
  }

  @backgroundMethod()
  async fetchCategory(
    category: string,
    coingeckoIds: string[],
    sparkline = false,
  ) {
    const requestParams: {
      category: string;
      sparkline: boolean;
      ids?: string;
    } = {
      category,
      sparkline,
    };
    if (coingeckoIds.length) {
      requestParams.ids = encodeURI(coingeckoIds.join(','));
    }
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: IMarketToken[];
    }>('/utility/v1/market/tokens', {
      params: requestParams,
      paramsSerializer: (params) => {
        const urlSearchParams = new URLSearchParams(params);
        return urlSearchParams.toString();
      },
    });
    const { data } = response.data;
    return data;
  }

  @backgroundMethod()
  async fetchTokenDetail(coingeckoId: string, explorerPlatforms = true) {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: IMarketTokenDetail;
    }>('/utility/v1/market/detail', {
      params: {
        id: coingeckoId,
        explorer_platforms: explorerPlatforms,
      },
    });
    const { data } = response.data;
    return data;
  }

  @backgroundMethod()
  async fetchWatchList() {
    const watchList = await marketWatchListPersistAtom.get();
    return watchList.items;
  }

  @backgroundMethod()
  async isInWatchList(coingeckoId: string) {
    const watchList = await this.fetchWatchList();
    return !!watchList.find(
      (i: { coingeckoId: string }) => i.coingeckoId === coingeckoId,
    );
  }

  // @backgroundMethod()
  // async addIntoWatchList(items: IMarketWatchListItem | IMarketWatchListItem[]) {
  //   await marketWatchListPersistAtom.set((prev) => {
  //     const params = !Array.isArray(items) ? [items] : items;
  //     const newItems = params.filter(
  //       (item) => !prev.items.find((i) => i.coingeckoId === item.coingeckoId),
  //     );
  //     return {
  //       items: [...prev.items, ...newItems],
  //     };
  //   });
  // }

  // @backgroundMethod()
  // async removeFormWatchList(item: IMarketWatchListItem) {
  //   await marketWatchListPersistAtom.set((prev) => ({
  //     items: prev.items.filter((i) => i.coingeckoId !== item.coingeckoId),
  //   }));
  // }

  // @backgroundMethod()
  // async moveToTop(item: IMarketWatchListItem) {
  //   await marketWatchListPersistAtom.set((prev) => {
  //     const newItems = prev.items.filter(
  //       (i) => i.coingeckoId !== item.coingeckoId,
  //     );
  //     return {
  //       items: [item, ...newItems],
  //     };
  //   });
  // }

  @backgroundMethod()
  async fetchPools(query: string) {
    const client = await this.getClient();
    try {
      const response = await client.get<{
        code: number;
        data: IMarketDetailPool[];
      }>('/utility/v1/market/pools', {
        params: {
          query,
        },
      });
      const { code, data } = response.data;
      return data;
    } catch {
      return [];
    }
  }

  @backgroundMethod()
  async fetchTokenChart(coingeckoId: string, days: string, points: number) {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: IMarketTokenChart;
    }>('/utility/v1/market/token/chart', {
      params: {
        coingeckoId,
        days,
        points,
      },
    });
    const { data } = response.data;
    return data;
  }

  @backgroundMethod()
  async searchToken(query: string) {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: string[];
    }>('/utility/v1/market/search', {
      params: {
        query,
      },
    });
    const { data } = response.data;
    if (data.length) {
      return this.fetchCategory('all', data, false);
    }
    return [];
  }
}

export default ServiceMarket;
