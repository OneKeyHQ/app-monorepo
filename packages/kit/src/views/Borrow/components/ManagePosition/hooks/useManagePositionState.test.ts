import {
  isSamePositiveAmount,
  resolveBorrowRepayAllBalance,
  resolveRepayAllAmountValue,
} from '../utils';

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

  it('falls back to max amount when repayAll balance is unavailable', () => {
    expect(
      resolveRepayAllAmountValue({
        action: 'repay',
        maxAmountValue: '0.5',
        repayAllBalance: undefined,
      }),
    ).toBe('0.5');
  });

  it('matches wrapped native debt by comparing debt token to wrapped repay token', () => {
    expect(
      resolveBorrowRepayAllBalance({
        repayTokenSymbol: 'ETH',
        borrowedAssets: [
          {
            reserveAddress: '',
            token: {
              address: '',
              symbol: 'WETH',
            },
            borrowedAmount: {
              amount: '1.23',
            },
          },
        ],
      }),
    ).toBe('1.23');
  });

  it('does not match arbitrary W-prefixed token symbols as wrapped native debt', () => {
    expect(
      resolveBorrowRepayAllBalance({
        repayTokenSymbol: 'FOO',
        borrowedAssets: [
          {
            reserveAddress: '',
            token: {
              address: '',
              symbol: 'WFOO',
            },
            borrowedAmount: {
              amount: '1.23',
            },
          },
        ],
      }),
    ).toBeUndefined();
  });

  it('does not infer repayAll balance from display text', () => {
    expect(
      resolveBorrowRepayAllBalance({
        selectedDebtBalance: undefined,
        protocolDebtBalance: undefined,
      }),
    ).toBeUndefined();
  });
});
