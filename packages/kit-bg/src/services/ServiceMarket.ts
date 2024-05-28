import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import type {
  IMarketCategory,
  IMarketDetailPool,
  IMarketToken,
  IMarketTokenChart,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

// import { marketWatchListPersistAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

const ONEKEY_SEARCH_TRANDING = 'onekey-search-trending';

const getHeaders = async () => ({
  'x-proxy': 'http://43.134.180.224',
  ...(await getRequestHeaders()),
});

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
    }>('/utility/v1/market/category/list', {
      headers: await getHeaders(),
    });
    const { data } = response.data;
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
      headers: await getHeaders(),
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
      headers: await getHeaders(),
    });
    const { data } = response.data;
    return data;
  }

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
        headers: await getHeaders(),
      });
      const { data } = response.data;
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
      headers: await getHeaders(),
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
      headers: await getHeaders(),
    });
    const { data } = response.data;
    if (data.length) {
      return this.fetchCategory('all', data, false);
    }
    return [];
  }
}

export default ServiceMarket;
