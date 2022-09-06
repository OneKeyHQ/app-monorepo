/* eslint-disable camelcase */
import { RestfulRequest } from '@onekeyfe/blockchain-libs/dist/basic/request/restful';
import BigNumber from 'bignumber.js';
import lru from 'tiny-lru';

import { TokenChartData } from '@onekeyhq/kit/src/store/reducers/tokens';

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
    return new RestfulRequest(getFiatEndpoint());
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

  async getFiats(fiats: Set<string>): Promise<Record<string, BigNumber>> {
    const ret: Record<string, BigNumber> = { 'usd': new BigNumber('1') };
    let rates: Record<string, { value: number }>;
    try {
      const res = await this.fetchApi<{
        rates: Record<string, { value: number }>;
      }>('/exchange_rates');
      rates = res.rates;
    } catch (e) {
      console.error(e);
      return Promise.reject(new Error('Failed to get fiat rates.'));
    }

    if (typeof rates.usd === 'undefined') {
      return Promise.reject(new Error('Failed to get fiat rates.'));
    }

    const btcToUsd = new BigNumber(rates.usd.value);
    ret.btc = new BigNumber(1).div(btcToUsd);
    fiats.forEach((fiat) => {
      if (fiat !== 'usd' && typeof rates[fiat] !== 'undefined') {
        ret[fiat] = new BigNumber(rates[fiat].value).div(btcToUsd);
      }
    });
    return ret;
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

    try {
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
          const marketData = await this.fetchApi<{
            prices: [number, number][];
          }>(`/market/chart`, params);
          ret[address] = marketData.prices;
        }),
      );
    } catch (e) {
      console.error(e);
    }
    return ret;
  }

  async getPricesAndCharts(
    networkId: string,
    tokenIdOnNetwork: Array<string>,
    withMain = true,
  ): Promise<[Record<string, BigNumber>, Record<string, TokenChartData>]> {
    const prices: Record<string, BigNumber> = {};
    const charts: Record<string, TokenChartData> = {};

    const channels = (getPresetNetworks()[networkId]?.prices || []).reduce(
      (obj, item) => ({ ...obj, [item.channel]: item }),
      {},
    );
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
        });
        charts.main = response.main;
        prices.main = new BigNumber(charts.main[charts.main.length - 1][1]);
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
