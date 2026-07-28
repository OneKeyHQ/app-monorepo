import type { IMarketTokenListResponse } from '@onekeyhq/shared/types/marketV2';

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

type IMarketTokenListResponseWithSource = IMarketTokenListResponse & {
  __fromSeed?: boolean;
  __fromColdCacheFallback?: boolean;
};

type IFetchMarketTokenListForPlatformOptions = {
  forceRemote?: boolean;
};

export type {
  IFetchMarketTokenListForPlatformOptions,
  IMarketTokenListRequestParams,
  IMarketTokenListResponseWithSource,
};
