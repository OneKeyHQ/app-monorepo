import {
  getAuxiliaryLineKind,
  getCompactStepStatus,
  getPrimaryLineKind,
  isStepConfirming,
  normalizeApproveSubStatusForConfirmation,
} from './needActionPresentation';

describe('getCompactStepStatus', () => {
  it('maps completed, failed active, and upcoming rows', () => {
    expect(
      getCompactStepStatus({
        index: 0,
        stepIndex: 1,
        failedKey: null,
        stepKey: 'a',
      }),
    ).toBe('done');
    expect(
      getCompactStepStatus({
        index: 1,
        stepIndex: 1,
        failedKey: 'b',
        stepKey: 'b',
      }),
    ).toBe('failed');
    expect(
      getCompactStepStatus({
        index: 2,
        stepIndex: 1,
        failedKey: null,
        stepKey: 'c',
      }),
    ).toBe('upcoming');
  });
});

describe('getPrimaryLineKind', () => {
  it.each(['preparing', 'approving', 'repaying'] as const)(
    'prioritizes %s over other active-row states',
    (approveSubStatus) => {
      expect(
        getPrimaryLineKind({
          active: true,
          approveSubStatus,
          confirming: true,
          waitingSwitchUnlock: true,
          kind: 'repay',
          hasWalletBalance: true,
        }),
      ).toBe(approveSubStatus);
    },
  );

  it('falls through confirmation, switch unlock, and wallet balance in order', () => {
    expect(
      getPrimaryLineKind({
        active: true,
        approveSubStatus: null,
        confirming: true,
        waitingSwitchUnlock: true,
        kind: 'repay',
        hasWalletBalance: true,
      }),
    ).toBe('confirmation');
    expect(
      getPrimaryLineKind({
        active: true,
        approveSubStatus: null,
        confirming: false,
        waitingSwitchUnlock: true,
        kind: 'switch',
        hasWalletBalance: false,
      }),
    ).toBe('waitingSwitchUnlock');
    expect(
      getPrimaryLineKind({
        active: true,
        approveSubStatus: null,
        confirming: false,
        waitingSwitchUnlock: false,
        kind: 'repay',
        hasWalletBalance: true,
      }),
    ).toBe('walletBalance');
  });

  it('keeps inactive and unsupported rows quiet', () => {
    expect(
      getPrimaryLineKind({
        active: false,
        approveSubStatus: 'repaying',
        confirming: true,
        waitingSwitchUnlock: true,
        kind: 'repay',
        hasWalletBalance: true,
      }),
    ).toBeNull();
    expect(
      getPrimaryLineKind({
        active: true,
        approveSubStatus: null,
        confirming: false,
        waitingSwitchUnlock: false,
        kind: 'removeCollateral',
        hasWalletBalance: true,
      }),
    ).toBeNull();
  });
});

describe('isStepConfirming', () => {
  it('marks a submitted blocker as confirming', () => {
    expect(
      isStepConfirming({
        submittedKey: 'repay:usdc',
        stepKey: 'repay:usdc',
        stepKind: 'repay',
        settlingStepKey: null,
      }),
    ).toBe(true);
  });

  it('marks the final switch as confirming while its broadcast is locked', () => {
    expect(
      isStepConfirming({
        submittedKey: 'switch',
        stepKey: 'switch',
        stepKind: 'switch',
        settlingStepKey: null,
      }),
    ).toBe(true);
  });

  it('does not mark the switch as confirming while the last blocker settles', () => {
    expect(
      isStepConfirming({
        submittedKey: null,
        stepKey: 'switch',
        stepKind: 'switch',
        settlingStepKey: 'repay:usdc',
      }),
    ).toBe(false);
  });

  it('does not mark the final switch as confirming during precheck', () => {
    expect(
      isStepConfirming({
        submittedKey: null,
        stepKey: 'switch',
        stepKind: 'switch',
        settlingStepKey: null,
      }),
    ).toBe(false);
  });

  it('does not let another submitted step confirm the final switch', () => {
    expect(
      isStepConfirming({
        submittedKey: 'repay:usdc',
        stepKey: 'switch',
        stepKind: 'switch',
        settlingStepKey: 'switch',
      }),
    ).toBe(false);
  });
});

describe('normalizeApproveSubStatusForConfirmation', () => {
  it('removes preparing once the same row is confirming', () => {
    expect(
      normalizeApproveSubStatusForConfirmation({
        approveSubStatus: 'preparing',
        confirming: true,
      }),
    ).toBeNull();
  });

  it('preserves preparing during precheck before settlement', () => {
    expect(
      normalizeApproveSubStatusForConfirmation({
        approveSubStatus: 'preparing',
        confirming: false,
      }),
    ).toBe('preparing');
  });
});

describe('getAuxiliaryLineKind', () => {
  it('preserves the collateral warning on any non-done row', () => {
    expect(
      getAuxiliaryLineKind({
        status: 'upcoming',
        kind: 'removeCollateral',
        usdtResetHint: false,
      }),
    ).toBe('lowersHealthFactor');
    expect(
      getAuxiliaryLineKind({
        status: 'active',
        kind: 'removeCollateral',
        usdtResetHint: false,
      }),
    ).toBe('lowersHealthFactor');
    expect(
      getAuxiliaryLineKind({
        status: 'done',
        kind: 'removeCollateral',
        usdtResetHint: false,
      }),
    ).toBeNull();
  });

  it('preserves the USDT reset hint only on the active repay row', () => {
    expect(
      getAuxiliaryLineKind({
        status: 'active',
        kind: 'repay',
        usdtResetHint: true,
      }),
    ).toBe('usdtReset');
    expect(
      getAuxiliaryLineKind({
        status: 'upcoming',
        kind: 'repay',
        usdtResetHint: true,
      }),
    ).toBeNull();
  });
});
