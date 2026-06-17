import type { ICurrencyItem } from '@onekeyhq/shared/types';

import { getSwapTokenDisplayFiatValue } from './swapDisplayFiatValue';

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
