import {
  hasSufficientRepayFunding,
  repayShortfall,
} from './needActionBalances';

import type { IEModeStep } from './needActionSteps';

function repayStep({
  amountValue = '1',
  decimals = 18,
  hfSafety = false,
}: {
  amountValue?: string;
  decimals?: number;
  hfSafety?: boolean;
} = {}): IEModeStep {
  return {
    kind: 'repay',
    key: 'repay:0xtoken',
    reserveAddress: '0xToken',
    amountValue,
    decimals,
    hfSafety,
  };
}

describe('eMode repay funding', () => {
  it('requires a full-close wallet balance above the debt snapshot', () => {
    const step = repayStep({ amountValue: '1', decimals: 18 });

    expect(hasSufficientRepayFunding({ step, balanceParsed: '1' })).toBe(false);
    expect(repayShortfall({ step, balanceParsed: '1' })).toBe('0.000001');
    expect(
      hasSufficientRepayFunding({
        step,
        balanceParsed: '1.000000000000000001',
      }),
    ).toBe(true);
    expect(
      repayShortfall({
        step,
        balanceParsed: '1.000000000000000001',
      }),
    ).toBeNull();
  });

  it('uses the token atomic unit for the minimum full-close surplus', () => {
    const step = repayStep({ amountValue: '5', decimals: 6 });

    expect(hasSufficientRepayFunding({ step, balanceParsed: '5.000000' })).toBe(
      false,
    );
    expect(repayShortfall({ step, balanceParsed: '5.000000' })).toBe(
      '0.000001',
    );
    expect(hasSufficientRepayFunding({ step, balanceParsed: '5.000001' })).toBe(
      true,
    );
  });

  it('allows an exact balance for a health-factor-only partial repay', () => {
    const step = repayStep({ amountValue: '2', decimals: 6, hfSafety: true });

    expect(hasSufficientRepayFunding({ step, balanceParsed: '2' })).toBe(true);
    expect(repayShortfall({ step, balanceParsed: '2' })).toBeNull();
  });

  it('fails closed for missing or invalid preflight balances', () => {
    const step = repayStep();

    expect(hasSufficientRepayFunding({ step })).toBe(false);
    expect(
      hasSufficientRepayFunding({ step, balanceParsed: 'not-a-number' }),
    ).toBe(false);
    expect(repayShortfall({ step })).toBeNull();
  });
});
