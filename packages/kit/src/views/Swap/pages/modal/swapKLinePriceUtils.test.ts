import type { ITradingViewPriceUpdateData } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  getNormalizedSwapKLinePrice,
  getSwapKLineDisplayPrice,
  isSwapKLineChartPriceUpdateForToken,
  normalizeSwapKLineChartUpdateTimestamp,
} from './swapKLinePriceUtils';

const createMarketTokenDetail = (price?: string): IMarketTokenDetail => ({
  address: '0xabc',
  logoUrl: '',
  name: 'OneKey',
  symbol: 'ONE',
  decimals: 18,
  price,
});

const createSwapToken = (overrides: Partial<ISwapToken> = {}): ISwapToken => ({
  networkId: 'evm--1',
  contractAddress: '0xabc',
  symbol: 'ONE',
  decimals: 18,
  isNative: false,
  ...overrides,
});

describe('swapKLinePriceUtils', () => {
  describe('getSwapKLineDisplayPrice', () => {
    it('keeps the rendered chart price authoritative over later polling completion time', () => {
      const now = 100_000;

      expect(
        getSwapKLineDisplayPrice({
          tokenMarketDetail: createMarketTokenDetail('100'),
          tokenMarketDetailUpdatedAt: now - 100,
          chartPrice: {
            source: 'realtime',
            sourceKey: 'market:evm--1:0xabc:ONE',
            tokenKey: 'evm--1:0xabc:contract',
            price: '101',
            updatedAt: now - 5000,
          },
          chartSourceKey: 'market:evm--1:0xabc:ONE',
          chartTokenKey: 'evm--1:0xabc:contract',
        }),
      ).toBe('101');
    });

    it('does not let a polling result replace the price still rendered by the chart', () => {
      const now = 100_000;

      expect(
        getSwapKLineDisplayPrice({
          tokenMarketDetail: createMarketTokenDetail('100'),
          tokenMarketDetailUpdatedAt: now - 100,
          tokenUsdFallbackPrice: '99',
          tokenUsdFallbackPriceUpdatedAt: now - 200,
          chartPrice: {
            source: 'history',
            sourceKey: 'market:evm--1:0xabc:ONE',
            tokenKey: 'evm--1:0xabc:contract',
            price: '101',
            updatedAt: 1,
          },
          chartSourceKey: 'market:evm--1:0xabc:ONE',
          chartTokenKey: 'evm--1:0xabc:contract',
        }),
      ).toBe('101');
    });

    it('ignores invalid chart prices and falls back to normalized REST price', () => {
      const now = 100_000;

      expect(
        getSwapKLineDisplayPrice({
          tokenMarketDetail: createMarketTokenDetail('100'),
          tokenMarketDetailUpdatedAt: now - 100,
          chartPrice: {
            source: 'realtime',
            sourceKey: 'market:evm--1:0xabc:ONE',
            tokenKey: 'evm--1:0xabc:contract',
            price: '0',
            updatedAt: now,
          },
          chartSourceKey: 'market:evm--1:0xabc:ONE',
          chartTokenKey: 'evm--1:0xabc:contract',
        }),
      ).toBe('100');
    });

    it.each([
      {
        chartSourceKey: 'market:evm--1:0xdef:ONE',
        chartTokenKey: 'evm--1:0xabc:contract',
      },
      {
        chartSourceKey: 'market:evm--1:0xabc:ONE',
        chartTokenKey: 'evm--1:0xdef:contract',
      },
    ])(
      'rejects a chart price from a stale token or source identity',
      ({ chartSourceKey, chartTokenKey }) => {
        expect(
          getSwapKLineDisplayPrice({
            tokenMarketDetail: createMarketTokenDetail('100'),
            tokenMarketDetailUpdatedAt: 200,
            chartPrice: {
              source: 'realtime',
              sourceKey: 'market:evm--1:0xabc:ONE',
              tokenKey: 'evm--1:0xabc:contract',
              price: '101',
              updatedAt: 300,
            },
            chartSourceKey,
            chartTokenKey,
          }),
        ).toBe('100');
      },
    );
  });

  describe('isSwapKLineChartPriceUpdateForToken', () => {
    it('accepts a matching token address even when symbol casing differs', () => {
      expect(
        isSwapKLineChartPriceUpdateForToken({
          data: {
            networkId: 'evm--1',
            tokenAddress: '0xABC',
            symbol: 'other',
            price: '1',
          },
          token: createSwapToken(),
        }),
      ).toBe(true);
    });

    it('keeps symbol-only updates compatible when the symbol matches', () => {
      expect(
        isSwapKLineChartPriceUpdateForToken({
          data: {
            symbol: ' one ',
            price: '1',
          },
          token: createSwapToken(),
        }),
      ).toBe(true);
    });

    it('keeps native tokens compatible when only network and symbol are present', () => {
      expect(
        isSwapKLineChartPriceUpdateForToken({
          data: {
            networkId: 'evm--1',
            symbol: 'eth',
            price: '1',
          },
          token: createSwapToken({
            contractAddress: '',
            isNative: true,
            symbol: 'ETH',
          }),
        }),
      ).toBe(true);
    });

    it('rejects updates without any token identity fields', () => {
      expect(
        isSwapKLineChartPriceUpdateForToken({
          data: {
            price: '1',
          },
          token: createSwapToken(),
        }),
      ).toBe(false);
    });

    it('rejects network-only updates because they do not identify a token', () => {
      expect(
        isSwapKLineChartPriceUpdateForToken({
          data: {
            networkId: 'evm--1',
            price: '1',
          },
          token: createSwapToken(),
        }),
      ).toBe(false);
    });

    it('rejects updates from another network before checking symbol fallback', () => {
      expect(
        isSwapKLineChartPriceUpdateForToken({
          data: {
            networkId: 'evm--2',
            symbol: 'ONE',
            price: '1',
          },
          token: createSwapToken(),
        }),
      ).toBe(false);
    });
  });

  describe('normalizeSwapKLineChartUpdateTimestamp', () => {
    it('normalizes second timestamps to milliseconds', () => {
      expect(normalizeSwapKLineChartUpdateTimestamp(1_700_000_000)).toBe(
        1_700_000_000_000,
      );
    });

    it('keeps millisecond timestamps unchanged', () => {
      expect(normalizeSwapKLineChartUpdateTimestamp(1_700_000_000_000)).toBe(
        1_700_000_000_000,
      );
    });

    it('uses the fallback time for invalid timestamps', () => {
      expect(normalizeSwapKLineChartUpdateTimestamp(undefined, 123)).toBe(123);
    });
  });

  describe('getNormalizedSwapKLinePrice', () => {
    it('rejects zero, blank, and non-numeric prices', () => {
      const invalidPrices: ITradingViewPriceUpdateData['price'][] = [
        '0',
        ' ',
        'abc',
      ];

      expect(
        invalidPrices.map((price) => getNormalizedSwapKLinePrice(price)),
      ).toEqual([undefined, undefined, undefined]);
    });
  });
});
