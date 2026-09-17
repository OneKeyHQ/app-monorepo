import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import {
  THIRD_PARTY_HW_APP_ALREADY_INSTALLED_CODE,
  THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE,
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
 * - `terminal`: the answer is final — the user said no, or the link is gone.
 *   Skip the probe too; it would only add a round trip on a dead session.
 * - `retryOnce`: a broken secure channel. The SDK already cancelled its device
 *   action and opens a fresh websocket per install, so re-issuing the same
 *   call on the same operation is enough. Never more than once.
 * - `probeThenFail`: network and metadata failures. The install may still have
 *   landed, so ask the device before surfacing the error for a manual retry.
 */
export type ILedgerInstallFailureAction =
  | 'alreadyInstalled'
  | 'terminal'
  | 'retryOnce'
  | 'probeThenFail';

const LEDGER_INSTALL_TERMINAL_CODES: ReadonlySet<number> = new Set([
  ThirdPartyHwErrorCode.UserRejected,
  ThirdPartyHwErrorCode.UserAborted,
  ThirdPartyHwErrorCode.DeviceDisconnected,
  ThirdPartyHwErrorCode.OperationTimeout,
  THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE,
]);

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
  const numericCode = typeof code === 'string' ? Number(code) : code;
  if (
    typeof numericCode === 'number' &&
    LEDGER_INSTALL_TERMINAL_CODES.has(numericCode)
  ) {
    return 'terminal';
  }
  if (autoRetryUsed) {
    return 'probeThenFail';
  }
  return code === THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE
    ? 'retryOnce'
    : 'probeThenFail';
}
