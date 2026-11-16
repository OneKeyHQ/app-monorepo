import { getEtherFiWithdrawEstimateAction } from './etherFiWithdrawEstimate';

const ready = {
  isActionDisabled: false,
  isCancel: false,
  hasIdentity: false,
  pathCurrent: true,
  pathDisabled: false,
  withdrawType: 'queued' as const,
  allowanceAvailable: true,
  loadingAllowance: false,
  allowance: '0',
  amount: '0.25',
};

describe('EtherFi withdrawal fee step', () => {
  it('estimates the approval before the selected share allowance is sufficient', () => {
    expect(getEtherFiWithdrawEstimateAction(ready)).toBe('approve');
    expect(
      getEtherFiWithdrawEstimateAction({ ...ready, allowance: '0.25' }),
    ).toBe('unstake');
  });

  it('waits for the current account, withdrawal path and allowance', () => {
    expect(
      getEtherFiWithdrawEstimateAction({ ...ready, isActionDisabled: true }),
    ).toBeUndefined();
    expect(
      getEtherFiWithdrawEstimateAction({ ...ready, pathCurrent: false }),
    ).toBeUndefined();
    expect(
      getEtherFiWithdrawEstimateAction({ ...ready, pathDisabled: true }),
    ).toBeUndefined();
    expect(
      getEtherFiWithdrawEstimateAction({ ...ready, allowanceAvailable: false }),
    ).toBeUndefined();
    expect(
      getEtherFiWithdrawEstimateAction({ ...ready, loadingAllowance: true }),
    ).toBeUndefined();
    expect(
      getEtherFiWithdrawEstimateAction({ ...ready, allowance: 'bad' }),
    ).toBeUndefined();
    expect(
      getEtherFiWithdrawEstimateAction({ ...ready, withdrawType: undefined }),
    ).toBeUndefined();
  });

  it('estimates cancellation without requiring a share allowance', () => {
    expect(
      getEtherFiWithdrawEstimateAction({
        ...ready,
        isCancel: true,
        hasIdentity: true,
        allowanceAvailable: false,
        pathCurrent: false,
      }),
    ).toBe('unstake');
    expect(
      getEtherFiWithdrawEstimateAction({
        ...ready,
        isCancel: true,
        hasIdentity: false,
      }),
    ).toBeUndefined();
  });
});
