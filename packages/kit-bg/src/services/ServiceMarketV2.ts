import { isNil } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type {
  IMarketBasicConfigResponse,
  IMarketChainsResponse,
  IMarketTokenBatchListResponse,
  IMarketTokenDetail,
  IMarketTokenHoldersResponse,
  IMarketTokenKLineResponse,
  IMarketTokenListResponse,
  IMarketTokenSecurityBatchResponse,
  IMarketTokenTransactionsResponse,
} from '@onekeyhq/shared/types/marketV2';

import { type IDBCloudSyncItem } from '../dbs/local/types';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceMarketV2 extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async fetchMarketTokenDetailByTokenAddress(
    tokenAddress: string,
    networkId: string,
  ) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      data: {
        token: IMarketTokenDetail;
      };
    }>('/utility/v2/market/token/detail', {
      params: {
        tokenAddress,
        networkId,
      },
    });
    const { data } = response.data;
    return data.token;
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
  }: {
    tokenAddress: string;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketTokenTransactionsResponse;
    }>('/utility/v2/market/token/transactions', {
      params: {
        tokenAddress,
        networkId,
      },
    });
    const { data } = response.data;
    return data;
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
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.post<{
      code: number;
      message: string;
      data: IMarketTokenBatchListResponse;
    }>('/utility/v2/market/token/list/batch', {
      tokenAddressList,
    });

    const { data } = response.data;
    return data;
  }

  // Market Watch List V2 Methods (using chainId + contractAddress)
  // TODO: Implement cloud sync for V2 when CloudSyncFlowManagerMarketWatchListV2 is ready
  async buildMarketWatchListV2SyncItems({
    watchList: _watchList,
    isDeleted: _isDeleted,
  }: {
    watchList: IMarketWatchListItemV2[];
    isDeleted?: boolean;
  }): Promise<IDBCloudSyncItem[]> {
    // Temporarily return empty array until cloud sync manager is implemented
    return [];
    // const syncManagers = this.backgroundApi.servicePrimeCloudSync.syncManagers;
    // const now = await this.backgroundApi.servicePrimeCloudSync.timeNow();
    // const syncCredential =
    //   await this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();

    // const syncItems = (
    //   await Promise.all(
    //     watchList.map(async (watchListItem) => {
    //       return syncManagers.marketWatchListV2?.buildSyncItemByDBQuery({
    //         syncCredential,
    //         dbRecord: watchListItem,
    //         dataTime: now,
    //         isDeleted,
    //       });
    //     }),
    //   )
    // ).filter(Boolean);
    // return syncItems;
  }

  async withMarketWatchListV2CloudSync({
    fn,
    watchList: _watchList,
    isDeleted: _isDeleted,
    skipSaveLocalSyncItem: _skipSaveLocalSyncItem,
    skipEventEmit: _skipEventEmit,
  }: {
    fn: () => Promise<void>;
    watchList: IMarketWatchListItemV2[];
    isDeleted: boolean;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    // Temporarily skip cloud sync until manager is implemented
    await fn();
    // let syncItems: IDBCloudSyncItem[] = [];
    // if (!skipSaveLocalSyncItem) {
    //   syncItems = await this.buildMarketWatchListV2SyncItems({
    //     watchList,
    //     isDeleted,
    //   });
    // }
    // await this.backgroundApi.localDb.addAndUpdateSyncItems({
    //   items: syncItems,
    //   fn,
    // });
  }

  @backgroundMethod()
  async addMarketWatchListV2({
    watchList,
    skipSaveLocalSyncItem,
    skipEventEmit,
  }: {
    watchList: IMarketWatchListItemV2[];
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    const currentData =
      await this.backgroundApi.simpleDb.marketWatchListV2.getRawData();
    // eslint-disable-next-line no-param-reassign
    watchList = sortUtils.fillingSaveItemsSortIndex({
      oldList: currentData?.data ?? [],
      saveItems: watchList,
    });
    return this.withMarketWatchListV2CloudSync({
      watchList,
      isDeleted: false,
      skipSaveLocalSyncItem,
      skipEventEmit,
      fn: () =>
        this.backgroundApi.simpleDb.marketWatchListV2.addMarketWatchListV2({
          watchList,
        }),
    });
  }

  @backgroundMethod()
  async removeMarketWatchListV2({
    items,
    skipSaveLocalSyncItem,
    skipEventEmit,
  }: {
    items: Array<{ chainId: string; contractAddress: string }>;
    skipSaveLocalSyncItem?: boolean;
    skipEventEmit?: boolean;
  }) {
    const watchList: IMarketWatchListItemV2[] = items.map((item) => ({
      chainId: item.chainId,
      contractAddress: item.contractAddress,
      sortIndex: undefined,
    }));
    return this.withMarketWatchListV2CloudSync({
      watchList,
      isDeleted: true,
      skipSaveLocalSyncItem,
      skipEventEmit,
      fn: () =>
        this.backgroundApi.simpleDb.marketWatchListV2.removeMarketWatchListV2({
          items,
        }),
    });
  }

  @backgroundMethod()
  async getMarketWatchListV2() {
    return this.backgroundApi.simpleDb.marketWatchListV2.getMarketWatchListV2();
  }

  async getMarketWatchListV2WithFillingSortIndex() {
    const items = await this.getMarketWatchListV2();
    const hasMissingSortIndex = items.data.some((item) =>
      isNil(item.sortIndex),
    );
    if (hasMissingSortIndex) {
      const newList = sortUtils.fillingMissingSortIndex({ items: items.data });
      await this.backgroundApi.simpleDb.marketWatchListV2.addMarketWatchListV2({
        watchList: newList.items,
      });
    }
    return this.getMarketWatchListV2();
  }

  /**
   * Fetch token security information for multiple tokens using batch API
   * @param tokenAddressList - Array of token addresses with their chain IDs
   * @returns Promise<IMarketTokenSecurityBatchResponse> - Token security analysis data for all requested tokens
   *
   * @example
   * ```typescript
   * const securityBatch = await backgroundApiProxy.serviceMarketV2.fetchMarketTokenSecurity([
   *   { contractAddress: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', chainId: 'evm--1' },
   *   { contractAddress: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', chainId: 'sol--101' }
   * ]);
   * const shibSecurity = securityBatch['0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce'];
   * console.log('Is honeypot:', shibSecurity.is_honeypot?.value);
   * console.log('Buy tax:', shibSecurity.buy_tax?.value);
   * ```
   */
  @backgroundMethod()
  async fetchMarketTokenSecurity(
    tokenAddressList: Array<{ contractAddress: string; chainId: string }>,
  ) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.post<{
      code: number;
      message: string;
      data: IMarketTokenSecurityBatchResponse;
    }>('/utility/v2/market/token/security/batch', {
      tokenAddressList,
    });
    const { data } = response.data;

    return data;
  }
}

export default ServiceMarketV2;
