import { isNil } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { normalizeMarketApiKLineInterval } from '@onekeyhq/shared/src/utils/marketKLineUtils';
import { dedupeTokenSelectorFavoriteCoins } from '@onekeyhq/shared/src/utils/perpsTokenSelectorFavorites';
import sortUtils from '@onekeyhq/shared/src/utils/sortUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { isTransientNetworkLikeError } from '@onekeyhq/shared/src/utils/transientNetworkErrorUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { ICandleSnapshotParameters } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type {
  IMarketAccountPortfolioResponse,
  IMarketAccountTokenTransactionsResponse,
  IMarketBannerItem,
  IMarketBannerListResponse,
  IMarketBannerTokenListResponse,
  IMarketBasicConfigResponse,
  IMarketChainsResponse,
  IMarketKLineProvider,
  IMarketPerpsTokenListData,
  IMarketPerpsTokenListResponse,
  IMarketStockDetail,
  IMarketStockEventsResponse,
  IMarketStockNewsResponse,
  IMarketStockPublicChartPeriod,
  IMarketStockPublicChartResponse,
  IMarketStockPublicDetail,
  IMarketStockPublicListRequest,
  IMarketStockPublicListResponse,
  IMarketStockPublicSearchRequest,
  IMarketStockTokenVariantsResponse,
  IMarketTokenBatchListResponse,
  IMarketTokenDetailResponse,
  IMarketTokenHoldersResponse,
  IMarketTokenKLineResponse,
  IMarketTokenListItem,
  IMarketTokenListResponse,
  IMarketTokenSecurityBatchResponse,
  IMarketTokenTopLiquidityItem,
  IMarketTokenTopLiquidityResponse,
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
import { hyperLiquidApiClients } from './ServiceHyperLiquid/hyperLiquidApiClients';
import { MOCK_MARKET_BANNER_LIST } from './ServiceMarketV2.const';
import {
  fetchMarketKlineBackfill,
  getMarketKlineHistoryFloor,
} from './utils/marketKlineBackfill';
import {
  type IMarketStockAssetApiData,
  buildMarketStockDetail,
} from './utils/marketStockUtils';
import { resolveMarketTokenDetailRequestTokenAddress } from './utils/marketTokenDetailUtils';

type IMarketTokenListRequestParams = {
  networkId: string;
  sortBy?: string;
  sortType?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  minLiquidity?: number;
  maxLiquidity?: number;
  type?: string;
  category?: string;
  timeFrame?: string;
};

type INormalizedMarketTokenListRequestParams = IMarketTokenListRequestParams & {
  page: number;
  limit: number;
};

type IFetchMarketTokenListOptions = {
  forceRemote?: boolean;
};

type IFetchMarketTokenKlineParams = {
  tokenAddress: string;
  networkId: string;
  provider?: IMarketKLineProvider;
  providerSymbol?: string;
  interval?: string;
  timeFrom?: number;
  timeTo?: number;
  autoHandleError?: boolean;
};

type IFetchMarketTokenKlineByCountParams = IFetchMarketTokenKlineParams & {
  requestId?: string;
  targetCount: number;
  stopAfterCount?: number;
  historyStartTime?: number;
};

const MARKET_KLINE_MAX_TARGET_COUNT = 2000;
const MARKET_KLINE_CANCELLED_REQUEST_TTL_MS = 5 * 60 * 1000;
const MARKET_KLINE_MAX_CANCELLED_REQUESTS = 100;

const HYPERLIQUID_KLINE_INTERVAL_MAP: Record<
  string,
  ICandleSnapshotParameters['interval']
> = {
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '120': '2h',
  '240': '4h',
  '480': '8h',
  '720': '12h',
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '1H': '1h',
  '2h': '2h',
  '2H': '2h',
  '4h': '4h',
  '4H': '4h',
  '8h': '8h',
  '8H': '8h',
  '12h': '12h',
  '12H': '12h',
  '1d': '1d',
  '1D': '1d',
  '3d': '3d',
  '3D': '3d',
  '1w': '1w',
  '1W': '1w',
  '1M': '1M',
};

function normalizeHyperliquidKlineInterval(
  interval?: string,
): ICandleSnapshotParameters['interval'] {
  return HYPERLIQUID_KLINE_INTERVAL_MAP[interval?.trim() || '1m'] ?? '1m';
}

function normalizeMarketKlineTargetCount(targetCount: number) {
  if (!Number.isFinite(targetCount)) {
    return 1;
  }
  return Math.min(
    MARKET_KLINE_MAX_TARGET_COUNT,
    Math.max(1, Math.floor(targetCount)),
  );
}

function isMarketTokenKLineResponse(
  value: unknown,
): value is IMarketTokenKLineResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const response = value as Record<string, unknown>;
  return Array.isArray(response.points) && typeof response.total === 'number';
}

