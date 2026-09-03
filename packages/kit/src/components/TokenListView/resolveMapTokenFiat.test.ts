import type { ITokenFiat } from '@onekeyhq/shared/types/token';

import { resolveMapTokenFiat } from './resolveMapTokenFiat';

const heldFiat: ITokenFiat = {
  balance: '2008000',
  balanceParsed: '0.2008',
  fiatValue: '0.2',
  price: 0.999,
  currency: 'usd',
};

const aggregateFiat: ITokenFiat = {
  balance: '0',
  balanceParsed: '0',
  fiatValue: '0',
  price: 1,
  currency: 'usd',
};

describe('resolveMapTokenFiat', () => {
  it('returns the tokenListMap record when present', () => {
    expect(
      resolveMapTokenFiat({
        $key: 'evm--1_usdt',
        tokenListMap: { 'evm--1_usdt': heldFiat },
        aggregateTokenFiatMap: undefined,
        zeroFillMissingFiat: true,
      }),
    ).toBe(heldFiat);
  });

  it('falls back to the aggregate fiat map when tokenListMap misses', () => {
    expect(
      resolveMapTokenFiat({
        $key: 'agg_usdt',
        tokenListMap: {},
        aggregateTokenFiatMap: { agg_usdt: aggregateFiat },
        zeroFillMissingFiat: true,
      }),
    ).toBe(aggregateFiat);
  });

  it('returns undefined for an unknown key when zero-fill is off', () => {
    expect(
      resolveMapTokenFiat({
        $key: 'evm--7560_native',
        tokenListMap: { 'evm--1_usdt': heldFiat },
        aggregateTokenFiatMap: { agg_usdt: aggregateFiat },
        zeroFillMissingFiat: false,
      }),
    ).toBeUndefined();
  });

  it('returns a zero fiat record for an unknown key when zero-fill is on', () => {
    const fiat = resolveMapTokenFiat({
      $key: 'evm--7560_native',
      tokenListMap: { 'evm--1_usdt': heldFiat },
      aggregateTokenFiatMap: { agg_usdt: aggregateFiat },
      zeroFillMissingFiat: true,
    });
    expect(fiat).toBeDefined();
    expect(fiat?.balanceParsed).toBe('0');
    expect(fiat?.fiatValue).toBe('0');
  });

  it('returns the same zero record on every call so field slices stay referentially stable', () => {
    const params = {
      $key: 'evm--7560_native',
      tokenListMap: undefined,
      aggregateTokenFiatMap: undefined,
      zeroFillMissingFiat: true,
    };
    expect(resolveMapTokenFiat(params)).toBe(resolveMapTokenFiat(params));
  });
});
