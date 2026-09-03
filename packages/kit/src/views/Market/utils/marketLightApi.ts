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

type IMarketTokenBatchRequestParams = {
  tokenAddressList: {
    contractAddress: string;
    chainId: string;
    isNative: boolean;
  }[];
  requestLocale?: string;
  skipCache?: boolean;
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

const fetchMarketTokenListBatchRemoteLight = memoizee(
  fetchMarketTokenListBatchFromApi,
  {
    maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
    promise: true,
  },
);

const fetchMarketTokenListBatchLight = (
  params: IMarketTokenBatchRequestParams,
) =>
  params.skipCache
    ? fetchMarketTokenListBatchFromApi(params)
    : fetchMarketTokenListBatchRemoteLight(params);

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