function shouldFallbackMarketKlineByCountRequest(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const httpStatusCode = (error as { httpStatusCode?: unknown }).httpStatusCode;
  if (httpStatusCode === 404) {
    return true;
  }

  // Keep definite server/business failures visible, but preserve chart
  // functionality when the optimized endpoint cannot be reached at all.
  return httpStatusCode === undefined && isTransientNetworkLikeError(error);
}

function getMarketKlineIntervalSeconds(interval?: string) {
  const normalizedInterval = interval?.trim();
  if (!normalizedInterval) {
    return 60;
  }
  if (/^\d+$/.test(normalizedInterval)) {
    return Math.max(1, Number(normalizedInterval)) * 60;
  }

  const match = normalizedInterval.match(/^(\d+)([mMhHdDwWyY])$/);
  if (!match) {
    return 60;
  }

  const value = Math.max(1, Number(match[1]));
  switch (match[2]) {
    case 'm':
      return value * 60;
    case 'h':
    case 'H':
      return value * 60 * 60;
    case 'd':
    case 'D':
      return value * 24 * 60 * 60;
    case 'w':
    case 'W':
      return value * 7 * 24 * 60 * 60;
    case 'M':
      return value * 30 * 24 * 60 * 60;
    case 'y':
    case 'Y':
      return value * 365 * 24 * 60 * 60;
    default:
      return 60;
  }
}

@backgroundClass()
class ServiceMarketV2 extends ServiceBase {
  private readonly cancelledKlineRequestIds = new Map<string, number>();

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    // Drop the in-memory market data cache + memoized batch fetchers on
    // critical memory pressure. These are the largest known per-route
    // cache footprints (token logos + pricing for 218 batch fetches in
    // 27 min in observed sessions).
    //
    // Intentionally NOT clearing memoizedFetchMarketChains /
    // memoizedFetchMarketBasicConfig: both are KB-sized constant configs
    // with a 1 h TTL. Previously these were dropped here too, which made
    // every critical-memory event force a network refetch of small
    // constants — observed as 16+ basicConfig RPCs per 4 min window in
    // iPad logs (cleared 3× by 3 critical warnings, then immediately
    // re-fetched by 5 active components).
    appEventBus.on(EAppEventBusNames.MemoryPressureWarning, (event) => {
      if (event.level !== 'critical') return;
      this._marketTokenBatchCache.clear();
      void this.memoizedFetchMarketTokenList.clear();
      void this.memoizedFetchMarketStockByTicker.clear();
    });
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

  private _marketTokenListCacheTTL = timerUtils.getTimeDurationMs({
    seconds: 20,
  });

  private memoizedFetchMarketStockByTicker = memoizee(
    async (ticker: string, locale: string) => {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const response = await client.get<{
        code: number;
        message: string;
        data?: IMarketStockAssetApiData | null;
      }>('/utility/v1/market/stock', {
        params: {
          ticker,
        },
        headers: {
          'x-onekey-request-currency': 'usd',
          'x-onekey-request-locale': locale,
        },
      });
      const data = response.data?.data;
      return data ? buildMarketStockDetail(data) : undefined;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
      promise: true,
    },
  );

