import {
  THIRD_PARTY_HW_APP_ALREADY_INSTALLED_CODE,
  THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE,
} from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';

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

/**
 * What the install loop does with a failed app install.
 * - `alreadyInstalled`: the device refused because the app is there. Nothing
 *   to probe for and nothing to retry.
 * - `recoverAndRetry`: only a broken secure channel. The link is fine, the
 *   session is not, so rebuilding it is worth one attempt.
 * - `fail`: everything else. Network and metadata failures need the user to
 *   fix their connection first; device disconnect and user cancel have their
 *   own existing paths.
 */
export type ILedgerInstallFailureAction =
  | 'alreadyInstalled'
  | 'recoverAndRetry'
  | 'fail';

export function resolveLedgerInstallFailureAction({
  code,
  autoRetryUsed,
}: {
  code: number | string | undefined;
  autoRetryUsed: boolean;
}): ILedgerInstallFailureAction {
  if (code === THIRD_PARTY_HW_APP_ALREADY_INSTALLED_CODE) {
    return 'alreadyInstalled';
  }
  if (autoRetryUsed) {
    return 'fail';
  }
  return code === THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE
    ? 'recoverAndRetry'
    : 'fail';
}
