import BigNumber from 'bignumber.js';

import { getDisplayPriceScaleDecimals } from '@onekeyhq/shared/src/utils/perpsUtils';

import { buildTickOptions } from './tickSizeUtils';

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
