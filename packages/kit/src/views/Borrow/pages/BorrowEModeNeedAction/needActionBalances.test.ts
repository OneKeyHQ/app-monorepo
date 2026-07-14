import {
  balanceLookupAddress,
  formatBalanceDisplay,
  repayShortfall,
} from './needActionBalances';

import type { IEModeStep } from './needActionSteps';

const repayStep = (over: Partial<IEModeStep> = {}): IEModeStep => ({
  kind: 'repay',
  key: 'repay:0xabc',
  reserveAddress: '0xAbC',
  symbol: 'USDG',
  amountValue: '100',
  ...over,
});

describe('balanceLookupAddress', () => {
  it('returns lowercased reserve address for a plain ERC20 repay', () => {
    expect(
      balanceLookupAddress({
        step: repayStep(),
      }),
    ).toBe('0xabc');
  });

  it('keeps the empty native-token sentinel', () => {
    expect(
      balanceLookupAddress({
        step: repayStep({ reserveAddress: '' }),
      }),
    ).toBe('');
  });

  it('returns null for non-repay steps and steps without a reserve', () => {
    expect(
      balanceLookupAddress({
        step: { kind: 'switch', key: 'switch' },
      }),
    ).toBeNull();
    expect(
      balanceLookupAddress({
        step: repayStep({ reserveAddress: undefined }),
      }),
    ).toBeNull();
  });
});

describe('repayShortfall', () => {
  it('null when balance covers the amount', () => {
    expect(
      repayShortfall({ step: repayStep(), balanceParsed: '100' }),
    ).toBeNull();
    expect(
      repayShortfall({ step: repayStep(), balanceParsed: '150.5' }),
    ).toBeNull();
  });

  it('shortfall when balance is short, rounded up at 6dp', () => {
    expect(repayShortfall({ step: repayStep(), balanceParsed: '40' })).toBe(
      '60',
    );
    expect(
      repayShortfall({
        step: repayStep({ amountValue: '1' }),
        balanceParsed: '0.0000001',
      }),
    ).toBe('1'); // 0.9999999 rounds UP to 1 at 6dp
  });

  it('rounds up a shortfall below half a 6dp ulp (ROUND_UP, not HALF_UP)', () => {
    expect(
      repayShortfall({
        step: repayStep({ amountValue: '1' }),
        balanceParsed: '0.9999996',
      }),
    ).toBe('0.000001'); // below half a 6dp ulp; HALF_UP would give '0'
  });

  it('null when balance unknown, amount missing, or values are NaN', () => {
    expect(repayShortfall({ step: repayStep() })).toBeNull();
    expect(
      repayShortfall({
        step: repayStep({ amountValue: undefined }),
        balanceParsed: '0',
      }),
    ).toBeNull();
    expect(
      repayShortfall({ step: repayStep(), balanceParsed: 'oops' }),
    ).toBeNull();
  });

  it('null for non-repay steps', () => {
    expect(
      repayShortfall({
        step: { kind: 'switch', key: 'switch' },
        balanceParsed: '0',
      }),
    ).toBeNull();
  });
});

describe('formatBalanceDisplay', () => {
  it('trims long decimals to 6dp rounding down (never overstates)', () => {
    expect(formatBalanceDisplay('5.2345678911')).toBe('5.234567');
    expect(formatBalanceDisplay('0.9999999')).toBe('0.999999');
  });

  it('passes short values through untouched', () => {
    expect(formatBalanceDisplay('120')).toBe('120');
    expect(formatBalanceDisplay('5.2')).toBe('5.2');
  });

  it('null when unknown or non-numeric', () => {
    expect(formatBalanceDisplay(undefined)).toBeNull();
    expect(formatBalanceDisplay('oops')).toBeNull();
  });
});
