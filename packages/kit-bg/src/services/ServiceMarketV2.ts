import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IMarketChainsResponse,
  IMarketTokenDetail,
  IMarketTokenListResponse,
  IMarketTokenSecurity,
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
  }: {
    networkId: string;
    sortBy?: string;
    sortType?: 'asc' | 'desc';
    page?: number;
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
        page,
        limit,
      },
    });
    const { data } = response.data;
    return data;
  }

  /**
   * Fetch token security information for a given token address and network
   * @param tokenAddress - The token contract address
   * @param networkId - The network ID where the token exists
   * @returns Promise<IMarketTokenSecurity> - Token security analysis data
   *
   * @example
   * ```typescript
   * const security = await backgroundApiProxy.serviceMarketV2.fetchMarketTokenSecurity(
   *   '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', // SHIB token address
   *   'evm--1' // Ethereum mainnet
   * );
   * console.log('Is honeypot:', security.isHoneypot === '1');
   * console.log('Buy tax:', security.buyTax);
   * console.log('Sell tax:', security.sellTax);
   * ```
   */
  @backgroundMethod()
  async fetchMarketTokenSecurity(tokenAddress: string, networkId: string) {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      data: IMarketTokenSecurity;
    }>('/utility/v2/market/token/security', {
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