  private _cleanExpiredMarketTokenBatchCache() {
    const now = Date.now();
    for (const [key, value] of this._marketTokenBatchCache) {
      if (now - value.timestamp > this._marketTokenBatchCacheTTL) {
        this._marketTokenBatchCache.delete(key);
      }
    }
  }

  private async _getMarketTokenBatchCacheLocale(requestLocale?: string) {
    let locale = requestLocale?.trim();
    if (!locale) {
      const settings = await settingsPersistAtom.get();
      locale = settings.locale;
    }

    return (locale === 'system' ? getDefaultLocale() : locale).toLowerCase();
  }

  private _normalizeMarketTokenListParams({
    page = 1,
    limit = 20,
    ...rest
  }: IMarketTokenListRequestParams): INormalizedMarketTokenListRequestParams {
    return {
      ...rest,
      page,
      limit,
    };
  }

  private async _fetchMarketTokenListFromApi({
    networkId,
    sortBy,
    sortType,
    page,
    limit,
    minLiquidity,
    maxLiquidity,
    type,
    category,
    timeFrame,
  }: INormalizedMarketTokenListRequestParams) {
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
        type,
        category,
        timeFrame,
        currency: 'usd',
      },
    });
    const { data } = response.data;
    return data;
  }

  private memoizedFetchMarketTokenList = memoizee(
    async (params: INormalizedMarketTokenListRequestParams) =>
      this._fetchMarketTokenListFromApi(params),
    {
      maxAge: this._marketTokenListCacheTTL,
      promise: true,
    },
  );

  @backgroundMethod()
  async fetchMarketTokenDetailByTokenAddress(
    tokenAddress: string,
    networkId: string,
    options?: {
      autoHandleError?: boolean;
      skipConvertCurrency?: boolean;
    },
  ) {
    const selectedCurrencyId = options?.skipConvertCurrency
      ? 'usd'
      : ((await settingsPersistAtom.get()).currencyInfo?.id ?? 'usd');
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const requestTokenAddress =
      await resolveMarketTokenDetailRequestTokenAddress({
        tokenAddress,
        networkId,
        getNativeTokenAddress: (params) =>
          this.backgroundApi.serviceToken.getNativeTokenAddress(params),
      });
    const params: Record<string, string> = {
      tokenAddress: requestTokenAddress,
      networkId,
      currency: 'usd',
    };
    // When the user has selected a non-USD currency, request a converted price
    if (!options?.skipConvertCurrency && selectedCurrencyId !== 'usd') {
      params.convertCurrency = selectedCurrencyId;
    }
    const response = await client.get<IMarketTokenDetailResponse>(
      '/utility/v2/market/token/detail',
      {
        params,
        ...(options?.skipConvertCurrency
          ? { headers: { 'x-onekey-request-currency': 'usd' } }
          : {}),
        ...(options?.autoHandleError === false
          ? { autoHandleError: false }
          : {}),
      },
    );
    return response.data;
  }

  @backgroundMethod()
  async fetchMarketStockByTicker(
    ticker: string,
  ): Promise<IMarketStockDetail | undefined> {
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) {
      return undefined;
    }
    const locale = await this._getMarketTokenBatchCacheLocale();
    const detail = await this.memoizedFetchMarketStockByTicker(
      normalizedTicker,
      locale,
    );
    if (!detail) {
      await this.memoizedFetchMarketStockByTicker.delete(
        normalizedTicker,
        locale,
      );
    }
    return detail;
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
  async fetchMarketTokenList(
    {
      networkId,
      sortBy,
      sortType,
      page = 1,
      limit = 20,
      minLiquidity,
      maxLiquidity,
      type,
      category,
      timeFrame,
    }: IMarketTokenListRequestParams,
    options?: IFetchMarketTokenListOptions,
  ) {
    const normalizedParams = this._normalizeMarketTokenListParams({
      networkId,
      sortBy,
      sortType,
      page,
      limit,
      minLiquidity,
      maxLiquidity,
      type,
      category,
      timeFrame,
    });
    if (options?.forceRemote) {
      return this._fetchMarketTokenListFromApi(normalizedParams);
    }
    return this.memoizedFetchMarketTokenList(normalizedParams);
  }

  private async _fetchMarketTokenKlinePage({
    tokenAddress,
    networkId,
    provider = 'onekey',
    providerSymbol,
    interval,
    timeFrom,
    timeTo,
    autoHandleError,
  }: IFetchMarketTokenKlineParams) {
    if (provider === 'hyperliquid') {
      const coin = providerSymbol?.trim();
      if (!coin) {
        throw new OneKeyLocalError(
          'Hyperliquid market K-line provider symbol is required',
        );
      }

      const startTime = Math.max(0, Math.floor((timeFrom ?? 0) * 1000));
      const endTime = Math.max(
        startTime,
        Math.floor((timeTo ?? Date.now() / 1000) * 1000),
      );
      const candles = await hyperLiquidApiClients.infoClient.candleSnapshot({
        coin,
        interval: normalizeHyperliquidKlineInterval(interval),
        startTime,
        endTime,
      });
      const points = candles.map((candle) => ({
        o: Number(candle.o),
        h: Number(candle.h),
        l: Number(candle.l),
        c: Number(candle.c),
        v: Number(candle.v),
        t: Math.floor(candle.t / 1000),
      }));
      return {
        points,
        total: points.length,
      } satisfies IMarketTokenKLineResponse;
    }

    const innerInterval = normalizeMarketApiKLineInterval(interval);

    const requestConfig = {
      params: {
        tokenAddress,
        networkId,
        interval: innerInterval,
        timeFrom,
        timeTo,
        currency: 'usd',
      },
      ...(autoHandleError === false ? { autoHandleError: false } : {}),
    };

    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketTokenKLineResponse;
    }>('/utility/v2/market/token/kline', requestConfig);
    const { data } = response.data;
    return data;
  }

  @backgroundMethod()
  async fetchMarketTokenKline(params: IFetchMarketTokenKlineParams) {
    return this._fetchMarketTokenKlinePage(params);
  }

  private pruneCancelledKlineRequests(now = Date.now()) {
    for (const [requestId, expiresAt] of this.cancelledKlineRequestIds) {
      if (expiresAt <= now) {
        this.cancelledKlineRequestIds.delete(requestId);
      }
    }

    const overflowCount =
      this.cancelledKlineRequestIds.size - MARKET_KLINE_MAX_CANCELLED_REQUESTS;
    if (overflowCount <= 0) {
      return;
    }
    const requestIds = this.cancelledKlineRequestIds.keys();
    for (let index = 0; index < overflowCount; index += 1) {
      const requestId = requestIds.next().value;
      if (typeof requestId === 'string') {
        this.cancelledKlineRequestIds.delete(requestId);
      }
    }
  }

  private isKlineRequestCancelled(requestId?: string) {
    if (!requestId) {
      return false;
    }
    this.pruneCancelledKlineRequests();
    return this.cancelledKlineRequestIds.has(requestId);
  }

  @backgroundMethod()
  async cancelMarketTokenKlineByCount({ requestId }: { requestId: string }) {
    if (!requestId) {
      return;
    }
    this.pruneCancelledKlineRequests();
    this.cancelledKlineRequestIds.set(
      requestId,
      Date.now() + MARKET_KLINE_CANCELLED_REQUEST_TTL_MS,
    );
    this.pruneCancelledKlineRequests();
  }

  @backgroundMethod()
  async fetchMarketTokenKlineByCount({
    requestId,
    targetCount: rawTargetCount,
    stopAfterCount: rawStopAfterCount,
    historyStartTime,
    ...params
  }: IFetchMarketTokenKlineByCountParams): Promise<IMarketTokenKLineResponse> {
    const targetCount = normalizeMarketKlineTargetCount(rawTargetCount);
    const stopAfterCount = Math.min(
      targetCount,
      normalizeMarketKlineTargetCount(rawStopAfterCount ?? targetCount),
    );
    const intervalSeconds = getMarketKlineIntervalSeconds(params.interval);
    const requestTo = Number.isFinite(params.timeTo)
      ? Math.floor(params.timeTo ?? Date.now() / 1000)
      : Math.floor(Date.now() / 1000);
    const normalizedHistoryStartTime =
      Number.isFinite(historyStartTime) && (historyStartTime ?? 0) >= 0
        ? Math.floor(historyStartTime ?? 0)
        : undefined;

    if (
      normalizedHistoryStartTime !== undefined &&
      normalizedHistoryStartTime >= requestTo
    ) {
      return {
        points: [],
        total: 0,
        historyMeta: {
          noData: true,
          isPartial: false,
          stopReason: 'history_exhausted',
          requestedCount: targetCount,
          returnedCount: 0,
          coveredFrom: requestTo,
          coveredTo: requestTo,
        },
      };
    }

    const historyFloor = getMarketKlineHistoryFloor({
      historyStartTime: normalizedHistoryStartTime,
    });
    const requestedTimeFrom = Number.isFinite(params.timeFrom)
      ? Math.floor(params.timeFrom ?? requestTo)
      : requestTo - intervalSeconds * targetCount;
    const buildCancelledResponse = () =>
      ({
        points: [],
        total: 0,
        historyMeta: {
          noData: false,
          isPartial: true,
          cancelled: true,
          requestedCount: targetCount,
          returnedCount: 0,
          coveredFrom: requestTo,
          coveredTo: requestTo,
        },
      }) satisfies IMarketTokenKLineResponse;

    if (this.isKlineRequestCancelled(requestId)) {
      return buildCancelledResponse();
    }

    const canUseBackendBackfill =
      params.provider !== 'hyperliquid' && stopAfterCount === targetCount;
    if (canUseBackendBackfill) {
      try {
        const client = await this.getClient(EServiceEndpointEnum.Utility);
        const requestConfig = {
          params: {
            tokenAddress: params.tokenAddress,
            networkId: params.networkId,
            interval: normalizeMarketApiKLineInterval(params.interval),
            targetCount,
            timeTo: requestTo,
            historyStartTime: normalizedHistoryStartTime,
            currency: 'usd',
          },
          autoHandleError: false,
        };
        const response = await client.get<{
          code: number;
          message: string;
          data: unknown;
        }>('/utility/v3/market/token/kline', requestConfig);
        if (this.isKlineRequestCancelled(requestId)) {
          return buildCancelledResponse();
        }
        if (isMarketTokenKLineResponse(response.data.data)) {
          return response.data.data;
        }
      } catch (error) {
        if (!shouldFallbackMarketKlineByCountRequest(error)) {
          throw error;
        }
      }
    }

    return fetchMarketKlineBackfill({
      targetCount,
      stopAfterCount,
      intervalSeconds,
      requestTimeFrom: requestedTimeFrom,
      requestTimeTo: requestTo,
      historyFloor,
      fetchPage: ({ timeFrom, timeTo }) =>
        this._fetchMarketTokenKlinePage({
          ...params,
          timeFrom,
          timeTo,
        }),
      isCancelled: () => this.isKlineRequestCancelled(requestId),
    });
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
  async fetchMarketTokenTopLiquidity({
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
      data: IMarketTokenTopLiquidityResponse | IMarketTokenTopLiquidityItem[];
    }>('/utility/v1/market/token/top-liquidity', {
      params: {
        tokenAddress,
        networkId,
      },
    });
    const { data } = response.data;
    if (Array.isArray(data)) {
      return { list: data };
    }
    return data ?? { list: [] };
  }

  @backgroundMethod()
  async fetchMarketTokenListBatch({
    tokenAddressList,
    requestLocale,
    skipCache = false,
  }: {
    tokenAddressList: {
      contractAddress: string;
      chainId: string;
      isNative: boolean;
    }[];
    requestLocale?: string;
    skipCache?: boolean;
  }) {
    // Clean expired cache entries periodically
    this._cleanExpiredMarketTokenBatchCache();

    const now = Date.now();
    const cacheLocale =
      await this._getMarketTokenBatchCacheLocale(requestLocale);
    const cachedResults: IMarketTokenListItem[] = [];
    const missingTokens: typeof tokenAddressList = [];
    const tokenIndexMap = new Map<string, number>();

    // Check cache for each token
    tokenAddressList.forEach((token, index) => {
      const cacheKey = `${cacheLocale}:${
        token.chainId
      }:${token.contractAddress.toLowerCase()}`;
      tokenIndexMap.set(cacheKey, index);

      if (skipCache) {
        missingTokens.push(token);
        return;
      }

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
        headers: {
          'x-onekey-request-currency': 'usd',
          'x-onekey-request-locale': cacheLocale,
        },
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

    // Update cache and merge results using positional index (API preserves
    // request order). Cache keys use the request-side chainId:contractAddress
    // to stay consistent with the lookup keys built above.
    data.list.forEach((item, apiIndex) => {
      const token = missingTokens[apiIndex];
      if (!token) return;
      const cacheKey = `${cacheLocale}:${
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
    const syncCredential =
      await this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();

    const syncItems = (
      await Promise.all(
        watchList.map(async (watchListItem) => {
          return syncManagers.marketWatchList.buildSyncItemByDBQuery({
            syncCredential,
            dbRecord: watchListItem,
            dataTime: undefined,
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
    await this.backgroundApi.localDb.addAndUpdateFreshSyncItems({
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
    throwOnError,
  }: {
    accountAddress: string;
    networkId: string;
    tokenAddress: string;
    xpub?: string;
    throwOnError?: boolean;
  }): Promise<IMarketAccountPortfolioResponse> {
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
      if (throwOnError) {
        throw error;
      }
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
  async fetchMarketStockList(params: IMarketStockPublicListRequest = {}) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const requestConfig: Parameters<typeof client.get>[1] & {
      autoHandleError?: boolean;
    } = {
      params: {
        cursor: params.cursor,
        limit: params.limit ?? 20,
        category: params.category,
        sortBy: params.sortBy ?? 'default',
        sortType: params.sortType ?? 'asc',
      },
      autoHandleError: false,
    };
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketStockPublicListResponse;
    }>('/utility/v1/stocks', requestConfig);
    return response.data.data;
  }

  @backgroundMethod()
  async searchMarketStocks({
    query,
    limit = 20,
  }: IMarketStockPublicSearchRequest) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return { items: [], total: 0 } satisfies IMarketStockPublicListResponse;
    }

    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const requestConfig: Parameters<typeof client.get>[1] & {
      autoHandleError?: boolean;
    } = {
      params: { query: normalizedQuery, limit },
      autoHandleError: false,
    };
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketStockPublicListResponse;
    }>('/utility/v1/stocks/search', requestConfig);
    return response.data.data;
  }

  @backgroundMethod()
  async fetchMarketStockDetail({ stockId }: { stockId: string }) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const requestConfig: Parameters<typeof client.get>[1] & {
      autoHandleError?: boolean;
    } = { autoHandleError: false };
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketStockPublicDetail | null;
    }>(`/utility/v1/stocks/${encodeURIComponent(stockId)}`, requestConfig);
    return response.data.data;
  }

  @backgroundMethod()
  async fetchMarketStockTokenVariants({ stockId }: { stockId: string }) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const requestConfig: Parameters<typeof client.get>[1] & {
      autoHandleError?: boolean;
    } = { autoHandleError: false };
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketStockTokenVariantsResponse;
    }>(
      `/utility/v1/stocks/${encodeURIComponent(stockId)}/tokens`,
      requestConfig,
    );
    return response.data.data;
  }

  @backgroundMethod()
  async fetchMarketStockChart({
    stockId,
    period = '1d',
    points = 100,
  }: {
    stockId: string;
    period?: IMarketStockPublicChartPeriod;
    points?: number;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const requestConfig: Parameters<typeof client.get>[1] & {
      autoHandleError?: boolean;
    } = {
      params: { period, points },
      autoHandleError: false,
    };
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketStockPublicChartResponse;
    }>(
      `/utility/v1/stocks/${encodeURIComponent(stockId)}/chart`,
      requestConfig,
    );
    return response.data.data;
  }

  @backgroundMethod()
  async fetchMarketStockEvents({ stockId }: { stockId: string }) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const requestConfig: Parameters<typeof client.get>[1] & {
      autoHandleError?: boolean;
    } = { autoHandleError: false };
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketStockEventsResponse;
    }>(
      `/utility/v1/stocks/${encodeURIComponent(stockId)}/events`,
      requestConfig,
    );
    return response.data.data;
  }

  @backgroundMethod()
  async fetchMarketStockNews({
    stockId,
    limit = 20,
  }: {
    stockId: string;
    limit?: number;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const requestConfig: Parameters<typeof client.get>[1] & {
      autoHandleError?: boolean;
    } = {
      params: { limit },
      autoHandleError: false,
    };
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketStockNewsResponse;
    }>(`/utility/v1/stocks/${encodeURIComponent(stockId)}/news`, requestConfig);
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
      const favorites = dedupeTokenSelectorFavoriteCoins(current.favorites);
      const hasCoin = favorites.includes(coin);

      if (action === 'add' && !hasCoin) {
        await perpTokenFavoritesPersistAtom.set({
          ...current,
          favorites: [...favorites, coin],
        });
      } else if (action === 'remove' && hasCoin) {
        await perpTokenFavoritesPersistAtom.set({
          ...current,
          favorites: favorites.filter((f) => f !== coin),
        });
      } else if (favorites.length !== current.favorites.length) {
        await perpTokenFavoritesPersistAtom.set({
          ...current,
          favorites,
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
      const dedupedPerpsFavorites = dedupeTokenSelectorFavoriteCoins(
        perpsFavorites.favorites,
      );
      const perpsCoins = new Set(dedupedPerpsFavorites);

      // Market has but Perps doesn't
      const missingInPerps = [...marketPerpsCoins].filter(
        (c) => !perpsCoins.has(c),
      );
      // Perps has but Market doesn't
      const missingInMarket = [...perpsCoins].filter(
        (c) => !marketPerpsCoins.has(c),
      );

      if (
        dedupedPerpsFavorites.length !== perpsFavorites.favorites.length &&
        missingInPerps.length === 0
      ) {
        await perpTokenFavoritesPersistAtom.set({
          ...perpsFavorites,
          favorites: dedupedPerpsFavorites,
        });
      }

      if (missingInPerps.length === 0 && missingInMarket.length === 0) {
        return;
      }

      // Sync missing items to Perps atom
      if (missingInPerps.length > 0) {
        const current = await perpTokenFavoritesPersistAtom.get();
        const favorites = dedupeTokenSelectorFavoriteCoins(current.favorites);
        const existingSet = new Set(favorites);
        const toAdd = missingInPerps.filter((c) => !existingSet.has(c));
        if (toAdd.length > 0) {
          await perpTokenFavoritesPersistAtom.set({
            ...current,
            favorites: [...favorites, ...toAdd],
          });
        } else if (favorites.length !== current.favorites.length) {
          await perpTokenFavoritesPersistAtom.set({
            ...current,
            favorites,
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
