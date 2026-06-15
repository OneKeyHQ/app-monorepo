import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

import { convertFiat, convertTokenFiatToCurrency } from './fiatConvert';

const currencyMap: Record<string, ICurrencyItem> = {
  usd: { id: 'usd', unit: '$', name: 'US Dollar', type: ['fiat'], value: '1' },
  cny: {
    id: 'cny',
    unit: '¥',
    name: 'Chinese Yuan',
    type: ['fiat'],
    value: '6.776',
  },
};

function buildTokenFiat(overrides: Partial<ITokenFiat> = {}): ITokenFiat {
  return {
    balance: '207500000000000',
    balanceParsed: '0.0002075',
    fiatValue: '0.343',
    price: 1653.73,
    price24h: -0.01,
    currency: 'usd',
    ...overrides,
  };
}

describe('convertFiat', () => {
  it('converts between currencies via the rate map', () => {
    expect(
      convertFiat({
        value: '100',
        sourceCurrency: 'usd',
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe('677.6');
  });

  it('returns the value unchanged when a rate is missing', () => {
    expect(
      convertFiat({
        value: '100',
        sourceCurrency: 'usd',
        targetCurrency: 'eur',
        currencyMap,
      }),
    ).toBe('100');
  });
});

describe('convertTokenFiatToCurrency', () => {
  it('converts USD-basis fiat fields to the target currency and re-tags', () => {
    const result = convertTokenFiatToCurrency({
      tokenFiat: buildTokenFiat({
        fiatValue: '0.343',
        frozenBalanceFiatValue: '0.1',
        totalBalanceFiatValue: '0.443',
      }),
      targetCurrency: 'cny',
      currencyMap,
    });

    expect(result.price).toBeCloseTo(1653.73 * 6.776, 6);
    expect(result.fiatValue).toBe('2.324168');
    expect(result.frozenBalanceFiatValue).toBe('0.6776');
    expect(result.totalBalanceFiatValue).toBe('3.001768');
    expect(result.currency).toBe('cny');
  });

  it('keeps price a number and string fiat fields strings', () => {
    const result = convertTokenFiatToCurrency({
      tokenFiat: buildTokenFiat(),
      targetCurrency: 'cny',
      currencyMap,
    });
    expect(typeof result.price).toBe('number');
    expect(typeof result.fiatValue).toBe('string');
  });

  it('returns the same reference when the basis already matches', () => {
    const tokenFiat = buildTokenFiat({ currency: 'cny' });
    expect(
      convertTokenFiatToCurrency({
        tokenFiat,
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe(tokenFiat);
  });

  it('returns the same reference when the currency tag is missing', () => {
    // Pre-migration data carries no tag and is already in the then-active
    // display currency — it must pass through untouched.
    const tokenFiat = buildTokenFiat({ currency: undefined });
    expect(
      convertTokenFiatToCurrency({
        tokenFiat,
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe(tokenFiat);
  });

  it('returns the same reference when a rate is missing so the tag stays truthful', () => {
    const tokenFiat = buildTokenFiat();
    const result = convertTokenFiatToCurrency({
      tokenFiat,
      targetCurrency: 'eur',
      currencyMap,
    });
    expect(result).toBe(tokenFiat);
    expect(result.currency).toBe('usd');
  });

  it('returns the same reference when the target rate is zero', () => {
    const mapWithZeroTargetRate: Record<string, ICurrencyItem> = {
      ...currencyMap,
      jpy: {
        id: 'jpy',
        unit: '¥',
        name: 'Japanese Yen',
        type: ['fiat'],
        value: '0',
      },
    };
    const tokenFiat = buildTokenFiat();
    const result = convertTokenFiatToCurrency({
      tokenFiat,
      targetCurrency: 'jpy',
      currencyMap: mapWithZeroTargetRate,
    });
    expect(result).toBe(tokenFiat);
    expect(result.currency).toBe('usd');
  });

  it('leaves non-finite sentinel values untouched', () => {
    // Backend reports "--" for unknown prices; the runtime shape can be a
    // string even though the field is typed number.
    const result = convertTokenFiatToCurrency({
      tokenFiat: buildTokenFiat({
        price: '--' as unknown as number,
        fiatValue: '',
      }),
      targetCurrency: 'cny',
      currencyMap,
    });
    expect(result.price).toBe('--');
    expect(result.fiatValue).toBe('');
    expect(result.currency).toBe('cny');
  });

  it('does not touch the price24h percentage', () => {
    const result = convertTokenFiatToCurrency({
      tokenFiat: buildTokenFiat({ price24h: -0.01 }),
      targetCurrency: 'cny',
      currencyMap,
    });
    expect(result.price24h).toBe(-0.01);
  });

  it('preserves extra properties of the input object', () => {
    const tokenFiat = {
      ...buildTokenFiat(),
      info: { symbol: 'ETH' },
    };
    const result = convertTokenFiatToCurrency({
      tokenFiat,
      targetCurrency: 'cny',
      currencyMap,
    });
    expect(result.info).toEqual({ symbol: 'ETH' });
    expect(result.balanceParsed).toBe('0.0002075');
  });
});
