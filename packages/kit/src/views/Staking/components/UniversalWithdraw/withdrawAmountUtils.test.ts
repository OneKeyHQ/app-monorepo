import {
  canContinueWithdrawalAfterApproval,
  getWithdrawApproveAmount,
  getWithdrawEstimateStep,
} from './withdrawAmountUtils';

describe('withdrawal approval continuation', () => {
  it('rechecks the protocol prerequisite after allowance becomes available', async () => {
    const verifyBeforeAction = jest.fn().mockResolvedValue(false);
    await expect(
      canContinueWithdrawalAfterApproval({
        waitForAllowance: async () => true,
        isCurrent: () => true,
        verifyBeforeAction,
      }),
    ).resolves.toBe(false);
    expect(verifyBeforeAction).toHaveBeenCalledTimes(1);
  });

  it('does not continue if the action changes during the prerequisite check', async () => {
    let finish: (result: boolean) => void = () => undefined;
    let current = true;
    const result = canContinueWithdrawalAfterApproval({
      waitForAllowance: async () => true,
      isCurrent: () => current,
      verifyBeforeAction: () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    });
    await Promise.resolve();
    current = false;
    finish(true);
    await expect(result).resolves.toBe(false);
  });

  it('does not recheck or continue after the original allowance wait is invalidated', async () => {
    const verifyBeforeAction = jest.fn().mockResolvedValue(true);
    await expect(
      canContinueWithdrawalAfterApproval({
        waitForAllowance: async () => true,
        isCurrent: () => false,
        verifyBeforeAction,
      }),
    ).resolves.toBe(false);
    expect(verifyBeforeAction).not.toHaveBeenCalled();
  });
});

describe('withdraw amount units and estimate readiness', () => {
  const approveParams = {
    amount: '0.00001',
    withdrawType: 'queued' as const,
    receiptTokenRate: '1000000000000000000000',
    decimals: 18,
    withdrawAll: false,
  };

  it('keeps human share amounts unchanged even when a receipt rate is present', () => {
    expect(
      getWithdrawApproveAmount({ ...approveParams, amountUnit: 'shares' }),
    ).toBe('0.00001');
  });

  it('preserves legacy underlying-to-receipt conversion and rounding', () => {
    expect(getWithdrawApproveAmount(approveParams)).toBe('0.01');
    expect(
      getWithdrawApproveAmount({
        ...approveParams,
        amount: '1',
        receiptTokenRate: '1.5',
        decimals: 0,
      }),
    ).toBe('1');
    expect(
      getWithdrawApproveAmount({
        ...approveParams,
        amount: '1',
        receiptTokenRate: '1.5',
        decimals: 0,
        withdrawAll: true,
      }),
    ).toBe('2');
  });

  const estimateParams = {
    requireConfirmedApproval: true,
    assetsReady: true,
    pathReady: true,
    withdrawType: 'queued' as const,
    allowanceAvailable: true,
    loadingAllowance: false,
    allowance: '0',
    amount: '0.00001',
  };

  it.each([
    { assetsReady: false },
    { pathReady: false },
    { allowanceAvailable: false },
    { loadingAllowance: true },
    { allowance: 'NaN' },
  ])('does not estimate an incomplete share withdrawal: %s', (missing) => {
    expect(
      getWithdrawEstimateStep({ ...estimateParams, ...missing }),
    ).toBeUndefined();
  });

  it('estimates approval until the live share allowance covers the amount', () => {
    expect(getWithdrawEstimateStep(estimateParams)).toEqual({
      action: 'approve',
    });
    expect(
      getWithdrawEstimateStep({ ...estimateParams, allowance: '0.00001' }),
    ).toEqual({ action: 'unstake' });
    expect(
      getWithdrawEstimateStep({ ...estimateParams, allowance: '0.000009' }),
    ).toEqual({ action: 'approve' });
  });

  it('can estimate cancellation without current share metadata, outputs or allowance', () => {
    expect(
      getWithdrawEstimateStep({
        ...estimateParams,
        withdrawType: 'cancel',
        amount: '0',
        assetsReady: false,
        pathReady: false,
        allowanceAvailable: false,
        loadingAllowance: true,
      }),
    ).toEqual({ action: 'unstake' });
  });

  it('does not add readiness requirements without the confirmation policy', () => {
    expect(
      getWithdrawEstimateStep({
        ...estimateParams,
        requireConfirmedApproval: false,
        assetsReady: false,
        pathReady: false,
        allowanceAvailable: false,
      }),
    ).toEqual({ action: 'unstake' });
  });
});
