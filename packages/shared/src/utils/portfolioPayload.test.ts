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
      totalFiat: '707.004',
      totalTokenCount: 2,
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
      contractAddress: '',
      fiatValue: '7.00',
      iconName: null,
      isAllNetworks: false,
      isNative: true,
      price: 7,
    });
    expect(payload.tokens[1]).toMatchObject({
      contractAddress: '',
      fiatValue: '700.00',
      iconName: null,
      isAllNetworks: false,
      isNative: true,
      price: 700,
    });
    expect(payload.tokens[0]).not.toHaveProperty('icon');
    expect(payload.totalFiat).toBe('707.00');
    expect(payload.otherTokens).toEqual({ count: 0, fiat: '0.00' });
    expect(payload.currency).toBe('cny');
    expect(payload.currencySymbol).toBe('¥');
  });

  test('only marks iconName for allowlisted native and contract tokens', () => {
    const ethNative = buildToken({
      $key: 'eth',
      address: '0xeeee',
      isNative: true,
      name: 'Ethereum',
      networkId: 'evm--1',
      symbol: 'ETH',
    });
    const fakeUsdt = buildToken({
      $key: 'fake-usdt',
      address: '0x0000000000000000000000000000000000000001',
      isNative: false,
      name: 'Tether USD',
      networkId: 'evm--1',
      symbol: 'USDT',
    });
    const realUsdt = buildToken({
      $key: 'real-usdt',
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      isNative: false,
      name: 'Tether USD',
      networkId: 'evm--1',
      symbol: 'USDT',
    });

    const payload = buildPortfolioPayload({
      account: {
        label: 'Account #1',
        addressMasked: '0x12...ab',
      },
      aggregateTokenMap: {},
      currencyMap,
      displayCurrency: { id: 'usd', symbol: '$' },
      totalFiat: '297',
      totalTokenCount: 3,
      timestamp: 1_780_900_000,
      tokenMap: {
        eth: buildFiat({ fiatValue: '100', price: 100 }),
        'fake-usdt': buildFiat({ fiatValue: '99', price: 1 }),
        'real-usdt': buildFiat({ fiatValue: '98', price: 1 }),
      },
      tokens: [ethNative, fakeUsdt, realUsdt],
    });

    expect(payload.tokens.map((token) => token.iconName)).toEqual([
      'ETH',
      null,
      'USDT',
    ]);
    expect(payload.tokens[0]).toMatchObject({
      contractAddress: '',
      isNative: true,
    });
    expect(payload.tokens[1]).toMatchObject({
      contractAddress: '0x0000000000000000000000000000000000000001',
      isNative: false,
    });
    expect(payload.tokens[2]).toMatchObject({
      contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      isNative: false,
    });
  });

  test('keeps chain-native contract addresses when the native coin has one', () => {
    const suiNative = buildToken({
      $key: 'sui',
      address: '0x2::sui::SUI',
      isNative: true,
      name: 'Sui',
      networkId: 'sui--mainnet',
      symbol: 'SUI',
    });
    const aptNative = buildToken({
      $key: 'apt',
      address: '0x1::aptos_coin::AptosCoin',
      isNative: true,
      name: 'Aptos',
      networkId: 'aptos--1',
      symbol: 'APT',
    });

    const payload = buildPortfolioPayload({
      account: {
        label: 'Account #1',
        addressMasked: '0x12...ab',
      },
      aggregateTokenMap: {},
      currencyMap,
      displayCurrency: { id: 'usd', symbol: '$' },
      totalFiat: '199',
      totalTokenCount: 2,
      timestamp: 1_780_900_000,
      tokenMap: {
        apt: buildFiat({ fiatValue: '100', price: 100 }),
        sui: buildFiat({ fiatValue: '99', price: 1 }),
      },
      tokens: [suiNative, aptNative],
    });

    expect(payload.tokens[0]).toMatchObject({
      contractAddress: '0x2::sui::SUI',
      isNative: true,
      networkId: 'sui--mainnet',
    });
    expect(payload.tokens[1]).toMatchObject({
      contractAddress: '0x1::aptos_coin::AptosCoin',
      isNative: true,
      networkId: 'aptos--1',
    });
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
      totalFiat: '1400',
      totalTokenCount: 1,
      timestamp: 1_780_900_000,
      tokenMap: {},
      tokens: [aggregate],
    });

    expect(payload.tokens).toHaveLength(1);
    expect(payload.tokens[0]).toMatchObject({
      balance: '2',
      contractAddress: '',
      fiatValue: '1400.00',
      iconName: 'ETH',
      isAllNetworks: true,
      isNative: false,
      networkId: '',
      price: 700,
    });
  });

  test('uses protocol zero values when token market data is missing', () => {
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
      totalFiat: '101',
      totalTokenCount: 2,
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
    expect(payload.tokens[0].fiatValue).toBe('1.00');
    expect(payload.tokens[1]).toMatchObject({
      change24h: 0,
      fiatValue: '0.00',
      price: 0,
    });
    expect(payload.totalFiat).toBe('101.00');
  });

  test('limits the payload to five tokens and summarizes the remainder', () => {
    const tokens = Array.from({ length: 12 }, (_, index) =>
      buildToken({
        $key: `token-${index}`,
        name: `Token ${index}`,
        symbol: `T${index}`,
      }),
    );
    const tokenMap = Object.fromEntries(
      tokens.map((token, index) => [
        token.$key,
        buildFiat({ fiatValue: String(100 - index), price: 1 }),
      ]),
    );

    const payload = buildPortfolioPayload({
      account: {
        label: 'Account #1',
        addressMasked: '0x12...ab',
      },
      aggregateTokenMap: {},
      currencyMap,
      displayCurrency: { id: 'usd', symbol: '$' },
      totalFiat: '1134',
      totalTokenCount: 12,
      timestamp: 1_780_900_000,
      tokenMap,
      tokens,
    });

    expect(payload.tokens).toHaveLength(5);
    expect(payload.tokenCount).toBe(5);
    expect(payload.tokens.map((token) => token.symbol)).toEqual(
      tokens.slice(0, 5).map((token) => token.symbol),
    );
    expect(payload.otherTokens).toEqual({ count: 7, fiat: '644.00' });
  });

  test('formats fiat and balance precision consistently with the App', () => {
    const token = buildToken({ $key: 'btc', symbol: 'BTC' });
    const payload = buildPortfolioPayload({
      account: {
        label: 'Account #1',
        addressMasked: '0x12...ab',
      },
      aggregateTokenMap: {},
      currencyMap,
      displayCurrency: { id: 'usd', symbol: '$' },
      totalFiat: '27112.105',
      totalTokenCount: 1,
      timestamp: 1_780_900_000,
      tokenMap: {
        btc: buildFiat({
          balanceParsed: '0.41308123',
          fiatValue: '27112.105',
          price: 65_631.11,
        }),
      },
      tokens: [token],
    });

    expect(payload.totalFiat).toBe('27112.11');
    expect(payload.tokens[0]).toMatchObject({
      balance: '0.4131',
      fiatValue: '27112.11',
    });
    expect(payload.otherTokens).toEqual({ count: 0, fiat: '0.00' });
  });

  test('keeps four meaningful balance decimals after leading zeros', () => {
    const token = buildToken({ $key: 'small', symbol: 'SMALL' });
    const payload = buildPortfolioPayload({
      account: {
        label: 'Account #1',
        addressMasked: '0x12...ab',
      },
      aggregateTokenMap: {},
      currencyMap,
      displayCurrency: { id: 'usd', symbol: '$' },
      totalFiat: '0.01',
      totalTokenCount: 1,
      timestamp: 1_780_900_000,
      tokenMap: {
        small: buildFiat({
          balanceParsed: '0.00001234567',
          fiatValue: '0.01',
          price: 1,
        }),
      },
      tokens: [token],
    });

    expect(payload.tokens[0].balance).toBe('0.00001235');
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
      totalFiat: '700',
      totalTokenCount: 1,
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
