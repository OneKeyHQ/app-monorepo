import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import { getEndpointByServiceName } from '@onekeyhq/shared/src/config/endpointsMap';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EServiceEndpointEnum,
  type IApiClientResponse,
} from '@onekeyhq/shared/types/endpoint';
import type { IMarketAssetListData } from '@onekeyhq/shared/types/market';
import type {
  IMarketBannerItem,
  IMarketBannerListResponse,
  IMarketBasicConfigResponse,
  IMarketTokenBatchListResponse,
  IMarketTokenBatchRequestParams,
  IMarketTokenListItem,
  IMarketTokenListResponse,
} from '@onekeyhq/shared/types/marketV2';

import {
  type IMarketTokenListResponseWithSource,
  fetchMarketHomeTokenListSeed,
  preloadMarketHomeTokenListSeed,
  shouldUseMarketHomeTokenListBootstrapSeed,
} from './marketHomeTokenListSeed';
import { markMarketPerf } from './marketPerf';

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

type IFetchMarketTokenListLightOptions = {
  forceRemote?: boolean;
};

const getUtilityEndpoint = () =>
  getEndpointByServiceName(EServiceEndpointEnum.Utility);

const getUtilityClient = async () => {
  markMarketPerf('market-light-api-client-start');
  const client = await appApiClient.getClient({
    endpoint: await getUtilityEndpoint(),
    name: EServiceEndpointEnum.Utility,
  });
  markMarketPerf('market-light-api-client-ready');
  return client;
};

const normalizeMarketTokenListParams = ({
  page = 1,
  limit = 20,
  ...rest
}: IMarketTokenListRequestParams): INormalizedMarketTokenListRequestParams => ({
  ...rest,
  page,
  limit,
});

const shouldUseMarketHomeTokenListSeed = ({
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
}: INormalizedMarketTokenListRequestParams) =>
  shouldUseMarketHomeTokenListBootstrapSeed() &&
  networkId === '' &&
  sortBy === 'v24hUSD' &&
  sortType === 'desc' &&
  page === 1 &&
  limit === 20 &&
  minLiquidity === 5000 &&
  maxLiquidity === undefined &&
  type === 'trending' &&
  category === undefined &&
  timeFrame === '2';

