import { isSamePositiveAmount, resolveRepayAllAmountValue } from '../utils';

describe('useManagePositionState utils', () => {
  it('uses full debt balance instead of wallet max balance for repayAll', () => {
    const repayAllAmount = resolveRepayAllAmountValue({
      action: 'repay',
      maxAmountValue: '0.000000000000000001',
      repayAllBalance: '0.000057570716602455',
    });

    expect(repayAllAmount).toBe('0.000057570716602455');
    expect(
      isSamePositiveAmount({
        amount: '0.000000000000000001',
        targetAmount: repayAllAmount,
      }),
    ).toBe(false);
  });

  it('detects repayAll only when the positive amount equals the target amount', () => {
    expect(
      isSamePositiveAmount({
        amount: '0.000057570716602455',
        targetAmount: '0.000057570716602455',
      }),
    ).toBe(true);
    expect(
      isSamePositiveAmount({
        amount: '0',
        targetAmount: '0',
      }),
    ).toBe(false);
  });
});
