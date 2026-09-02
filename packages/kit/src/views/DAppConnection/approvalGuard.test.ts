import { isApprovalAccountSuperseded } from './approvalGuard';

describe('DApp connection approval guard', () => {
  it('blocks approval when the observed account moved on', () => {
    expect(
      isApprovalAccountSuperseded({
        approvingAccountId: 'hd-1--0',
        approvingObservationRevision: 1,
        latestAccountId: 'hd-1--1',
        latestObservationRevision: 2,
      }),
    ).toBe(true);
  });

  it('allows approval when the observed account still matches', () => {
    expect(
      isApprovalAccountSuperseded({
        approvingAccountId: 'hd-1--0',
        approvingObservationRevision: 1,
        latestAccountId: 'hd-1--0',
        latestObservationRevision: 1,
      }),
    ).toBe(false);
  });

  it('blocks approval when the latest observation has no account', () => {
    expect(
      isApprovalAccountSuperseded({
        approvingAccountId: 'hd-1--0',
        approvingObservationRevision: 1,
        latestAccountId: undefined,
        latestObservationRevision: 2,
      }),
    ).toBe(true);
  });

  it('allows a guard call that has no account to approve', () => {
    expect(
      isApprovalAccountSuperseded({
        approvingAccountId: undefined,
        approvingObservationRevision: 1,
        latestAccountId: 'hd-1--0',
        latestObservationRevision: 2,
      }),
    ).toBe(false);
  });

  it('blocks a network-only observation change for the same account', () => {
    expect(
      isApprovalAccountSuperseded({
        approvingAccountId: 'hd-1--0',
        approvingObservationRevision: 1,
        latestAccountId: 'hd-1--0',
        latestObservationRevision: 2,
      }),
    ).toBe(true);
  });
});
