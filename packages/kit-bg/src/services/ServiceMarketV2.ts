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
  IMarketBannerItem,
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
import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';

import ServiceBase from './ServiceBase';

const MOCK_MARKET_BANNER_LIST: IMarketBannerItem[] = [
  {
    _id: '694e714617fa06428a8b87dc',
    title: 'mock data',
    rank: 6,
    mode: 4,
    payload: 'https://onekey.so/app/',
    backgroundColor: 'bg/success-subdued',
    tokenListId: '694f771417fa06428a954d31',
    miniBundlerVersion: '',
    description: {
      text: '+0.30%',
      fontColor: 'text/success',
    },
    tokenLogos: [
      'https://static.oklink.com/cdn/web3/currency/token/large/501-XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB-107/type=default_90_0?v=1767088266549',
      'https://static.oklink.com/cdn/web3/currency/token/large/501-XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1-107/type=default_90_0?v=1767088736203',
      'https://static.oklink.com/cdn/web3/currency/token/large/501-Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh-107/type=default_90_0?v=1767087495698',
    ],
  },
  {
    _id: '694e711b17fa06428a8b8755',
    title: 'Binance Alpha',
    rank: 5,
    mode: 4,
    payload: 'https://onekey.so/app/',
    backgroundColor: 'bg/info-subdued',
    tokenListId: '694f638317fa06428a8fa884',
    miniBundlerVersion: '',
    description: {
      text: '-0.63%',
      fontColor: 'text/critical',
    },
    tokenLogos: [
      'https://static.oklink.com/cdn/web3/currency/token/large/56-0x22b1458e780f8fa71e2f84502cee8b5a3cc731fa-106/type=default_90_0?v=1767118691844',
      'https://static.oklink.com/cdn/web3/currency/token/large/56-0xd82544bf0dfe8385ef8fa34d67e6e4940cc63e16-106/type=default_90_0?v=1767111694214',
      'https://static.oklink.com/cdn/web3/currency/token/large/8453-0x940181a94a35a4569e4529a3cdfb74e38fd98631-106/type=default_90_0?v=1767110420256',
    ],
  },
  {
    _id: '694e70ed17fa06428a8b86ce',
    title: 'Privacy',
    rank: 4,
    mode: 4,
    payload: 'https://onekey.so/app/',
    backgroundColor: 'bg/critical-subdued',
    tokenListId: '694f73c417fa06428a94af35',
    miniBundlerVersion: '',
    description: {
      text: '+0.30%',
      fontColor: 'text/success',
    },
    tokenLogos: [
      'https://static.oklink.com/cdn/web3/currency/token/small/9004-0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d-105?v=1749148896150',
      'https://static.oklink.com/cdn/web3/currency/token/large/1-0xcf5104d094e3864cfcbda43b82e1cefd26a016eb-106/type=default_90_0?v=1767117135996',
      'https://static.oklink.com/cdn/web3/currency/token/large/1-0xf57e7e7c23978c3caec3c3548e3d615c346e79ff-106/type=default_90_0?v=1767110477654',
    ],
  },
  {
    _id: '694e70c117fa06428a8b8647',
    title: 'Memes',
    rank: 3,
    mode: 4,
    payload: 'https://onekey.so/app/',
    backgroundColor: 'bg/caution-subdued',
    tokenListId: '694f5cc817fa06428a8decd9',
    miniBundlerVersion: '',
    description: {
      text: '+1.69%',
      fontColor: 'text/success',
    },
    tokenLogos: [
      'https://static.oklink.com/cdn/web3/currency/token/large/8453-0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce-110/type=default_90_0?v=1766385055704',
      'https://static.oklink.com/cdn/web3/currency/token/large/56-0x22b1458e780f8fa71e2f84502cee8b5a3cc731fa-106/type=default_90_0?v=1767118691844',
      'https://static.oklink.com/cdn/web3/currency/token/large/501-pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn-107/type=default_90_0?v=1766891581031',
    ],
  },
  {
    _id: '694e709017fa06428a8b85aa',
    title: 'RWA',
    rank: 2,
    mode: 4,
    payload: 'https://onekey.so/app/',
    backgroundColor: 'bg/success-subdued',
    tokenListId: '694f6eb817fa06428a9326ec',
    miniBundlerVersion: '',
    description: {
      text: '-0.17%',
      fontColor: 'text/critical',
    },
    tokenLogos: [
      'https://static.coinall.ltd/cdn/wallet/logo/LINK-20220328.png',
      'https://static.oklink.com/cdn/web3/currency/token/large/1-0x68749665ff8d2d112fa859aa293f07a622782f38-106/type=default_90_0?v=1767110478441',
      'https://static.oklink.com/cdn/web3/currency/token/large/1-0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3-107/type=default_90_0?v=1760965919091',
    ],
  },
  {
    _id: '694e705617fa06428a8b8523',
    title: 'DeFi',
    rank: 1,
    mode: 4,
    payload: 'https://onekey.so/app/',
    backgroundColor: 'bg/info-subdued',
    tokenListId: '694f69a217fa06428a916ddc',
    miniBundlerVersion: '',
    description: {
      text: '+0.36%',
      fontColor: 'text/success',
    },
    tokenLogos: [
      'https://static.oklink.com/cdn/web3/currency/token/large/1-0xae7ab96520de3a18e5e111b5eaab095312d7fe84-106/type=default_90_0?v=1767110481365',
      'https://static.oklink.com/cdn/web3/currency/token/large/1-0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0-107/type=default_90_0?v=1753850278448',
      'https://static.coinall.ltd/cdn/wallet/logo/LINK-20220328.png',
    ],
  },
];

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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.memoizedFetchMarketBannerList.clear();
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
