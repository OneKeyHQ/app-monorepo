import type { ICurrencyItem } from '@onekeyhq/shared/types';
import { ESwapRateDifferenceUnit } from '@onekeyhq/shared/types/swap/types';

import { buildSwapRateDifference } from './swapRateDifferenceUtils';

const currencyMap: Record<string, ICurrencyItem> = {
  usd: { id: 'usd', unit: '$', name: 'US Dollar', type: ['fiat'], value: '1' },
  cny: {
    id: 'cny',
    unit: '¥',
    name: 'Chinese Yuan',
    type: ['fiat'],
    value: '6.75',
  },
};

describe('buildSwapRateDifference', () => {
  it('rejects invalid stock exchange rates without changing the default Swap behavior', () => {
    const input = {
      fromTokenPrice: '1',
      toTokenPrice: '100',
      fromTokenCurrency: 'usd',
      toTokenCurrency: 'cny',
      instantRate: '0.02',
      currencyMap: { ...currencyMap, cny: { ...currencyMap.cny, value: '0' } },
    };
    expect(
      buildSwapRateDifference({ ...input, strictCurrencyConversion: true }),
    ).toBeUndefined();
    expect(buildSwapRateDifference(input)).toEqual({
      value: '+100.00%',
      unit: ESwapRateDifferenceUnit.POSITIVE,
    });
  });
  it('normalizes mixed fiat price bases before comparing the quote rate', () => {
    const result = buildSwapRateDifference({
      fromTokenPrice: '6.75',
      toTokenPrice: '609.7560975609756',
      toTokenCurrency: 'usd',
      defaultTokenCurrency: 'cny',
      currencyMap,
      instantRate: '0.0016325761663555',
    });

    expect(result).toEqual({
      value: '-0.45%',
      unit: ESwapRateDifferenceUnit.DEFAULT,
    });
  });

  it('does not compare prices when only one side has a known price basis', () => {
    expect(
      buildSwapRateDifference({
        fromTokenPrice: '6.75',
        toTokenPrice: '609.7560975609756',
        toTokenCurrency: 'usd',
        instantRate: '0.0016325761663555',
      }),
    ).toBeUndefined();
  });
});
