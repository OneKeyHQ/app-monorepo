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
  { data: IMarketTokenListItem; requestSequence: number; timestamp: number }
>();
const marketTokenBatchCacheTTL = timerUtils.getTimeDurationMs({ seconds: 30 });
let marketTokenBatchRequestSequence = 0;

const normalizeMarketTokenBatchAddress = ({
  contractAddress,
  isNative,
}: {
  contractAddress: string;
  isNative: boolean | undefined;
}) => {
  const normalizedIsNative =
    isNative !== undefined ? isNative : contractAddress.length < 30;
  return normalizedIsNative ? '' : contractAddress.toLowerCase();
};

const getMarketTokenBatchCacheKey = ({
  chainId,
  contractAddress,
  isNative,
  requestLocale,
}: {
  chainId: string;
  contractAddress: string;
  isNative: boolean | undefined;
  requestLocale: string;
}) =>
  `${requestLocale}:${chainId}:${normalizeMarketTokenBatchAddress({
    contractAddress,
    isNative,
  })}`;

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

  marketTokenBatchRequestSequence += 1;
  const requestSequence = marketTokenBatchRequestSequence;
  const data = await fetchMarketTokenListBatchFromApi({
    tokenAddressList: missingTokens,
    requestLocale,
  });
  const missingTokenEntries = missingTokens.map((token) => ({
    token,
    cacheKey: getMarketTokenBatchCacheKey({
      chainId: token.chainId,
      contractAddress: token.contractAddress,
      isNative: token.isNative,
      requestLocale,
    }),
  }));
  const unmatchedTokenKeys = new Set(
    missingTokenEntries.map(({ cacheKey }) => cacheKey),
  );
  const missingTokenEntryByKey = new Map(
    missingTokenEntries.map((entry) => [entry.cacheKey, entry]),
  );
  const responseTimestamp = Date.now();
  const cacheMatchedItem = ({
    cacheKey,
    item,
    itemNetworkId,
    itemIsNative,
  }: {
    cacheKey: string;
    item: IMarketTokenListItem;
    itemNetworkId: string;
    itemIsNative: boolean | undefined;
  }) => {
    unmatchedTokenKeys.delete(cacheKey);
    const matchedToken = missingTokenEntryByKey.get(cacheKey)?.token;
    if (!matchedToken) return;
    const normalizedItem: IMarketTokenListItem = {
      ...item,
      networkId: itemNetworkId || matchedToken.chainId,
      isNative: itemIsNative ?? matchedToken.isNative,
    };
    const originalIndex = tokenIndexMap.get(cacheKey);
    const cached = marketTokenBatchCache.get(cacheKey);
    if (cached && cached.requestSequence > requestSequence) {
      if (originalIndex !== undefined) {
        cachedResults[originalIndex] = cached.data;
      }
      return;
    }

    marketTokenBatchCache.set(cacheKey, {
      data: normalizedItem,
      requestSequence,
      timestamp: responseTimestamp,
    });
    if (originalIndex !== undefined) {
      cachedResults[originalIndex] = normalizedItem;
    }
  };
  const anonymousNativeItems: IMarketTokenListItem[] = [];
  data?.list?.forEach((item) => {
    const itemAddress = item?.address ?? '';
    const itemNetworkId = String(item?.networkId || item?.chainId || '');
    const itemIsNative =
      typeof item?.isNative === 'boolean' ? item.isNative : undefined;
    const responseCacheKey = getMarketTokenBatchCacheKey({
      chainId: itemNetworkId,
      contractAddress: itemAddress,
      isNative: itemIsNative,
      requestLocale,
    });
    let cacheKey = unmatchedTokenKeys.has(responseCacheKey)
      ? responseCacheKey
      : undefined;

    if (!cacheKey) {
      const addressCandidates = missingTokenEntries.filter(
        ({ token, cacheKey: key }) =>
          unmatchedTokenKeys.has(key) &&
          (!itemNetworkId || token.chainId === itemNetworkId) &&
          token.contractAddress.toLowerCase() === itemAddress.toLowerCase(),
      );
      if (addressCandidates.length === 1) {
        cacheKey = addressCandidates[0].cacheKey;
      }
    }

    if (!cacheKey) {
      const normalizedItemAddress = normalizeMarketTokenBatchAddress({
        contractAddress: itemAddress,
        isNative: itemIsNative,
      });
      const candidates = missingTokenEntries.filter(
        ({ token, cacheKey: key }) =>
          unmatchedTokenKeys.has(key) &&
          (!itemNetworkId || token.chainId === itemNetworkId) &&
          normalizeMarketTokenBatchAddress({
            contractAddress: token.contractAddress,
            isNative: token.isNative,
          }) === normalizedItemAddress,
      );
      if (candidates.length === 1) {
        cacheKey = candidates[0].cacheKey;
      }
    }

    if (!cacheKey) {
      const normalizedItemAddress = normalizeMarketTokenBatchAddress({
        contractAddress: itemAddress,
        isNative: itemIsNative,
      });
      if (
        !itemNetworkId &&
        itemIsNative !== false &&
        normalizedItemAddress === ''
      ) {
        anonymousNativeItems.push(item);
        return;
      }
    }

    if (!cacheKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(
          '[marketLightApi] fetchMarketTokenListBatchLight: unmatched response row',
          {
            responseId: `${itemNetworkId}:${itemAddress}`,
          },
        );
      }
      return;
    }

    cacheMatchedItem({ cacheKey, item, itemNetworkId, itemIsNative });
  });

  const unmatchedNativeEntries = missingTokenEntries.filter(
    ({ token, cacheKey }) => token.isNative && unmatchedTokenKeys.has(cacheKey),
  );
  if (anonymousNativeItems.length === unmatchedNativeEntries.length) {
    anonymousNativeItems.forEach((item, index) => {
      const entry = unmatchedNativeEntries[index];
      if (!entry) return;
      const itemIsNative =
        typeof item?.isNative === 'boolean' ? item.isNative : undefined;
      cacheMatchedItem({
        cacheKey: entry.cacheKey,
        item,
        itemNetworkId: '',
        itemIsNative,
      });
    });
  } else if (
    anonymousNativeItems.length > 0 &&
    process.env.NODE_ENV !== 'production'
  ) {
    console.error(
      '[marketLightApi] fetchMarketTokenListBatchLight: ambiguous anonymous native response rows',
      {
        requestCount: unmatchedNativeEntries.length,
        responseCount: anonymousNativeItems.length,
      },
    );
  }

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
