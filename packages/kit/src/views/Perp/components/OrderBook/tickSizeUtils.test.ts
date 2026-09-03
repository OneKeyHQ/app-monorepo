import BigNumber from 'bignumber.js';

import { getDisplayPriceScaleDecimals } from '@onekeyhq/shared/src/utils/perpsUtils';

import {
  buildReferenceTickOptions,
  buildTickOptions,
  getTickOptionsDataDuringTransition,
  shouldSeedOrderBookTickOption,
} from './tickSizeUtils';

describe('getTickOptionsDataDuringTransition', () => {
  const cached = {
    symbol: '@188',
    marker: 'cached',
  };

  it('keeps same-coin precision data while the order book is temporarily empty', () => {
    expect(
      getTickOptionsDataDuringTransition({
        symbol: '@188',
        hasMarketData: false,
        cached,
      }),
    ).toBe(cached);
  });

  it('does not reuse precision data after switching coins', () => {
    const reference = {
      symbol: '@166',
      marker: 'reference',
    };
    expect(
      getTickOptionsDataDuringTransition({
        symbol: '@166',
        hasMarketData: false,
        cached,
        reference,
      }),
    ).toBe(reference);
  });

  it('does not use reference precision from another coin', () => {
    expect(
      getTickOptionsDataDuringTransition({
        symbol: '@166',
        hasMarketData: false,
        cached,
        reference: {
          symbol: '@107',
          marker: 'reference',
        },
      }),
    ).toBeNull();
  });
});

describe('buildReferenceTickOptions', () => {
  it.each([
    {
      name: 'ETH perp',
      price: '4400',
      szDecimals: 4,
      isSpot: false,
      expectedTick: '0.1',
      expectedDecimals: 1,
    },
    {
      name: 'HYPE perp',
      price: '55',
      szDecimals: 2,
      isSpot: false,
      expectedTick: '0.001',
      expectedDecimals: 3,
    },
    {
      name: 'BTC perp',
      price: '114000',
      szDecimals: 5,
      isSpot: false,
      expectedTick: '1',
      expectedDecimals: 0,
    },
    {
      name: 'low price spot',
      price: '0.002699',
      szDecimals: 0,
      isSpot: true,
      expectedTick: '0.0000001',
      expectedDecimals: 7,
    },
  ])(
    'derives the finest full-precision option for $name',
    ({ price, szDecimals, isSpot, expectedTick, expectedDecimals }) => {
      expect(buildReferenceTickOptions).toBeDefined();
      const result = buildReferenceTickOptions({
        symbol: 'TEST',
        price,
        szDecimals,
        isSpot,
      });

      expect(result?.defaultTickOption).toMatchObject({
        value: expectedTick,
        label: expectedTick,
        nSigFigs: null,
      });
      expect(result?.priceDecimals).toBe(expectedDecimals);
    },
  );

  it('does not invent precision without valid reference inputs', () => {
    expect(
      buildReferenceTickOptions({
        symbol: 'ETH',
        price: undefined,
        szDecimals: 4,
        isSpot: false,
      }),
    ).toBeNull();
  });

  it('does not expose spot tick options finer than the protocol decimal limit', () => {
    const result = buildReferenceTickOptions({
      symbol: '@591',
      price: '0.0000004',
      szDecimals: 1,
      isSpot: true,
    });

    expect(result?.tickOptions.map((option) => option.value)).toEqual([
      '0.0000001',
    ]);
  });

  it('formats small tick options without scientific notation', () => {
    const result = buildReferenceTickOptions({
      symbol: 'TEST',
      price: '0.002699',
      szDecimals: 0,
      isSpot: true,
    });

    expect(
      result?.tickOptions.every(
        (option) => !option.label.includes('e') && !option.value.includes('e'),
      ),
    ).toBe(true);
  });
});

describe('shouldSeedOrderBookTickOption', () => {
  const readyToSeed = {
    isReady: true,
    isFallbackList: false,
    hasLoadedPersistedOptions: true,
    hasPersistedOption: false,
  };

  it('seeds a symbol that has no stored option yet', () => {
    expect(shouldSeedOrderBookTickOption(readyToSeed)).toBe(true);
  });

  it('adopts an existing option instead of overwriting it', () => {
    // The whole point of seed-only: a second order book with its own derived
    // list must not fight the value the first one established.
    expect(
      shouldSeedOrderBookTickOption({
        ...readyToSeed,
        hasPersistedOption: true,
      }),
    ).toBe(false);
  });

  it('refuses a fallback-derived list', () => {
    // The fallback builder labels the same tick with a different nSigFigs, and
    // the transition branch can hand one back after szDecimals has arrived.
    expect(
      shouldSeedOrderBookTickOption({ ...readyToSeed, isFallbackList: true }),
    ).toBe(false);
  });

  it('waits for the stored options to load', () => {
    // Seeding is first-write-wins, so a seed that beats the load would replace
    // the user's own choice permanently rather than shadow it.
    expect(
      shouldSeedOrderBookTickOption({
        ...readyToSeed,
        hasLoadedPersistedOptions: false,
      }),
    ).toBe(false);
  });

  it('waits for tick options to be derived at all', () => {
    expect(
      shouldSeedOrderBookTickOption({ ...readyToSeed, isReady: false }),
    ).toBe(false);
  });
});

