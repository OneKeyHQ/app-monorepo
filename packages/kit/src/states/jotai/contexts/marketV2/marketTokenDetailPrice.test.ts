import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import {
  MARKET_CHART_PRICE_STALE_MS,
  getMarketTokenConvertedPrice,
  getMarketTokenPriceConversionRate,
  isMarketChartPriceTarget,
  isSameMarketTokenDetail,
  mergeMarketTokenDetailPrice,
} from './marketTokenDetailPrice';

const initialTime = 1_788_332_400_000;
const detail: IMarketTokenDetail = {
  address: '0xabc',
  networkId: 'evm--1',
  name: 'Test token',
  symbol: 'TEST',
  decimals: 18,
  logoUrl: '',
  price: '1',
};
// A detail initialized from the API without any chart quote yet.
const initialized: IMarketTokenDetail = {
  ...detail,
  detailPriceInitializedAt: initialTime,
  lastUpdated: initialTime,
};
// The same detail after a chart tick took over the quote.
const ticked: IMarketTokenDetail = {
  ...initialized,
  price: '2',
  chartPriceUpdatedAt: initialTime,
};

function merge({
  current,
  tokenData,
  requestStartedAt,
  now = requestStartedAt,
}: {
  current: IMarketTokenDetail | undefined;
  tokenData: Partial<IMarketTokenDetail>;
  requestStartedAt: number;
  now?: number;
}) {
  jest.spyOn(Date, 'now').mockReturnValue(now);
  return mergeMarketTokenDetailPrice({
    currentTokenDetail: current,
    tokenData: { ...detail, ...tokenData },
    requestStartedAt,
  });
}

describe('mergeMarketTokenDetailPrice', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('initializes the quote from the first valid response', () => {
    const result = merge({
      current: undefined,
      tokenData: { price: '2' },
      requestStartedAt: initialTime,
    });
    expect(result).toMatchObject({
      price: '2',
      detailPriceInitializedAt: initialTime,
    });
    expect(result.chartPriceUpdatedAt).toBeUndefined();
    expect(result.priceConversionRate).toBeUndefined();
  });

  it.each(['0', '-1', 'invalid'])(
    'does not start the grace period from an invalid price %s',
    (price) => {
      const result = merge({
        current: undefined,
        tokenData: { price },
        requestStartedAt: initialTime,
      });
      expect(result.detailPriceInitializedAt).toBeUndefined();
    },
  );

  it.each([
    {
      name: 'a refresh inside the initialization grace',
      current: initialized,
      requestStartedAt: initialTime + MARKET_CHART_PRICE_STALE_MS - 1,
    },
    {
      name: 'a refresh inside the chart grace',
      current: ticked,
      requestStartedAt: initialTime + MARKET_CHART_PRICE_STALE_MS - 1,
    },
    {
      name: 'a request started in grace but answered after the feed went stale',
      current: ticked,
      requestStartedAt: initialTime + MARKET_CHART_PRICE_STALE_MS - 1,
      now: initialTime + MARKET_CHART_PRICE_STALE_MS * 2,
    },
    {
      name: 'a request that a chart tick overtook while in flight',
      current: {
        ...ticked,
        chartPriceUpdatedAt: initialTime + MARKET_CHART_PRICE_STALE_MS + 1,
      },
      requestStartedAt: initialTime + MARKET_CHART_PRICE_STALE_MS,
      now: initialTime + MARKET_CHART_PRICE_STALE_MS * 2,
    },
  ])(
    'keeps the current quote and refreshes metadata for $name',
    ({ current, requestStartedAt, now }) => {
      const result = merge({
        current,
        tokenData: { price: '3', volume24h: '30' },
        requestStartedAt,
        now,
      });
      expect(result).toMatchObject({
        price: current.price,
        volume24h: '30',
        lastUpdated: current.lastUpdated,
        detailPriceInitializedAt: initialTime,
      });
      expect(result.chartPriceUpdatedAt).toBe(current.chartPriceUpdatedAt);
    },
  );

  it.each([
    { name: 'a chart that never started', current: initialized },
    { name: 'a chart whose ticks stopped', current: ticked },
  ])(
    'lets detail polls refresh the quote once $name is stale',
    ({ current }) => {
      const requestStartedAt = initialTime + MARKET_CHART_PRICE_STALE_MS;
      const result = merge({
        current,
        tokenData: { price: '3' },
        requestStartedAt,
      });
      expect(result).toMatchObject({
        price: '3',
        lastUpdated: requestStartedAt,
        detailPriceInitializedAt: initialTime,
      });
      // The inactivity clock is not reset, so every later poll may refresh.
      expect(result.chartPriceUpdatedAt).toBe(current.chartPriceUpdatedAt);
      const later = merge({
        current: result,
        tokenData: { price: '4' },
        requestStartedAt: requestStartedAt + 6000,
      });
      expect(later.price).toBe('4');
    },
  );

  it.each(['0', '-1', 'invalid'])(
    'keeps a valid quote when the fallback price is %s',
    (price) => {
      const result = merge({
        current: ticked,
        tokenData: { price, volume24h: '30' },
        requestStartedAt: initialTime + MARKET_CHART_PRICE_STALE_MS,
      });
      expect(result).toMatchObject({
        price: '2',
        volume24h: '30',
        lastUpdated: initialTime,
      });
    },
  );

  it('advances the header cache even when its timestamp is ahead of the clock', () => {
    const now = initialTime + MARKET_CHART_PRICE_STALE_MS;
    const result = merge({
      current: { ...initialized, lastUpdated: now + 1 },
      tokenData: { price: '2' },
      requestStartedAt: now,
    });
    expect(result).toMatchObject({ price: '2', lastUpdated: now + 2 });
  });

  it('does not carry another token over into a fresh initialization', () => {
    const result = merge({
      current: { ...ticked, address: '0xdef' },
      tokenData: { price: '3' },
      requestStartedAt: initialTime,
    });
    expect(result).toMatchObject({
      price: '3',
      detailPriceInitializedAt: initialTime,
    });
    expect(result.chartPriceUpdatedAt).toBeUndefined();
  });

  it('converts a preserved chart price with the refreshed response rate', () => {
    const result = merge({
      current: { ...ticked, priceConversionRate: '7' },
      tokenData: { price: '1.5', priceConverted: '10.65' },
      requestStartedAt: initialTime,
    });
    expect(result).toMatchObject({
      price: '2',
      priceConverted: '14.2',
      priceConversionRate: '7.1',
    });
  });

  it('keeps the previous rate when the fallback price is invalid', () => {
    const result = merge({
      current: { ...ticked, price: '3', priceConversionRate: '7.1' },
      tokenData: { price: '0', priceConverted: '999' },
      requestStartedAt: initialTime,
    });
    expect(result).toMatchObject({
      price: '3',
      priceConverted: '21.3',
      priceConversionRate: '7.1',
    });
  });

  it('drops the rate when the response carries no converted price', () => {
    const result = merge({
      current: { ...ticked, price: '3', priceConversionRate: '7.1' },
      tokenData: { price: '2' },
      requestStartedAt: initialTime,
    });
    expect(result.priceConversionRate).toBeUndefined();
    expect(result.priceConverted).toBeUndefined();
  });
});

