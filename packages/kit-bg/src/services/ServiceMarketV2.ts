import { isNil } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type {
  IMarketAccountPortfolioResponse,
  IMarketAccountTokenTransactionsResponse,
  IMarketBannerListResponse,
  IMarketBannerTokenListResponse,
  IMarketBasicConfigResponse,
  IMarketChainsResponse,
  IMarketTokenBatchListResponse,
  IMarketTokenDetailResponse,
  IMarketTokenHoldersResponse,
  IMarketTokenKLineResponse,
  IMarketTokenListItem,
  IMarketTokenListResponse,
  IMarketTokenSecurityBatchResponse,
  IMarketTokenTransactionsResponse,
} from '@onekeyhq/shared/types/marketV2';
import type { INotificationWatchlistToken } from '@onekeyhq/shared/types/notification';

import { type IDBCloudSyncItem } from '../dbs/local/types';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceMarketV2 extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // Cache for batch token list items with auto-expiration
  // Key: chainId:contractAddress, Value: { data, timestamp }
  private _marketTokenBatchCache = new Map<
    string,
    { data: IMarketTokenListItem; timestamp: number }
  >();

  private _marketTokenBatchCacheTTL = timerUtils.getTimeDurationMs({
    seconds: 30,
  });

  private _cleanExpiredMarketTokenBatchCache() {
    const now = Date.now();
    for (const [key, value] of this._marketTokenBatchCache) {
      if (now - value.timestamp > this._marketTokenBatchCacheTTL) {
        this._marketTokenBatchCache.delete(key);
      }
    }
  }

  @backgroundMethod()
  async fetchMarketTokenDetailByTokenAddress(
    tokenAddress: string,
    networkId: string,
  ) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<IMarketTokenDetailResponse>(
      '/utility/v2/market/token/detail',
      {
        params: {
          tokenAddress,
          networkId,
        },
      },
    );
    return response.data;
  }

  private memoizedFetchMarketChains = memoizee(
    async () => {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const response = await client.get<{
        data: IMarketChainsResponse;
      }>('/utility/v2/market/chains');
      const { data } = response.data;
      return data;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
      promise: true,
    },
  );

  @backgroundMethod()
  async fetchMarketChains() {
    return this.memoizedFetchMarketChains();
  }

  private memoizedFetchMarketBasicConfig = memoizee(
    async () => {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const response = await client.get<IMarketBasicConfigResponse>(
        '/utility/v2/market/basic-config',
        {
          params: {
            configVersion: 2,
          },
        },
      );
      return response.data;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
      promise: true,
    },
  );

  @backgroundMethod()
  async fetchMarketBasicConfig() {
    return this.memoizedFetchMarketBasicConfig();
  }

  @backgroundMethod()
  async fetchMarketTokenList({
    networkId,
    sortBy,
    sortType,
    page = 1,
    limit = 20,
    minLiquidity,
    maxLiquidity,
  }: {
    networkId: string;
    sortBy?: string;
    sortType?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    minLiquidity?: number;
    maxLiquidity?: number;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketTokenListResponse;
    }>('/utility/v2/market/token/list', {
      params: {
        networkId,
        sortBy,
        sortType,
        page,
        limit,
        minLiquidity,
        maxLiquidity,
      },
    });
    const { data } = response.data;
    return data;
  }

  @backgroundMethod()
  async fetchMarketTokenKline({
    tokenAddress,
    networkId,
    interval,
    timeFrom,
    timeTo,
  }: {
    tokenAddress: string;
    networkId: string;
    interval?: string;
    timeFrom?: number;
    timeTo?: number;
  }) {
    let innerInterval = interval?.toUpperCase();

    if (innerInterval?.includes('M') || innerInterval?.includes('S')) {
      innerInterval = innerInterval?.toLowerCase();
    }

    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketTokenKLineResponse;
    }>('/utility/v2/market/token/kline', {
      params: {
        tokenAddress,
        networkId,
        interval: innerInterval,
        timeFrom,
        timeTo,
      },
    });
    const { data } = response.data;
    return data;
  }

  @backgroundMethod()
  async fetchMarketTokenTransactions({
    tokenAddress,
    networkId,
    cursor,
    limit,
  }: {
    tokenAddress: string;
    networkId: string;
    cursor?: string;
    limit?: number;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketTokenTransactionsResponse;
    }>('/utility/v3/market/token/transactions', {
      params: {
        tokenAddress,
        networkId,
        ...(cursor !== undefined && { cursor }),
        ...(limit !== undefined && { limit }),
      },
    });
    const { data } = response.data;
    return data;
  }

  @backgroundMethod()
  async fetchMarketAccountTokenTransactions({
    accountAddress,
    tokenAddress,
    networkId,
    cursor,
    timeFrom,
    timeTo,
  }: {
    accountAddress: string;
    tokenAddress: string;
    networkId: string;
    cursor?: string;
    timeFrom?: number;
    timeTo?: number;
  }) {
    try {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const response = await client.get<{
        code: number;
        message: string;
        data: IMarketAccountTokenTransactionsResponse;
      }>('/utility/v2/market/account/token/transactions', {
        params: {
          accountAddress,
          tokenAddress,
          networkId,
          ...(cursor !== undefined && { cursor }),
          ...(timeFrom !== undefined && { timeFrom }),
          ...(timeTo !== undefined && { timeTo }),
        },
      });
      const { data } = response.data;
      return data;
    } catch (error) {
      console.error(
        '[ServiceMarketV2] fetchMarketAccountTokenTransactions error:',
        error,
      );
      return { list: [] };
    }
  }

  @backgroundMethod()
  async fetchMarketTokenHolders({
    tokenAddress,
    networkId,
  }: {
    tokenAddress: string;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketTokenHoldersResponse;
    }>('/utility/v2/market/token/top-holders', {
      params: {
        tokenAddress,
        networkId,
      },
    });
    const { data } = response.data;
    return data;
  }

  @backgroundMethod()
  async fetchMarketTokenListBatch({
    tokenAddressList,
  }: {
    tokenAddressList: {
      contractAddress: string;
      chainId: string;
      isNative: boolean;
    }[];
  }) {
    // Clean expired cache entries periodically
    this._cleanExpiredMarketTokenBatchCache();

    const now = Date.now();
    const cachedResults: IMarketTokenListItem[] = [];
    const missingTokens: typeof tokenAddressList = [];
    const tokenIndexMap = new Map<string, number>();

    // Check cache for each token
    tokenAddressList.forEach((token, index) => {
      const cacheKey = `${
        token.chainId
      }:${token.contractAddress.toLowerCase()}`;
      tokenIndexMap.set(cacheKey, index);

      const cached = this._marketTokenBatchCache.get(cacheKey);
      if (cached && now - cached.timestamp < this._marketTokenBatchCacheTTL) {
        cachedResults[index] = cached.data;
      } else {
        missingTokens.push(token);
      }
    });

    // If all tokens are cached, return immediately
    if (missingTokens.length === 0) {
      return { list: cachedResults };
    }

    // Fetch missing tokens from API
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.post<{
      code: number;
      message: string;
      data: IMarketTokenBatchListResponse;
    }>('/utility/v2/market/token/list/batch', {
      tokenAddressList: missingTokens,
    });

    const { data } = response.data;

    // Update cache and merge results
    data.list.forEach((item, apiIndex) => {
      const token = missingTokens[apiIndex];
      const cacheKey = `${
        token.chainId
      }:${token.contractAddress.toLowerCase()}`;
      const originalIndex = tokenIndexMap.get(cacheKey);

      // Update cache
      this._marketTokenBatchCache.set(cacheKey, { data: item, timestamp: now });

      // Place in correct position
      if (originalIndex !== undefined) {
        cachedResults[originalIndex] = item;
      }
    });

    return { list: cachedResults };
  }

  async buildMarketWatchListV2SyncItems({
    watchList,
    isDeleted,
  }: {
    watchList: IMarketWatchListItemV2[];
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

  async withMarketWatchListV2CloudSync({
    fn,
    watchList,
    isDeleted,
    skipSaveLocalSyncItem,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    skipEventEmit,
  }: {
    fn: () => Promise<void>;
    watchList: IMarketWatchListItemV2[];
    isDeleted: boolean;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    let syncItems: IDBCloudSyncItem[] = [];
    if (!skipSaveLocalSyncItem) {
      syncItems = await this.buildMarketWatchListV2SyncItems({
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
  async addMarketWatchListV2({
    watchList,
    skipSaveLocalSyncItem,
    skipEventEmit,
    callerName,
  }: {
    watchList: IMarketWatchListItemV2[];
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
    callerName: string;
  }) {
    const currentData =
      await this.backgroundApi.simpleDb.marketWatchListV2.getRawData();
    const newWatchList = sortUtils.fillingSaveItemsSortIndex({
      oldList: currentData?.data ?? [],
      saveItems: watchList,
    });
    return this.withMarketWatchListV2CloudSync({
      watchList: newWatchList,
      isDeleted: false,
      skipSaveLocalSyncItem,
      skipEventEmit,
      fn: async () => {
        const result =
          await this.backgroundApi.simpleDb.marketWatchListV2.addMarketWatchListV2(
            {
              watchList: newWatchList,
              callerName,
            },
          );
        appEventBus.emit(EAppEventBusNames.MarketWatchListV2Changed, undefined);
        return result;
      },
    });
  }

  @backgroundMethod()
  async removeMarketWatchListV2({
    items,
    skipSaveLocalSyncItem,
    skipEventEmit,
    callerName,
  }: {
    items: Array<{ chainId: string; contractAddress: string }>;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
    callerName: string;
  }) {
    return this.withMarketWatchListV2CloudSync({
      watchList: items,
      isDeleted: true,
      skipSaveLocalSyncItem,
      skipEventEmit,
      fn: async () => {
        const result =
          await this.backgroundApi.simpleDb.marketWatchListV2.removeMarketWatchListV2(
            {
              items,
              callerName,
            },
          );
        appEventBus.emit(EAppEventBusNames.MarketWatchListV2Changed, undefined);
        return result;
      },
    });
  }

  @backgroundMethod()
  async getMarketWatchListV2() {
    return this.backgroundApi.simpleDb.marketWatchListV2.getMarketWatchListV2();
  }

  @backgroundMethod()
  async getMarketWatchListItemV2({
    chainId,
    contractAddress,
  }: {
    chainId: string;
    contractAddress: string;
  }): Promise<IMarketWatchListItemV2 | undefined> {
    return this.backgroundApi.simpleDb.marketWatchListV2.getMarketWatchListItemV2(
      {
        chainId,
        contractAddress,
      },
    );
  }

  async getMarketWatchListWithFillingSortIndexV2() {
    const items = await this.getMarketWatchListV2();
    const hasMissingSortIndex = items.data.some((item) =>
      isNil(item.sortIndex),
    );
    if (hasMissingSortIndex) {
      const newList = sortUtils.fillingMissingSortIndex({ items: items.data });
      await this.backgroundApi.simpleDb.marketWatchListV2.addMarketWatchListV2({
        watchList: newList.items,
        callerName: 'getMarketWatchListWithFillingSortIndexV2',
      });
    }
    return this.getMarketWatchListV2();
  }

  @backgroundMethod()
  async clearAllMarketWatchListV2() {
    const result =
      await this.backgroundApi.simpleDb.marketWatchListV2.clearAllMarketWatchListV2();
    appEventBus.emit(EAppEventBusNames.MarketWatchListV2Changed, undefined);
    return result;
  }

  @backgroundMethod()
  async buildWatchlistTokensForNotification(): Promise<
    INotificationWatchlistToken[]
  > {
    const watchlistData = await this.getMarketWatchListV2();

    if (watchlistData.data.length === 0) {
      return [];
    }

    const tokenAddressList = watchlistData.data.map((item) => ({
      chainId: item.chainId,
      contractAddress: item.contractAddress,
      isNative: item.isNative ?? false,
    }));

    let tokenDetails: IMarketTokenBatchListResponse = { list: [] };

    try {
      tokenDetails = await this.fetchMarketTokenListBatch({
        tokenAddressList,
      });
    } catch (error) {
      console.error(
        '[ServiceMarketV2] buildWatchlistTokensForNotification fetchMarketTokenListBatch error:',
        error,
      );
    }

    const watchlistItems: IMarketWatchListItemV2[] = watchlistData.data;
    const tokens: INotificationWatchlistToken[] = watchlistItems.map(
      (item, index) => {
        const detail = tokenDetails.list[index];

        return {
          networkId: item.chainId,
          tokenAddress: item.contractAddress,
          isNative: item.isNative ?? false,
          symbol: detail?.symbol ?? '',
          logoURI: detail?.logoUrl ?? '',
        };
      },
    );

    return tokens;
  }

  private _fetchMarketTokenSecurityCached = memoizee(
    async (
      contractAddress: string,
      chainId: string,
    ): Promise<IMarketTokenSecurityBatchResponse> => {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const response = await client.post<{
        code: number;
        message: string;
        data: IMarketTokenSecurityBatchResponse;
      }>('/utility/v2/market/token/security/batch', {
        tokenAddressList: [
          {
            contractAddress,
            chainId,
          },
        ],
      });
      const { data } = response.data;

      return data;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
      promise: true,
    },
  );

  @backgroundMethod()
  async fetchMarketTokenSecurity(item: {
    contractAddress: string;
    chainId: string;
  }) {
    return this._fetchMarketTokenSecurityCached(
      item.contractAddress,
      item.chainId,
    );
  }

  @backgroundMethod()
  async fetchMarketAccountPortfolio({
    accountAddress,
    networkId,
    tokenAddress,
  }: {
    accountAddress: string;
    networkId: string;
    tokenAddress: string;
  }) {
    try {
      const client = await this.getClient(EServiceEndpointEnum.Utility);

      const response = await client.get<{
        code: number;
        message: string;
        data: IMarketAccountPortfolioResponse;
      }>('/utility/v2/market/account/portfolio', {
        params: {
          networkId,
          accountAddress,
          tokenAddress,
        },
      });

      const { data } = response.data;
      return data;
    } catch (error) {
      console.error(
        '[ServiceMarketV2] fetchMarketAccountPortfolio error:',
        error,
      );
      // Return empty list on error instead of throwing
      return { list: [] };
    }
  }

  private memoizedFetchMarketBannerList = memoizee(
    async () => {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const response = await client.get<{
        code: number;
        message: string;
        data: IMarketBannerListResponse;
      }>('/utility/v2/market/banner/list');
      const { data } = response.data;
      return data.data;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
      promise: true,
    },
  );

  @backgroundMethod()
  async fetchMarketBannerList() {
    return this.memoizedFetchMarketBannerList();
  }

  @backgroundMethod()
  async fetchMarketBannerTokenList({ tokenListId }: { tokenListId: string }) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketBannerTokenListResponse;
    }>(`/utility/v2/market/banner/token-list/${tokenListId}`);
    const { data } = response.data;
    return data.list;
  }
}

export default ServiceMarketV2;
