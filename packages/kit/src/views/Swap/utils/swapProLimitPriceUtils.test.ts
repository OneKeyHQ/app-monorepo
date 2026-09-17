import BigNumber from 'bignumber.js';

import { formatSwapProLimitPriceForDisplay } from './swapProLimitPriceUtils';

describe('formatSwapProLimitPriceForDisplay', () => {
  it('limits prices above one to six decimal places', () => {
    expect(
      formatSwapProLimitPriceForDisplay(
        new BigNumber('1881.8826909775116170992'),
      ),
    ).toBe('1881.882691');
  });

  it('keeps significant digits for prices with leading decimal zeros', () => {
    expect(
      formatSwapProLimitPriceForDisplay(new BigNumber('0.000000099312345')),
    ).toBe('0.0000000993123');
  });
});
