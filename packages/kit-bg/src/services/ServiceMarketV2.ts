import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IMarketChainsResponse,
  IMarketTokenDetail,
  IMarketTokenHoldersResponse,
  IMarketTokenKineResponse,
  IMarketTokenListResponse,
  IMarketTokenTransactionsResponse,
} from '@onekeyhq/shared/types/marketV2';

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

  @backgroundMethod()
  async fetchMarketChains() {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      data: IMarketChainsResponse;
    }>('/utility/v2/market/chains');
    const { data } = response.data;
    return data;
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
  async fetchMarketTokenKine({
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
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      code: number;
      message: string;
      data: IMarketTokenKineResponse;
    }>('/utility/v2/market/token/kine', {
      params: {
        tokenAddress,
        networkId,
        interval,
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
}

export default ServiceMarketV2;
