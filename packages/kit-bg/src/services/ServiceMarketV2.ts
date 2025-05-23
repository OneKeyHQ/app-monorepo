import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IMarketChainsResponse,
  IMarketTokenDetail,
  IMarketTokenListResponse,
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
    offset = 0,
    limit = 50,
  }: {
    networkId: string;
    sortBy?: string;
    sortType?: 'asc' | 'desc';
    offset?: number;
    limit?: number;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      data: IMarketTokenListResponse;
    }>('/utility/v2/market/token/list', {
      params: {
        networkId,
        sortBy,
        sortType,
        offset,
        limit,
      },
    });
    const { data } = response.data;
    return data;
  }
}

export default ServiceMarketV2;
