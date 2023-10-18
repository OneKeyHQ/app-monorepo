/* eslint-disable camelcase */
import BigNumber from 'bignumber.js';
import lru from 'tiny-lru';

import type { TokenChartData } from '@onekeyhq/kit/src/store/reducers/tokens';
import { RestfulRequest } from '@onekeyhq/shared/src/request/RestfulRequest';
import type { INetworkPriceConfig } from '@onekeyhq/shared/types';

import { getFiatEndpoint } from './endpoint';
import { getPresetNetworks } from './presets';

const CGK_BATCH_SIZE = 100;
export type ChartQueryParams = {
  networkId: string;
  addresses: string[];
  days?: string;
  vs_currency?: string;
  points?: string;
};

export class PriceController {
  CACHE_DURATION = 1000 * 30;

  cache = lru(300);

  get req() {
    return new RestfulRequest(getFiatEndpoint(), {}, 60 * 1000);
  }

  async fetchApi<T>(path: string, params?: Record<string, string>) {
    const paramsCacheKey = params
      ? Object.values(params).reduce((a, b) => `${a}_${b}`, '')
      : '';
    const cacheKey = `${path.substring(1)}${paramsCacheKey}`;
    let cacheData: { data: any; expiry: number } = this.cache.get(cacheKey);
    let result: T;
    if (cacheData && cacheData.expiry > Date.now()) {
      result = cacheData.data;
    } else {
      result = (await this.req
        .get(path, params)
        .then((res) => res.json())) as T;
      cacheData = { data: result, expiry: Date.now() + this.CACHE_DURATION };
      this.cache.set(cacheKey, cacheData);
    }
    return result;
  }

  async getFiats(): Promise<Record<string, Record<string, any>>> {
    let rates: Record<string, Record<string, any>>;
    try {
      rates = await this.fetchApi<Record<string, Record<string, any>>>(
        '/exchange_rates/vs_currencies',
      );
    } catch (e) {
      return Promise.reject(new Error('Failed to get fiat rates.'));
    }

    if (typeof rates.usd === 'undefined') {
      return Promise.reject(new Error('Failed to get fiat rates.'));
    }
    return rates;
  }

  async getCgkTokensChart({
    networkId,
    addresses,
    days = '1',
    vs_currency = 'usd',
    points,
  }: ChartQueryParams) {
    if (addresses.length > CGK_BATCH_SIZE) {
      return {};
    }
    const ret: Record<string, [number, number][]> = {};

    await Promise.all(
      addresses.map(async (address) => {
        const params: {
          platform: string;
          days: string;
          vs_currency: string;
          points?: string;
          contract?: string;
        } = {
          platform: networkId,
          days,
          vs_currency,
          contract: address,
        };
        if (!address || address === 'main') {
          delete params.contract;
        }
        if (points) {
          params.points = points;
        }
        try {
          const marketData = await this.fetchApi<{
            prices: [number, number][];
          }>(`/market/chart`, params);
          ret[address] = marketData.prices;
          // eslint-disable-next-line no-empty
        } catch {}
      }),
    );
    return ret;
  }

  async getPricesAndCharts(
    networkId: string,
    tokenIdOnNetwork: Array<string>,
    withMain = true,
    vs_currency = 'usd',
  ): Promise<[Record<string, BigNumber>, Record<string, TokenChartData>]> {
    const prices: Record<string, BigNumber> = {};
    const charts: Record<string, TokenChartData> = {};

    const channels: Record<string, INetworkPriceConfig> = (
      getPresetNetworks()[networkId]?.prices || []
    ).reduce((obj, item) => ({ ...obj, [item.channel]: item }), {});
    const cgkChannel = channels.coingecko as {
      channel: string;
      native: string;
      platform: string;
    };
    if (typeof cgkChannel === 'undefined') {
      return [prices, charts];
    }

    if (withMain && typeof cgkChannel.native !== 'undefined') {
      try {
        const response = await this.getCgkTokensChart({
          networkId,
          addresses: ['main'],
          points: '2',
          vs_currency,
        });
        charts.main = response.main;
        if (charts.main) {
          prices.main = new BigNumber(charts.main[charts.main.length - 1][1]);
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (typeof cgkChannel.platform !== 'undefined') {
      const batchSize = CGK_BATCH_SIZE;
      for (let i = 0; i < tokenIdOnNetwork.length; i += batchSize) {
        const batchCharts = await this.getCgkTokensChart({
          networkId,
          addresses: tokenIdOnNetwork.slice(i, i + batchSize),
          points: '2',
          vs_currency,
        });
        Object.keys(batchCharts).forEach((address) => {
          const tempChart = batchCharts[address];
          charts[address] = tempChart;
          prices[address] = new BigNumber(tempChart[tempChart.length - 1][1]);
        });
      }
    }

    return [prices, charts];
  }
}
