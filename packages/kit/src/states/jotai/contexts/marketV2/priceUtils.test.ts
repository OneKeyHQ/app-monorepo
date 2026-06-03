import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE } from './constants';
import {
  buildRealtimeTokenDetail,
  getRealtimePriceChange24hPercent,
  getRealtimePriceConverted,
  isMarketTokenDetailMatched,
} from './priceUtils';

function buildTokenDetail(
  overrides: Partial<IMarketTokenDetail> = {},
): IMarketTokenDetail {
  return {
    networkId: 'evm--1',
    isNative: false,
    address: '0xabc',
    logoUrl: '',
    name: 'Test Token',
    symbol: 'TEST',
    decimals: 18,
    price: '100',
    priceConverted: '120',
    priceChange24hPercent: '25',
    ...overrides,
  };
}

describe('marketV2 priceUtils', () => {
  describe('getRealtimePriceConverted', () => {
    it('keeps the base converted-price ratio for realtime price updates', () => {
      expect(
        getRealtimePriceConverted({
          basePrice: '100',
          basePriceConverted: '120',
          realtimePrice: '110',
        }),
      ).toBe('132');
    });

    it('falls back to the existing converted price for invalid ratios', () => {
      expect(
        getRealtimePriceConverted({
          basePrice: '0',
          basePriceConverted: '120',
          realtimePrice: '110',
        }),
      ).toBe('120');
      expect(
        getRealtimePriceConverted({
          basePrice: '100',
          basePriceConverted: 'not-a-number',
          realtimePrice: '110',
        }),
      ).toBe('not-a-number');
    });
  });

  describe('getRealtimePriceChange24hPercent', () => {
    it('recomputes 24h change from the original implied 24h baseline', () => {
      expect(
        getRealtimePriceChange24hPercent({
          basePrice: '100',
          basePriceChange24hPercent: '25',
          realtimePrice: '120',
        }),
      ).toBe('50');
    });

    it('falls back to the existing 24h change for invalid inputs', () => {
      expect(
        getRealtimePriceChange24hPercent({
          basePrice: '0',
          basePriceChange24hPercent: '25',
          realtimePrice: '120',
        }),
      ).toBe('25');
      expect(
        getRealtimePriceChange24hPercent({
          basePrice: '100',
          basePriceChange24hPercent: '25',
          realtimePrice: 'not-a-number',
        }),
      ).toBe('25');
    });

    it('falls back when the original 24h baseline denominator is zero', () => {
      expect(
        getRealtimePriceChange24hPercent({
          basePrice: '100',
          basePriceChange24hPercent: '-100',
          realtimePrice: '120',
        }),
      ).toBe('-100');
    });
  });

  describe('buildRealtimeTokenDetail', () => {
    it('updates realtime fields without dropping existing token metadata', () => {
      const tokenDetail = buildTokenDetail({
        liquidity: '5000',
      });

      expect(
        buildRealtimeTokenDetail({
          tokenDetail,
          realtimePrice: '110',
          realtimePriceSource:
            MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE.marketWs,
          lastUpdated: 123,
        }),
      ).toEqual({
        ...tokenDetail,
        price: '110',
        priceConverted: '132',
        priceChange24hPercent: '37.5',
        realtimePriceSource: MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE.marketWs,
        lastUpdated: 123,
      });
    });

    it('keeps the original 24h baseline across consecutive realtime ticks', () => {
      const firstTick = buildRealtimeTokenDetail({
        tokenDetail: buildTokenDetail({
          price: '100',
          priceConverted: '200',
          priceChange24hPercent: '20',
        }),
        realtimePrice: '120',
        realtimePriceSource:
          MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE.kLinePolling,
        lastUpdated: 123,
      });
      const secondTick = buildRealtimeTokenDetail({
        tokenDetail: firstTick,
        realtimePrice: '130',
        realtimePriceSource:
          MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE.kLinePolling,
        lastUpdated: 456,
      });

      expect(firstTick.priceConverted).toBe('240');
      expect(firstTick.priceChange24hPercent).toBe('44');
      expect(secondTick.priceConverted).toBe('260');
      expect(secondTick.priceChange24hPercent).toBe('56');
    });
  });

  describe('isMarketTokenDetailMatched', () => {
    it('matches token addresses case-insensitively on the same network', () => {
      expect(
        isMarketTokenDetailMatched({
          tokenDetail: buildTokenDetail({
            networkId: 'evm--1',
            address: '0xAbC',
          }),
          networkId: 'evm--1',
          tokenAddress: '0xabc',
        }),
      ).toBe(true);
    });

    it('rejects cross-network token matches even when addresses are equal', () => {
      expect(
        isMarketTokenDetailMatched({
          tokenDetail: buildTokenDetail({
            networkId: 'evm--1',
            address: '0xabc',
          }),
          networkId: 'evm--56',
          tokenAddress: '0xabc',
        }),
      ).toBe(false);
    });

    it('matches native tokens when the selected token has no address', () => {
      expect(
        isMarketTokenDetailMatched({
          tokenDetail: buildTokenDetail({
            networkId: 'evm--1',
            isNative: true,
            address: '',
          }),
          networkId: 'evm--1',
        }),
      ).toBe(true);
    });
  });
});
