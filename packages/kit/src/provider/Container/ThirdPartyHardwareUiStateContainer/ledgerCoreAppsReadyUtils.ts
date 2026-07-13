export type IInstallCoreAppsResult =
  | { ok: true }
  | { ok: false; reason: 'installNotCompleted'; error?: Error };

export type IEnsureLedgerCoreAppsReadyResult =
  | { ok: true }
  | { ok: false; reason: 'probeFailed'; error?: Error }
  | { ok: false; reason: 'installNotCompleted'; error?: Error };

export function shouldContinueLedgerAutoCreateForCoreAppsCheckResult(
  result: IEnsureLedgerCoreAppsReadyResult,
): boolean {
  if (result.ok) {
    return true;
  }

  return result.reason === 'probeFailed';
}
