import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import type {
  IMarketCategory,
  IMarketDetailPool,
  IMarketToken,
  IMarketTokenChart,
  IMarketTokenDetail,
  IMarketWatchListItem,
} from '@onekeyhq/shared/types/market';

import { marketWatchListPersistAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

const getDevHeaders = async () =>
  platformEnv.isDev
    ? {
        'x-proxy': 'http://114.132.73.185',
        ...(await getRequestHeaders()),
      }
    : undefined;

@backgroundClass()
class ServiceMarket extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async fetchCategories() {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: IMarketCategory[];
    }>('/utility/v1/market/category/list', {
      headers: await getDevHeaders(),
    });
    const { code, data } = response.data;
    data[0].name = 'Watchlist';
    return code === 0
      ? data.filter((i) => i.categoryId !== 'onekey-search-trending')
      : [];
  }

  @backgroundMethod()
  async fetchCategory(
    category: string,
    coingeckoIds: string[],
    sparkline: boolean,
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
      headers: await getDevHeaders(),
      params: requestParams,
      paramsSerializer: (params) => {
        const urlSearchParams = new URLSearchParams(params);
        return urlSearchParams.toString();
      },
    });
    const { code, data } = response.data;
    return code === 0 ? data : [];
  }

  @backgroundMethod()
  async fetchTokenDetail(coingeckoId: string, explorerPlatforms = true) {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: IMarketTokenDetail;
    }>('/utility/v1/market/detail', {
      headers: await getDevHeaders(),
      params: {
        id: coingeckoId,
        explorer_platforms: explorerPlatforms,
      },
    });
    const { code, data } = response.data;
    return code === 0 ? data : ({} as IMarketTokenDetail);
  }

  @backgroundMethod()
  async fetchWatchList() {
    const watchList = await marketWatchListPersistAtom.get();
    return watchList.items;
  }

  @backgroundMethod()
  async addIntoWatchList(items: IMarketWatchListItem | IMarketWatchListItem[]) {
    await marketWatchListPersistAtom.set((prev) => {
      const params = !Array.isArray(items) ? [items] : items;
      const newItems = params.filter(
        (item) => !prev.items.find((i) => i.coingeckoId === item.coingeckoId),
      );
      return {
        items: [...prev.items, ...newItems],
      };
    });
  }

  @backgroundMethod()
  async removeFormWatchList(item: IMarketWatchListItem) {
    await marketWatchListPersistAtom.set((prev) => ({
      items: prev.items.filter((i) => i.coingeckoId !== item.coingeckoId),
    }));
  }

  @backgroundMethod()
  async fetchPools(query: string, network: string) {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: IMarketDetailPool[];
    }>('/utility/v1/market/pools', {
      headers: await getDevHeaders(),
      params: {
        query,
        network,
      },
    });
    const { code, data } = response.data;
    return code === 0 ? data : [];
  }

  @backgroundMethod()
  async fetchTokenChart(coingeckoId: string, days: string, points: number) {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: IMarketTokenChart;
    }>('/utility/v1/market/token/chart', {
      headers: await getDevHeaders(),
      params: {
        coingeckoId,
        days,
        points,
      },
    });
    const { code, data } = response.data;
    return code === 0 ? data : [];
  }

  @backgroundMethod()
  async searchToken(query: string) {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: string[];
    }>('/utility/v1/market/search', {
      headers: await getDevHeaders(),
      params: {
        query,
      },
    });
    const { code, data } = response.data;
    if (code === 0) {
      return this.fetchCategory('all', data, false);
    }
    return [];
  }
}

export default ServiceMarket;
