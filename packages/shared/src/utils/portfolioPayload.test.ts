/*
yarn test packages/shared/src/utils/portfolioPayload.test.ts
*/
import {
  buildPortfolioPayload,
  buildPortfolioPayloadHash,
} from './portfolioPayload';

import type { ICurrencyItem } from '../../types/currency';
import type { IAccountToken, ITokenFiat } from '../../types/token';

const currencyMap: Record<string, ICurrencyItem> = {
  usd: { id: 'usd', unit: '$', name: 'US Dollar', type: ['fiat'], value: '1' },
  cny: {
    id: 'cny',
    unit: '¥',
    name: 'Chinese Yuan',
    type: ['fiat'],
    value: '7',
  },
};

function buildToken(params: Partial<IAccountToken>): IAccountToken {
  return {
    $key: params.$key ?? 'eth',
    address: params.address ?? '0xeeee',
    decimals: params.decimals ?? 18,
    isNative: params.isNative ?? true,
    name: params.name ?? 'Ethereum',
    symbol: params.symbol ?? 'ETH',
    ...params,
  };
}

function buildFiat(params: Partial<ITokenFiat>): ITokenFiat {
  return {
    balance: params.balance ?? '1',
    balanceParsed: params.balanceParsed ?? '1',
    fiatValue: params.fiatValue ?? '100',
    price: params.price ?? 100,
    currency: params.currency ?? 'usd',
    ...params,
  };
}

describe('buildPortfolioPayload', () => {
  test('uses the UI token order and converts fiat values to the display currency', () => {
    const lowValueFirst = buildToken({
      $key: 'low',
      symbol: 'LOW',
      name: 'Low Value',
      coingeckoId: 'low-value',
    });
    const highValueSecond = buildToken({
      $key: 'high',
      symbol: 'HIGH',
      name: 'High Value',
      coingeckoId: 'high-value',
    });

    const payload = buildPortfolioPayload({
      account: {
        label: 'Account #1',
        addressMasked: '0x12...ab',
      },
      aggregateTokenMap: {},
      currencyMap,
      displayCurrency: { id: 'cny', symbol: '¥' },
      timestamp: 1_780_900_000,
      tokenMap: {
        low: buildFiat({ fiatValue: '1', price: 1 }),
        high: buildFiat({ fiatValue: '100', price: 100 }),
      },
      tokens: [lowValueFirst, highValueSecond],
    });

    expect(payload.tokens.map((token) => token.symbol)).toEqual([
      'LOW',
      'HIGH',
    ]);
    expect(payload.tokens[0]).toMatchObject({
      fiatValue: '7',
      icon: 'low-value',
      price: 7,
    });
    expect(payload.tokens[1]).toMatchObject({
      fiatValue: '700',
      icon: 'high-value',
      price: 700,
    });
    expect(payload.totalFiat).toBe('707');
    expect(payload.currency).toBe('cny');
    expect(payload.currencySymbol).toBe('¥');
  });

  test('keeps an aggregate token grouped and reads fiat basis from aggregateTokenMap', () => {
    const aggregate = buildToken({
      $key: 'aggregate_ETH_',
      address: 'aggregate_ETH_',
      commonSymbol: 'ETH',
      isAggregateToken: true,
      name: 'Ethereum',
      networkId: 'aggregate',
      symbol: 'ETH',
    });

    const payload = buildPortfolioPayload({
      account: {
        label: 'Account #1',
        addressMasked: '0x12...ab',
      },
      aggregateTokenMap: {
        aggregate_ETH_: buildFiat({
          balanceParsed: '2',
          fiatValue: '200',
          price: 100,
        }),
      },
      currencyMap,
      displayCurrency: { id: 'cny', symbol: '¥' },
      timestamp: 1_780_900_000,
      tokenMap: {},
      tokens: [aggregate],
    });

    expect(payload.tokens).toHaveLength(1);
    expect(payload.tokens[0]).toMatchObject({
      aggregated: true,
      balance: '2',
      fiatValue: '1400',
      networkId: '',
      price: 700,
    });
  });

  test('keeps UI position but emits null fiat and null total when a rate is missing', () => {
    const first = buildToken({ $key: 'first', symbol: 'FIRST' });
    const missingRate = buildToken({ $key: 'missing', symbol: 'MISS' });

    const payload = buildPortfolioPayload({
      account: {
        label: 'Account #1',
        addressMasked: '0x12...ab',
      },
      aggregateTokenMap: {},
      currencyMap,
      displayCurrency: { id: 'eur', symbol: '€' },
      timestamp: 1_780_900_000,
      tokenMap: {
        first: buildFiat({ fiatValue: '1', price: 1, currency: undefined }),
        missing: buildFiat({ fiatValue: '100', price: 100, currency: 'usd' }),
      },
      tokens: [first, missingRate],
    });

    expect(payload.tokens.map((token) => token.symbol)).toEqual([
      'FIRST',
      'MISS',
    ]);
    expect(payload.tokens[0].fiatValue).toBe('1');
    expect(payload.tokens[1].fiatValue).toBeNull();
    expect(payload.tokens[1].price).toBeNull();
    expect(payload.totalFiat).toBeNull();
  });

  test('content hash excludes ts but includes portfolio content', () => {
    const token = buildToken({ $key: 'eth', symbol: 'ETH' });
    const basePayload = buildPortfolioPayload({
      account: {
        label: 'Account #1',
        addressMasked: '0x12...ab',
      },
      aggregateTokenMap: {},
      currencyMap,
      displayCurrency: { id: 'cny', symbol: '¥' },
      timestamp: 1_780_900_000,
      tokenMap: {
        eth: buildFiat({ fiatValue: '100', price: 100 }),
      },
      tokens: [token],
    });

    expect(
      buildPortfolioPayloadHash({
        ...basePayload,
        ts: 1_780_909_999,
      }),
    ).toBe(buildPortfolioPayloadHash(basePayload));
    expect(
      buildPortfolioPayloadHash({
        ...basePayload,
        currency: 'usd',
      }),
    ).not.toBe(buildPortfolioPayloadHash(basePayload));
  });
});
