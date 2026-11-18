import BigNumber from 'bignumber.js';

import { isBelowMinimumOrderValue } from './minimumOrderGuard';

describe('isBelowMinimumOrderValue', () => {
  it.each(['0.01', '9.4', '9.999999999999999999'])(
    'blocks a positive order value below $10: %s',
    (value) => {
      expect(isBelowMinimumOrderValue(new BigNumber(value))).toBe(true);
    },
  );

  it.each(['10', '10.000000000000000001', '100'])(
    'allows an order value at or above $10: %s',
    (value) => {
      expect(isBelowMinimumOrderValue(new BigNumber(value))).toBe(false);
    },
  );

  it.each(['0', '-1', 'NaN', 'Infinity'])(
    'leaves invalid or empty sizes to their existing validation: %s',
    (value) => {
      expect(isBelowMinimumOrderValue(new BigNumber(value))).toBe(false);
    },
  );

  it('does not report a minimum-order error before the value is available', () => {
    expect(isBelowMinimumOrderValue()).toBe(false);
  });
});