describe('price conversion helpers', () => {
  it.each([
    [{ price: '1', priceConverted: '7' }, '7'],
    [{ price: '1.5', priceConverted: '10.65' }, '7.1'],
    [{ price: '0', priceConverted: '7' }, undefined],
    [{ price: '1', priceConverted: '0' }, undefined],
    [{ price: '1' }, undefined],
    [{}, undefined],
  ])('derives the conversion rate of %j as %s', (quote, expected) => {
    expect(getMarketTokenPriceConversionRate(quote)).toBe(expected);
  });

  it.each([
    ['2', '7', '14'],
    ['0.000001', '7', '0.000007'],
    ['2', undefined, undefined],
    ['0', '7', undefined],
    ['invalid', '7', undefined],
  ])('converts %s at rate %s to %s', (price, rate, expected) => {
    expect(getMarketTokenConvertedPrice(price, rate)).toBe(expected);
  });
});

describe('isMarketChartPriceTarget', () => {
  const native: IMarketTokenDetail = {
    ...detail,
    networkId: 'sui--mainnet',
    address: '0x2::sui::SUI',
    isNative: true,
  };

  it.each([
    [
      'the same contract token',
      detail,
      { networkId: 'evm--1', tokenAddress: '0xABC' },
      true,
    ],
    [
      'another contract token',
      detail,
      { networkId: 'evm--1', tokenAddress: '0xdef' },
      false,
    ],
    [
      'another network',
      detail,
      { networkId: 'evm--56', tokenAddress: '0xabc' },
      false,
    ],
    [
      'a native coin whose detail echoes its native address',
      native,
      { networkId: 'sui--mainnet', tokenAddress: '' },
      true,
    ],
    [
      'a native identity flagged only by the store',
      { ...native, isNative: undefined },
      { networkId: 'sui--mainnet', tokenAddress: '', isNative: true },
      true,
    ],
    [
      'an empty address that is not native',
      { ...native, isNative: undefined },
      { networkId: 'sui--mainnet', tokenAddress: '' },
      false,
    ],
  ])('resolves %s', (_name, tokenDetail, identity, expected) => {
    expect(isMarketChartPriceTarget({ tokenDetail, ...identity })).toBe(
      expected,
    );
  });
});

describe('isSameMarketTokenDetail', () => {
  it.each([
    ['a missing detail', undefined, false],
    ['the same token ignoring case', { ...detail, address: '0xABC' }, true],
    ['another address', { ...detail, address: '0xdef' }, false],
    ['another network', { ...detail, networkId: 'evm--56' }, false],
  ])('resolves %s', (_name, tokenDetail, expected) => {
    expect(
      isSameMarketTokenDetail({
        tokenDetail,
        tokenAddress: '0xabc',
        networkId: 'evm--1',
      }),
    ).toBe(expected);
  });
});
