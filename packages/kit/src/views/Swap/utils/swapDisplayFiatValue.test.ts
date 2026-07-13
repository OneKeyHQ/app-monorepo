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
