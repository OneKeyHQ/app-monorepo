import type { ICurrencyItem } from '@onekeyhq/shared/types';

import {
  compareTradePositionFiatValues,
  hasTradePositionBalance,
  isTradePositionVisible,
} from './tradePositionUtils';

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

describe('compareTradePositionFiatValues', () => {
  it('sorts raw fiat values descending without losing precision', () => {
    const values = ['1.000000000000000001', '20', '1.000000000000000002'];
    expect(values.toSorted(compareTradePositionFiatValues)).toEqual([
      '20',
      '1.000000000000000002',
      '1.000000000000000001',
    ]);
    expect(values[0]).toBe('1.000000000000000001');
  });

  it('treats missing values as zero and retains equal-value order', () => {
    const rows = [
      { id: 'missing', value: undefined },
      { id: 'first', value: '1' },
      { id: 'zero', value: '0' },
      { id: 'second', value: '1' },
    ];
    expect(
      rows
        .toSorted((a, b) => compareTradePositionFiatValues(a.value, b.value))
        .map(({ id }) => id),
    ).toEqual(['first', 'second', 'missing', 'zero']);
  });

  it('does not let unavailable values interrupt descending order', () => {
    const values = ['10', '', '100', 'NaN', 'Infinity', '2'];
    expect(values.toSorted(compareTradePositionFiatValues)).toEqual([
      '100',
      '10',
      '2',
      '',
      'NaN',
      'Infinity',
    ]);
  });
});

describe('hasTradePositionBalance', () => {
  it.each(['0.000000000000000001', '0.00000001', '0.1', '1'])(
    'retains the raw positive balance %s independently of display value',
    (balance) => {
      expect(hasTradePositionBalance(balance)).toBe(true);
    },
  );

  it.each([undefined, '', '0', '-1', 'NaN', 'Infinity'])(
    'rejects the empty or invalid raw balance %s',
    (balance) => {
      expect(hasTradePositionBalance(balance)).toBe(false);
    },
  );
});

describe('isTradePositionVisible', () => {
  it.each([undefined, '', '0', '-1', 'NaN', 'Infinity'])(
    'hides a Stock balance of %s even when its fiat value is positive',
    (balance) => {
      expect(
        isTradePositionVisible({ balance, fiatValue: '100', isStock: true }),
      ).toBe(false);
    },
  );

  it.each([
    ['0', false],
    ['-0.01', false],
    ['0.009999999999999999', false],
    ['0.01', true],
    ['0.010000000000000001', true],
    ['0.1', true],
    ['1', true],
    ['2', true],
  ] as const)(
    'applies the inclusive USD floor to Swap and Stock value %s',
    (fiatValue, expected) => {
      for (const isStock of [false, true]) {
        expect(
          isTradePositionVisible({ balance: '1', fiatValue, isStock }),
        ).toBe(expected);
      }
    },
  );

  it.each([undefined, '', 'NaN', 'Infinity'])(
    'keeps a positive Stock holding with unknown valuation %s',
    (fiatValue) => {
      expect(
        isTradePositionVisible({ balance: '2', fiatValue, isStock: true }),
      ).toBe(true);
      expect(isTradePositionVisible({ balance: '2', fiatValue })).toBe(false);
    },
  );

  it.each([
    ['0.069999999999999999', false],
    ['0.07', true],
    ['0.070000000000000001', true],
  ] as const)(
    'converts CNY %s before comparing with the USD floor',
    (fiatValue, expected) => {
      expect(
        isTradePositionVisible({ fiatValue, currency: 'CNY', currencyMap }),
      ).toBe(expected);
    },
  );

  it('keeps positive non-USD positions until exchange rates are available', () => {
    expect(
      isTradePositionVisible({ fiatValue: '0.001', currency: 'cny' }),
    ).toBe(true);
    expect(isTradePositionVisible({ fiatValue: '0', currency: 'cny' })).toBe(
      false,
    );
  });
});