const fixtures = {
  BTC: {
    price: 114_580.0,
    decimals: 0,
    options: [
      { targetTick: 1, nSigFigs: null, mantissa: null },
      { targetTick: 10, nSigFigs: 5, mantissa: null },
      { targetTick: 20, nSigFigs: 5, mantissa: 2 },
      { targetTick: 50, nSigFigs: 5, mantissa: 5 },
      { targetTick: 100, nSigFigs: 4, mantissa: null },
      { targetTick: 1000, nSigFigs: 3, mantissa: null },
      { targetTick: 10_000, nSigFigs: 2, mantissa: null },
    ],
  },
  ETH: {
    price: 4400.9,
    decimals: 1,
    options: [
      { targetTick: 0.1, nSigFigs: 5, mantissa: null },
      { targetTick: 0.2, nSigFigs: 5, mantissa: 2 },
      { targetTick: 0.5, nSigFigs: 5, mantissa: 5 },
      { targetTick: 1, nSigFigs: 4, mantissa: null },
      { targetTick: 10, nSigFigs: 3, mantissa: null },
      { targetTick: 100, nSigFigs: 2, mantissa: null },
    ],
  },
  SOL: {
    price: 223.24,
    decimals: 2,
    options: [
      { targetTick: 0.01, nSigFigs: 5, mantissa: null },
      { targetTick: 0.02, nSigFigs: 5, mantissa: 2 },
      { targetTick: 0.05, nSigFigs: 5, mantissa: 5 },
      { targetTick: 0.1, nSigFigs: 4, mantissa: null },
      { targetTick: 1, nSigFigs: 3, mantissa: null },
      { targetTick: 10, nSigFigs: 2, mantissa: null },
    ],
  },
  HYPE: {
    price: 55.362,
    decimals: 3,
    options: [
      { targetTick: 0.001, nSigFigs: 5, mantissa: null },
      { targetTick: 0.002, nSigFigs: 5, mantissa: 2 },
      { targetTick: 0.005, nSigFigs: 5, mantissa: 5 },
      { targetTick: 0.01, nSigFigs: 4, mantissa: null },
      { targetTick: 0.1, nSigFigs: 3, mantissa: null },
      { targetTick: 1, nSigFigs: 2, mantissa: null },
    ],
  },
  ATOM: {
    price: 4.6754,
    decimals: 4,
    options: [
      { targetTick: 0.0001, nSigFigs: 5, mantissa: null },
      { targetTick: 0.0002, nSigFigs: 5, mantissa: 2 },
      { targetTick: 0.0005, nSigFigs: 5, mantissa: 5 },
      { targetTick: 0.001, nSigFigs: 4, mantissa: null },
      { targetTick: 0.01, nSigFigs: 3, mantissa: null },
      { targetTick: 0.1, nSigFigs: 2, mantissa: null },
    ],
  },
  MEME: {
    price: 0.002_699,
    decimals: 6,
    options: [
      { targetTick: 0.000_001, nSigFigs: 4, mantissa: null },
      { targetTick: 0.000_01, nSigFigs: 3, mantissa: null },
      { targetTick: 0.0001, nSigFigs: 2, mantissa: null },
    ],
  },
  HMSTR: {
    price: 0.000_749,
    decimals: 6,
    options: [
      { targetTick: 0.000_001, nSigFigs: 3, mantissa: null },
      { targetTick: 0.000_01, nSigFigs: 2, mantissa: null },
    ],
  },
  FLY: {
    price: 0.000_009,
    decimals: 6,
    options: [{ targetTick: 0.000_000_1, nSigFigs: 2, mantissa: null }],
  },
};

describe('fixtures map', () => {
  Object.entries(fixtures).forEach(([symbol, cfg]) => {
    it(`${symbol} options should match fixtures`, () => {
      const priceDecimals = getDisplayPriceScaleDecimals(cfg.price);
      expect(cfg.decimals).toBe(priceDecimals);
      const decimalsArg =
        priceDecimals === 0
          ? 0
          : new BigNumber(10).pow(-priceDecimals).toNumber();
      const built = buildTickOptions(cfg.price, decimalsArg);

      // targetTick sequence should match
      expect(built.map((o) => o.targetTick)).toEqual(
        cfg.options.map((o) => o.targetTick),
      );

      // Validate expected fields when provided (null means skip)
      cfg.options.forEach((expected) => {
        const actual = built.find((o) => o.targetTick === expected.targetTick);
        expect(actual).toBeDefined();
        if (expected.nSigFigs !== null) {
          expect(actual?.nSigFigs).toBe(expected.nSigFigs);
        }
        if (expected.mantissa !== null) {
          expect(actual?.mantissa).toBe(expected.mantissa);
        } else {
          // When expected.mantissa is null, actual.mantissa should be undefined
          expect(actual?.mantissa).toBeUndefined();
        }
      });
    });
  });
});
