import { isNil } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type {
  IMarketAccountPortfolioResponse,
  IMarketAccountTokenTransactionsResponse,
  IMarketBannerItem,
  IMarketBannerListResponse,
  IMarketBannerTokenListResponse,
  IMarketBasicConfigResponse,
  IMarketChainsResponse,
  IMarketPerpsTokenListData,
  IMarketPerpsTokenListResponse,
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
import {
  devSettingsPersistAtom,
  settingsPersistAtom,
} from '../states/jotai/atoms';
import { perpTokenFavoritesPersistAtom } from '../states/jotai/atoms/perps';

import ServiceBase from './ServiceBase';
import { MOCK_MARKET_BANNER_LIST } from './ServiceMarketV2.const';

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
    const settings = await settingsPersistAtom.get();
    const selectedCurrencyId = settings.currencyInfo?.id ?? 'usd';
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const params: Record<string, string> = {
      tokenAddress,
      networkId,
      currency: 'usd',
    };
    // When the user has selected a non-USD currency, request a converted price
    if (selectedCurrencyId !== 'usd') {
      params.convertCurrency = selectedCurrencyId;
    }
    const response = await client.get<IMarketTokenDetailResponse>(
      '/utility/v2/market/token/detail',
      { params },
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
        currency: 'usd',
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
        currency: 'usd',
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
        currency: 'usd',
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
          currency: 'usd',
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
        currency: 'usd',
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
    }>(
      '/utility/v2/market/token/list/batch',
      {
        tokenAddressList: missingTokens,
        currency: 'usd',
      },
      {
        headers: { 'x-onekey-request-currency': 'usd' },
      },
    );

    const { data } = response.data;

    if (!data?.list) {
      console.error(
        '[ServiceMarketV2] fetchMarketTokenListBatch: unexpected empty response',
        {
          requestIds: missingTokens.map(
            (t) => `${t.chainId}:${t.contractAddress}`,
          ),
        },
      );
      return { list: cachedResults };
    }

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
    items: Array<{
      chainId: string;
      contractAddress: string;
      perpsCoin?: string;
    }>;
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
    perpsCoin,
  }: {
    chainId: string;
    contractAddress: string;
    perpsCoin?: string;
  }): Promise<IMarketWatchListItemV2 | undefined> {
    return this.backgroundApi.simpleDb.marketWatchListV2.getMarketWatchListItemV2(
      {
        chainId,
        contractAddress,
        perpsCoin,
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

    // Filter out perps items — they don't have chainId/contractAddress for batch lookup
    // Also filter out items with empty chainId to avoid server validation errors
    const spotItems = watchlistData.data.filter(
      (item) => !item.perpsCoin && item.chainId?.trim(),
    );
    const tokenAddressList = spotItems.map((item) => ({
      chainId: item.chainId,
      contractAddress: item.contractAddress,
      isNative: item.isNative ?? false,
    }));

    let tokenDetails: IMarketTokenBatchListResponse = { list: [] };
    let batchSucceeded = false;

    try {
      tokenDetails = await this.fetchMarketTokenListBatch({
        tokenAddressList,
      });
      batchSucceeded = true;
    } catch (error) {
      console.error(
        '[ServiceMarketV2] buildWatchlistTokensForNotification fetchMarketTokenListBatch error:',
        error,
      );
    }

    const tokens: INotificationWatchlistToken[] = spotItems.map(
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

    // Only filter out symbol-less tokens when batch succeeded;
    // if batch failed, return all entries to avoid wiping server-side watchlist.
    // Note: empty networkId is already filtered out at the spotItems stage above.
    return batchSucceeded ? tokens.filter((t) => t.symbol) : tokens;
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
    xpub,
  }: {
    accountAddress: string;
    networkId: string;
    tokenAddress: string;
    xpub?: string;
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
          xpub,
          currency: 'usd',
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
  async fetchMarketBannerList(): Promise<IMarketBannerItem[]> {
    const devSettings = await devSettingsPersistAtom.get();
    if (devSettings.enabled && devSettings.settings?.enableMockMarketBanner) {
      return MOCK_MARKET_BANNER_LIST;
    }
    return this.memoizedFetchMarketBannerList();
  }

  @backgroundMethod()
  async clearMarketBannerCache(): Promise<void> {
    // memoizee's clear() is synchronous, returns void
    void this.memoizedFetchMarketBannerList.clear();
  }

  @backgroundMethod()
  async fetchMarketBannerTokenList({ tokenListId }: { tokenListId: string }) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketBannerTokenListResponse;
    }>(
      `/utility/v2/market/banner/token-list/${encodeURIComponent(tokenListId)}`,
      { params: { currency: 'usd' } },
    );
    const { data } = response.data;
    return data.list;
  }

  @backgroundMethod()
  async fetchMarketBannerPerpsTokenList({
    tokenListId,
  }: {
    tokenListId: string;
  }): Promise<IMarketPerpsTokenListData> {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<IMarketPerpsTokenListResponse>(
      `/utility/v2/market/banner/perps-token-list/${encodeURIComponent(tokenListId)}`,
    );
    return response.data.data;
  }

  @backgroundMethod()
  async fetchMarketPerpsTokenList(params?: {
    category?: string;
  }): Promise<IMarketPerpsTokenListData> {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<IMarketPerpsTokenListResponse>(
      '/utility/v2/market/perps/token-list',
      {
        params: params?.category ? { category: params.category } : undefined,
      },
    );
    return response.data.data;
  }

  // ── Perps Favorites Bidirectional Sync ──

  @backgroundMethod()
  async syncToPerpsAtom({
    coin,
    action,
  }: {
    coin: string;
    action: 'add' | 'remove';
  }) {
    try {
      const current = await perpTokenFavoritesPersistAtom.get();
      const hasCoin = current.favorites.includes(coin);

      if (action === 'add' && !hasCoin) {
        await perpTokenFavoritesPersistAtom.set({
          ...current,
          favorites: [...current.favorites, coin],
        });
      } else if (action === 'remove' && hasCoin) {
        await perpTokenFavoritesPersistAtom.set({
          ...current,
          favorites: current.favorites.filter((f) => f !== coin),
        });
      }
    } catch (error) {
      defaultLogger.cloudSync.market.syncToPerpsAtomFailed(coin, action, error);
    }
  }

  @backgroundMethod()
  async syncToMarketWatchList({
    coin,
    action,
  }: {
    coin: string;
    action: 'add' | 'remove';
  }) {
    try {
      const existing =
        await this.backgroundApi.simpleDb.marketWatchListV2.getMarketWatchListItemV2(
          { chainId: '', contractAddress: '', perpsCoin: coin },
        );

      if (action === 'add' && !existing) {
        await this.addMarketWatchListV2({
          watchList: [{ chainId: '', contractAddress: '', perpsCoin: coin }],
          callerName: 'syncToMarketWatchList',
        });
      } else if (action === 'remove' && existing) {
        await this.removeMarketWatchListV2({
          items: [{ chainId: '', contractAddress: '', perpsCoin: coin }],
          callerName: 'syncToMarketWatchList',
        });
      }
    } catch (error) {
      defaultLogger.cloudSync.market.syncToMarketWatchListFailed(
        coin,
        action,
        error,
      );
    }
  }

  @backgroundMethod()
  async reconcilePerpsFavorites() {
    try {
      const [watchListData, perpsFavorites] = await Promise.all([
        this.backgroundApi.simpleDb.marketWatchListV2.getMarketWatchListV2(),
        perpTokenFavoritesPersistAtom.get(),
      ]);

      const marketPerpsCoins = new Set(
        watchListData.data
          .filter((item) => !!item.perpsCoin)
          .map((item) => item.perpsCoin ?? ''),
      );
      const perpsCoins = new Set(perpsFavorites.favorites);

      // Market has but Perps doesn't
      const missingInPerps = [...marketPerpsCoins].filter(
        (c) => !perpsCoins.has(c),
      );
      // Perps has but Market doesn't
      const missingInMarket = [...perpsCoins].filter(
        (c) => !marketPerpsCoins.has(c),
      );

      if (missingInPerps.length === 0 && missingInMarket.length === 0) {
        return;
      }

      // Sync missing items to Perps atom
      if (missingInPerps.length > 0) {
        const current = await perpTokenFavoritesPersistAtom.get();
        const existingSet = new Set(current.favorites);
        const toAdd = missingInPerps.filter((c) => !existingSet.has(c));
        if (toAdd.length > 0) {
          await perpTokenFavoritesPersistAtom.set({
            ...current,
            favorites: [...current.favorites, ...toAdd],
          });
        }
      }

      // Sync missing items to Market watchlist
      if (missingInMarket.length > 0) {
        await this.addMarketWatchListV2({
          watchList: missingInMarket.map((coin) => ({
            chainId: '',
            contractAddress: '',
            perpsCoin: coin,
          })),
          callerName: 'reconcilePerpsFavorites',
        });
      }
    } catch (error) {
      defaultLogger.cloudSync.market.reconcilePerpsFavoritesFailed(error);
    }
  }
}

export default ServiceMarketV2;
