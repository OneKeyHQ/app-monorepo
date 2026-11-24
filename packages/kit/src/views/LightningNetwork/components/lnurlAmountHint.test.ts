import BigNumber from 'bignumber.js';

import { getLnurlAmountHintMax } from './lnurlAmountHint';

const hintMax = (min: number, max: number, walletLimit: number) =>
  getLnurlAmountHintMax({
    minAmount: new BigNumber(min),
    maxAmount: new BigNumber(max),
    walletLimit: new BigNumber(walletLimit),
  });

describe('getLnurlAmountHintMax', () => {
  it('shows the service max when the wallet has no limit, as on self-custody Lightning', () => {
    expect(hintMax(10, 1000, 0)).toBe('1000');
  });

  it('lowers the service max to the wallet limit', () => {
    expect(hintMax(10, 1000, 500)).toBe('500');
  });

  it('keeps the service max below the wallet limit', () => {
    expect(hintMax(10, 1000, 5000)).toBe('1000');
  });

  it('shows the wallet limit for a range whose max is below its min', () => {
    expect(hintMax(100, 10, 50)).toBe('50');
  });
});
