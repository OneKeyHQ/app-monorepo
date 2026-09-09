import { shouldEnableUnifoldLedgerUpdates } from './unifoldExecution';

describe('shouldEnableUnifoldLedgerUpdates', () => {
  it('enables updates when the first poll already returns succeeded', () => {
    expect(
      shouldEnableUnifoldLedgerUpdates({
        previousStatus: undefined,
        nextStatus: 'succeeded',
      }),
    ).toBe(true);
  });

  it('enables updates when an execution transitions to succeeded', () => {
    expect(
      shouldEnableUnifoldLedgerUpdates({
        previousStatus: 'pending',
        nextStatus: 'succeeded',
      }),
    ).toBe(true);
  });

  it('does not re-enable updates for an unchanged or non-success status', () => {
    expect(
      shouldEnableUnifoldLedgerUpdates({
        previousStatus: 'succeeded',
        nextStatus: 'succeeded',
      }),
    ).toBe(false);
    expect(
      shouldEnableUnifoldLedgerUpdates({
        previousStatus: undefined,
        nextStatus: 'pending',
      }),
    ).toBe(false);
  });
});
