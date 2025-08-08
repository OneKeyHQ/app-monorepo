import { isNil } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateLocalIndexedIdFunc } from '@onekeyhq/shared/src/utils/miscUtils';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IMarketCategory,
  IMarketDetailPlatform,
  IMarketDetailPool,
  IMarketSearchV2Token,
  IMarketToken,
  IMarketTokenChart,
  IMarketTokenDetail,
  IMarketWatchListItem,
} from '@onekeyhq/shared/types/market';

import { type IDBCloudSyncItem } from '../dbs/local/types';

import ServiceBase from './ServiceBase';

import type { AxiosResponse } from 'axios';

const ONEKEY_SEARCH_TRANDING = 'onekey-search-trending';

@backgroundClass()
class ServiceMarket extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async fetchCategories(filters = [ONEKEY_SEARCH_TRANDING]) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      data: IMarketCategory[];
    }>('/utility/v1/market/category/list');
    const { data } = response.data;
    return filters.length
      ? data
          .filter((i) => !filters.includes(i.categoryId))
          .sort((a, b) => Number(a.sequenceId) - Number(b.sequenceId))
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
      sparklinePoints?: number;
    } = {
      category,
      sparkline,
    };
    if (requestParams.sparkline) {
      requestParams.sparklinePoints = 100;
    }
    if (coingeckoIds.length) {
      requestParams.ids = encodeURI(coingeckoIds.join(','));
    }
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
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
  async fetchMarketTokenDetail(coingeckoId: string, explorerPlatforms = true) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      data: IMarketTokenDetail;
    }>('/utility/v1/market/detail', {
      params: {
        id: coingeckoId,
        explorer_platforms: explorerPlatforms,
      },
    });
    const { data } = response.data;
    if (data.tickers) {
      const buildId = generateLocalIndexedIdFunc();
      data.tickers.forEach((ticker, index) => {
        ticker.localId = buildId(index);
      });
    }
    return data;
  }

  @backgroundMethod()
  async fetchPools(detailPlatforms: IMarketDetailPlatform) {
    const keys = Object.keys(detailPlatforms);
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    try {
      const poolsData = await Promise.allSettled(
        keys.map((key) => {
          const { contract_address: contractAddress, coingeckoNetworkId } =
            detailPlatforms[key];
          if (contractAddress && coingeckoNetworkId) {
            return client.get<{
              data: IMarketDetailPool[];
            }>('/utility/v1/market/pools', {
              params: {
                query: contractAddress,
                network: coingeckoNetworkId,
              },
            });
          }
          return Promise.resolve({ data: { data: [] } });
        }),
      );
      const buildId = generateLocalIndexedIdFunc();
      return keys
        .map((key, index) => ({
          ...detailPlatforms[key],
          data:
            poolsData[index].status === 'fulfilled'
              ? (
                  poolsData[index] as PromiseFulfilledResult<
                    AxiosResponse<{ data: IMarketDetailPool[] }>
                  >
                ).value.data.data
              : [],
        }))
        .filter((i) => i.data.length)
        .map((i, index) => ({
          ...i,
          localId: buildId(index),
        }));
    } catch (error) {
      console.error('fetchPools error', error);
      return [];
    }
  }

  @backgroundMethod()
  async fetchTokenChart(coingeckoId: string, days: string) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      data: IMarketTokenChart;
    }>('/utility/v1/market/token/chart', {
      params: {
        coingeckoId,
        days,
        points: !platformEnv.isNative || platformEnv.isNativeIOSPad ? 500 : 200,
      },
    });
    const { data } = response.data;
    return data;
  }

  @backgroundMethod()
  async searchToken(query: string) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
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

  @backgroundMethod()
  async searchV2Token(query: string) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      data: IMarketSearchV2Token[];
    }>('/utility/v2/market/search', {
      params: {
        query,
      },
    });
    const { data } = response.data;
    if (Array.isArray(data) && data.length) {
      return data;
    }
    return [];
  }

  async buildMarketWatchListSyncItems({
    watchList,
    isDeleted,
  }: {
    watchList: IMarketWatchListItem[];
    isDeleted?: boolean;
  }): Promise<IDBCloudSyncItem[]> {
    const syncManagers = this.backgroundApi.servicePrimeCloudSync.syncManagers;
    const now = await this.backgroundApi.servicePrimeCloudSync.timeNow();
    const syncCredential =
      await this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();

    const syncItems = (
      await Promise.all(
        watchList.map(async (watchListItem) => {
          return syncManagers.marketWatchList.buildSyncItemByDBQuery({
            syncCredential,
            dbRecord: watchListItem,
            dataTime: now,
            isDeleted,
          });
        }),
      )
    ).filter(Boolean);
    return syncItems;
  }

  async withMarketWatchListCloudSync({
    fn,
    watchList,
    isDeleted,
    skipSaveLocalSyncItem,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    skipEventEmit,
  }: {
    fn: () => Promise<void>;
    watchList: IMarketWatchListItem[];
    isDeleted: boolean;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    let syncItems: IDBCloudSyncItem[] = [];
    if (!skipSaveLocalSyncItem) {
      syncItems = await this.buildMarketWatchListSyncItems({
        watchList,
        isDeleted,
      });
    }
    await this.backgroundApi.localDb.addAndUpdateSyncItems({
      items: syncItems,
      fn,
    });
  }

  @backgroundMethod()
  async addMarketWatchList({
    watchList,
    skipSaveLocalSyncItem,
    skipEventEmit,
  }: {
    watchList: IMarketWatchListItem[];
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    const currentData =
      await this.backgroundApi.simpleDb.marketWatchList.getRawData();
    // eslint-disable-next-line no-param-reassign
    watchList = sortUtils.fillingSaveItemsSortIndex({
      oldList: currentData?.data ?? [],
      saveItems: watchList,
    });
    return this.withMarketWatchListCloudSync({
      watchList,
      isDeleted: false,
      skipSaveLocalSyncItem,
      skipEventEmit,
      fn: () =>
        this.backgroundApi.simpleDb.marketWatchList.addMarketWatchList({
          watchList,
        }),
    });
  }

  @backgroundMethod()
  async removeMarketWatchList({
    watchList,
    skipSaveLocalSyncItem,
    skipEventEmit,
  }: {
    watchList: IMarketWatchListItem[];
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    return this.withMarketWatchListCloudSync({
      watchList,
      isDeleted: true,
      skipSaveLocalSyncItem,
      skipEventEmit,
      fn: () =>
        this.backgroundApi.simpleDb.marketWatchList.removeMarketWatchList({
          coingeckoIds: watchList.map((i) => i.coingeckoId),
        }),
    });
  }

  @backgroundMethod()
  async getMarketWatchList() {
    return this.backgroundApi.simpleDb.marketWatchList.getMarketWatchList();
  }

  async getMarketWatchListWithFillingSortIndex() {
    const items = await this.getMarketWatchList();
    const hasMissingSortIndex = items.data.some((item) =>
      isNil(item.sortIndex),
    );
    if (hasMissingSortIndex) {
      const newList = sortUtils.fillingMissingSortIndex({ items: items.data });
      await this.backgroundApi.simpleDb.marketWatchList.addMarketWatchList({
        watchList: newList.items,
      });
    }
    return this.getMarketWatchList();
  }
}

export default ServiceMarket;
