import {
  applyMarketTokenListLiveOverrides,
  buildMarketHomeTokenSubscriptions,
  findMatchingSubscription,
} from './useMarketHomeTokenListWebSocket';

import type { IMarketToken } from '../MarketTokenData';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketWS: {},
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    MarketWSDataUpdate: 'MarketWSDataUpdate',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
  },
}));

function buildToken(overrides: Partial<IMarketToken> = {}): IMarketToken {
  return {
    id: 'token-1',
    name: 'Token',
    symbol: 'TOKEN',
    address: '0xabc',
    decimals: 18,
    price: 1,
    change24h: 10,
    marketCap: 100,
    liquidity: 50,
    transactions: 20,
    uniqueTraders: 15,
    holders: 1000,
    turnover: 200,
    tokenImageUri: '',
    networkLogoUri: '',
    networkId: 'evm--1',
    ...overrides,
  };
}

describe('market home token list websocket helpers', () => {
  test('applies external live overrides without a price change base snapshot', () => {
    const token = buildToken({ priceChangeBasePrice: 100 });

    const nextTokens = applyMarketTokenListLiveOverrides({
      tokens: [token],
      liveTokenOverrides: [
        {
          networkId: token.networkId,
          address: token.address,
          price: 2,
          change24h: 20,
        },
      ],
    });

    expect(nextTokens[0].price).toBe(2);
    expect(nextTokens[0].change24h).toBe(20);
  });

  test('keeps stored websocket prices when only the base price snapshot changed', () => {
    const token = buildToken({ priceChangeBasePrice: 100 });
    const storedOverride = {
      networkId: token.networkId,
      address: token.address,
      price: 110,
      change24h: 11.11,
      basePrice: token.price,
      priceChangeBasePrice: 99,
    };

    const nextTokens = applyMarketTokenListLiveOverrides({
      tokens: [token],
      liveTokenOverrides: [storedOverride],
    });

    expect(nextTokens[0].price).toBe(110);
    expect(nextTokens[0].change24h).toBe(10);
  });

  test('keeps the current range change when websocket updates have no base price', () => {
    const token = buildToken({
      change24h: 25,
      priceChangeBasePrice: undefined,
    });
    const storedOverride = {
      networkId: token.networkId,
      address: token.address,
      price: 110,
      change24h: undefined,
      basePrice: token.price,
      priceChangeBasePrice: undefined,
    };

    const nextTokens = applyMarketTokenListLiveOverrides({
      tokens: [token],
      liveTokenOverrides: [storedOverride],
    });

    expect(nextTokens[0].price).toBe(110);
    expect(nextTokens[0].change24h).toBe(25);
  });

  test('builds subscriptions for native tokens with empty addresses', () => {
    const subscriptions = buildMarketHomeTokenSubscriptions({
      tokens: [
        buildToken({
          networkId: 'btc--0',
          address: '',
          symbol: 'BTC',
          isNative: true,
        }),
        buildToken({
          networkId: 'hyperliquid',
          address: 'BTC',
          perpsCoin: 'BTC',
        }),
      ],
    });

    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({
      networkId: 'btc--0',
      address: '',
      symbol: 'BTC',
      chartType: '1m',
      currency: 'usd',
    });
  });

  test('matches native token websocket updates by network id and empty address', () => {
    const subscriptions = buildMarketHomeTokenSubscriptions({
      tokens: [
        buildToken({
          networkId: 'btc--0',
          address: '',
          isNative: true,
        }),
      ],
    });

    const matchedSubscription = findMatchingSubscription({
      subscriptions,
      payload: {
        channel: 'ohlcv',
        tokenAddress: '',
        networkId: 'btc--0',
        data: {
          address: '',
          c: 59_077,
        },
      },
    });

    expect(matchedSubscription).toMatchObject({
      networkId: 'btc--0',
      address: '',
    });
  });
});
