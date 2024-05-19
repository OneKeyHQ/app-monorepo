import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import type {
  IMarketCategory,
  IMarketToken,
  IMarketTokenChart,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import ServiceBase from './ServiceBase';

const getDevHeaders = async () =>
  platformEnv.isDev
    ? {
        'x-proxy': 'http://114.132.73.185',
        ...(await getRequestHeaders()),
      }
    : undefined;

@backgroundClass()
class ServiceMarket extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async fetchCategories() {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: IMarketCategory[];
    }>('/utility/v1/market/category/list', {
      headers: await getDevHeaders(),
    });
    const { code, data } = response.data;
    return code === 0 ? data : [];
  }

  @backgroundMethod()
  async fetchCategory(
    category: string,
    coingeckoIds: string[],
    sparkline: boolean,
  ) {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: IMarketToken[];
    }>('/utility/v1/market/tokens', {
      headers: await getDevHeaders(),
      params: {
        category,
        ids: encodeURI(coingeckoIds.join(',')),
        sparkline,
      },
      paramsSerializer: (params) => {
        const urlSearchParams = new URLSearchParams(params);
        return urlSearchParams.toString();
      },
    });
    const { code, data } = response.data;
    return code === 0 ? data : [];
  }

  @backgroundMethod()
  async fetchTokenDetail(coingeckoId: string, explorerPlatforms = true) {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: IMarketTokenDetail;
    }>('/utility/v1/market/detail', {
      headers: await getDevHeaders(),
      params: {
        id: coingeckoId,
        explorer_platforms: explorerPlatforms,
      },
    });
    const { code, data } = response.data;
    return code === 0 ? data : ({} as IMarketTokenDetail);
  }

  @backgroundMethod()
  async fetchPools(query: string, network: string) {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: IMarketCategory[];
    }>('/utility/v1/market/pools', {
      headers: await getDevHeaders(),
      params: {
        query,
        network,
      },
    });
    const { code, data } = response.data;
    return code === 0 ? data : [];
  }

  @backgroundMethod()
  async fetchTokenChart(coingeckoId: string, days: number, points: number) {
    const client = await this.getClient();
    const response = await client.get<{
      code: number;
      data: IMarketTokenChart;
    }>('/utility/v1/market/token/chart', {
      headers: await getDevHeaders(),
      params: {
        coingeckoId,
        days,
        points,
      },
    });
    const { code, data } = response.data;
    return code === 0 ? data : [];
  }
}

export default ServiceMarket;
