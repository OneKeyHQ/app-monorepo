import { shouldContinueLedgerAutoCreateForCoreAppsCheckResult } from './ledgerCoreAppsReadyUtils';

describe('shouldContinueLedgerAutoCreateForCoreAppsCheckResult', () => {
  it('continues when core apps are ready', () => {
    expect(
      shouldContinueLedgerAutoCreateForCoreAppsCheckResult({ ok: true }),
    ).toBe(true);
  });

  it('continues when only the installed-app probe failed', () => {
    expect(
      shouldContinueLedgerAutoCreateForCoreAppsCheckResult({
        ok: false,
        reason: 'probeFailed',
      }),
    ).toBe(true);
  });

  it('stops when app installation was not completed', () => {
    expect(
      shouldContinueLedgerAutoCreateForCoreAppsCheckResult({
        ok: false,
        reason: 'installNotCompleted',
      }),
    ).toBe(false);
  });
});
