import type { ICurrencyItem } from '@onekeyhq/shared/types';

import {
  getSwapTokenDisplayFiatValue,
  getSwapTokenDisplayPrice,
} from './swapDisplayFiatValue';

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

describe('getSwapTokenDisplayFiatValue', () => {
  it.each([undefined, '0', '-1', 'NaN', 'Infinity'])(
    'marks a stock preview value unavailable for a missing or invalid exchange rate %p',
    (rate) => {
      const incompleteMap: Record<string, ICurrencyItem> = {
        usd: currencyMap.usd,
      };
      if (rate !== undefined) {
        incompleteMap.cny = { ...currencyMap.cny, value: rate };
      }
      const result = getSwapTokenDisplayFiatValue({
        token: { price: '0.98', currency: 'usd' },
        amount: '100',
        targetCurrency: 'cny',
        currencyMap: incompleteMap,
        strictCurrencyConversion: true,
      });
      expect(result).toBe('--');
    },
  );

  it('marks a stock preview value unavailable when the source rate is unusable', () => {
    const invalidSource = {
      ...currencyMap,
      usd: { ...currencyMap.usd, value: '0' },
    };
    expect(
      getSwapTokenDisplayFiatValue({
        token: { price: '0.98', currency: 'usd' },
        amount: '100',
        targetCurrency: 'cny',
        currencyMap: invalidSource,
        strictCurrencyConversion: true,
      }),
    ).toBe('--');
  });

  it('preserves normal Swap fallback and a same-currency stock value without rates', () => {
    const params = {
      token: { price: '0.98', currency: 'usd' },
      amount: '100',
      currencyMap: {},
    };
    expect(
      getSwapTokenDisplayFiatValue({ ...params, targetCurrency: 'cny' }),
    ).toBe('98');
    expect(
      getSwapTokenDisplayFiatValue({
        ...params,
        targetCurrency: 'usd',
        strictCurrencyConversion: true,
      }),
    ).toBe('98');
  });

  it('keeps zero as zero without requiring an exchange rate', () => {
    expect(
      getSwapTokenDisplayFiatValue({
        token: { price: '0.98', currency: 'usd' },
        amount: '0',
        targetCurrency: 'cny',
        currencyMap: {},
        strictCurrencyConversion: true,
      }),
    ).toBe('0');
  });

  it('preserves stock fiat precision before converting a small amount', () => {
    const result = getSwapTokenDisplayFiatValue({
      token: { price: '0.98', currency: 'usd' },
      amount: '0.000001',
      targetCurrency: 'cny',
      currencyMap,
      strictCurrencyConversion: true,
    });
    expect(result).toBe('0.00000664048');
    expect(
      getSwapTokenDisplayFiatValue({
        token: { price: '0.98', currency: 'usd' },
        amount: '0.000001',
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe('0');
  });

  it('converts a USD-basis swap token price into the selected currency', () => {
    expect(
      getSwapTokenDisplayFiatValue({
        token: { price: '1', currency: 'usd' },
        amount: '1',
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe('6.776');
  });

  it('keeps untagged token prices in the selected currency basis', () => {
    expect(
      getSwapTokenDisplayFiatValue({
        token: { price: '1' },
        amount: '1',
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe('1');
  });

  it('converts an untagged token price using the provided history source currency', () => {
    expect(
      getSwapTokenDisplayFiatValue({
        token: { price: '1' },
        amount: '2',
        sourceCurrency: 'usd',
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe('13.552');
  });

  it('prefers token currency over the provided history source currency', () => {
    expect(
      getSwapTokenDisplayFiatValue({
        token: { price: '1', currency: 'usd' },
        amount: '2',
        sourceCurrency: 'cny',
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe('13.552');
  });

  it('converts a token unit price into the selected currency', () => {
    expect(
      getSwapTokenDisplayPrice({
        token: { price: '1', currency: 'usd' },
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe('6.776');
  });

  it('does not fabricate a display price when unit price is missing or zero', () => {
    expect(
      getSwapTokenDisplayPrice({
        token: {},
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBeUndefined();
    expect(
      getSwapTokenDisplayPrice({
        token: { price: '0', currency: 'usd' },
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBeUndefined();
  });

  it('returns zero for missing or unusable token prices', () => {
    expect(
      getSwapTokenDisplayFiatValue({
        token: { price: '--', currency: 'usd' },
        amount: '1',
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe('0');
  });
});