const fetchMarketTokenListFromApi = async ({
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
}: INormalizedMarketTokenListRequestParams) => {
  markMarketPerf('market-light-api-token-list-start', {
    networkId,
    sortBy,
    sortType,
    page,
    limit,
    minLiquidity,
    type,
    category,
    timeFrame,
  });
  const client = await getUtilityClient();
  const response = await client.get<
    IApiClientResponse<IMarketTokenListResponse>
  >('/utility/v2/market/token/list', {
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
  const data = response.data.data;
  markMarketPerf('market-light-api-token-list-end', {
    count: data.list.length,
  });
  return data;
};

const fetchMarketTokenListRemoteLight = memoizee(
  async (params: IMarketTokenListRequestParams) =>
    fetchMarketTokenListFromApi(normalizeMarketTokenListParams(params)),
  {
    maxAge: timerUtils.getTimeDurationMs({ seconds: 20 }),
    promise: true,
  },
);

const fetchMarketTokenListLight = async (
  params: IMarketTokenListRequestParams,
  options?: IFetchMarketTokenListLightOptions,
): Promise<IMarketTokenListResponseWithSource> => {
  const normalizedParams = normalizeMarketTokenListParams(params);
  if (
    options?.forceRemote ||
    !shouldUseMarketHomeTokenListSeed(normalizedParams)
  ) {
    return fetchMarketTokenListRemoteLight(normalizedParams);
  }

  const seedPromise = fetchMarketHomeTokenListSeed();
  const remotePromise = fetchMarketTokenListRemoteLight(normalizedParams);
  void remotePromise.catch(() => undefined);

  return seedPromise.catch(() => remotePromise);
};

const fetchMarketAssetListLight = memoizee(
  async ({
    currency = 'usd',
    type = 'top_coins',
    page = 1,
    limit = 100,
  }: {
    currency?: string;
    type?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const client = await getUtilityClient();
    const response = await client.get<IApiClientResponse<IMarketAssetListData>>(
      '/utility/v1/market/asset/list',
      {
        params: {
          currency,
          type,
          page,
          limit,
        },
      },
    );
    return response.data.data;
  },
  {
    maxAge: timerUtils.getTimeDurationMs({ seconds: 20 }),
    promise: true,
  },
);

const fetchMarketTokenListBatchFromApi = async ({
  tokenAddressList,
  requestLocale,
}: IMarketTokenBatchRequestParams) => {
  const client = await getUtilityClient();
  const locale = (requestLocale?.trim() || appLocale.intl.locale).toLowerCase();
  const response = await client.post<
    IApiClientResponse<IMarketTokenBatchListResponse>
  >(
    '/utility/v2/market/token/list/batch',
    {
      tokenAddressList,
      currency: 'usd',
    },
    {
      headers: {
        'x-onekey-request-currency': 'usd',
        'x-onekey-request-locale': locale,
      },
    },
  );
  return response.data.data;
};

const marketTokenBatchCache = new Map<
  string,
  { data: IMarketTokenListItem; timestamp: number }
>();
const marketTokenBatchCacheTTL = timerUtils.getTimeDurationMs({ seconds: 30 });

const getMarketTokenBatchCacheKey = ({
  chainId,
  contractAddress,
  isNative,
  requestLocale,
}: {
  chainId: string;
  contractAddress: string;
  isNative: boolean;
  requestLocale: string;
}) =>
  `${requestLocale}:${chainId}:${isNative ? '' : contractAddress.toLowerCase()}`;

const fetchMarketTokenListBatchLight = async (
  params: IMarketTokenBatchRequestParams,
) => {
  const requestLocale = (
    params.requestLocale?.trim() || appLocale.intl.locale
  ).toLowerCase();
  const now = Date.now();

  for (const [key, value] of marketTokenBatchCache) {
    if (now - value.timestamp > marketTokenBatchCacheTTL) {
      marketTokenBatchCache.delete(key);
    }
  }

  const cachedResults: IMarketTokenListItem[] = [];
  const missingTokens: IMarketTokenBatchRequestParams['tokenAddressList'] = [];
  const tokenIndexMap = new Map<string, number>();

  params.tokenAddressList.forEach((token, index) => {
    const cacheKey = getMarketTokenBatchCacheKey({
      chainId: token.chainId,
      contractAddress: token.contractAddress,
      isNative: token.isNative,
      requestLocale,
    });
    tokenIndexMap.set(cacheKey, index);
    const cached = marketTokenBatchCache.get(cacheKey);
    if (
      !params.skipCache &&
      cached &&
      now - cached.timestamp < marketTokenBatchCacheTTL
    ) {
      cachedResults[index] = cached.data;
    } else {
      missingTokens.push(token);
    }
  });

  if (missingTokens.length === 0) {
    return { list: cachedResults };
  }

  const data = await fetchMarketTokenListBatchFromApi({
    tokenAddressList: missingTokens,
    requestLocale,
  });
  const missingTokenKeys = new Set(
    missingTokens.map((token) =>
      getMarketTokenBatchCacheKey({
        chainId: token.chainId,
        contractAddress: token.contractAddress,
        isNative: token.isNative,
        requestLocale,
      }),
    ),
  );
  data?.list?.forEach((item) => {
    const itemAddress = item?.address ?? '';
    const isNative =
      item?.isNative !== undefined ? item.isNative : itemAddress.length < 30;
    const cacheKey = getMarketTokenBatchCacheKey({
      chainId: item?.networkId || item?.chainId || '',
      contractAddress: itemAddress,
      isNative,
      requestLocale,
    });
    if (!missingTokenKeys.has(cacheKey)) return;
    marketTokenBatchCache.set(cacheKey, { data: item, timestamp: now });
    const originalIndex = tokenIndexMap.get(cacheKey);
    if (originalIndex !== undefined) {
      cachedResults[originalIndex] = item;
    }
  });

  return { list: cachedResults };
};

const fetchMarketBasicConfigLight = memoizee(
  async () => {
    markMarketPerf('market-light-api-basic-config-start');
    const client = await getUtilityClient();
    const response = (
      await client.get<IMarketBasicConfigResponse>(
        '/utility/v2/market/basic-config',
        {
          params: {
            configVersion: 2,
          },
        },
      )
    ).data;
    markMarketPerf('market-light-api-basic-config-end');
    return response;
  },
  {
    maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
    promise: true,
  },
);

const fetchMarketBannerListLight = memoizee(
  async (): Promise<IMarketBannerItem[]> => {
    markMarketPerf('market-light-api-banner-list-start');
    const client = await getUtilityClient();
    const response = await client.get<
      IApiClientResponse<IMarketBannerListResponse>
    >('/utility/v2/market/banner/list');
    const data = response.data.data.data;
    markMarketPerf('market-light-api-banner-list-end', {
      count: data.length,
    });
    return data;
  },
  {
    maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
    promise: true,
  },
);

export {
  fetchMarketAssetListLight,
  fetchMarketBannerListLight,
  fetchMarketBasicConfigLight,
  fetchMarketTokenListBatchLight,
  fetchMarketTokenListLight,
  preloadMarketHomeTokenListSeed,
};
