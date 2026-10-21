import { isZcashTexAddress } from '@onekeyhq/core/src/chains/zcash/sdkZcash';
import { readZcashRuntimeError } from '@onekeyhq/core/src/chains/zcash/sdkZcash/runtimeError';
import type {
  IZcashHistoryItem,
  IZcashSpendSource,
  IZcashTransparentOutpoint,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { localWalletText } from '../../localWallet/messages';

// ZIP-317 fee (display estimate); pczt_create computes the exact fee.
export const ZCASH_DISPLAY_FEE_ZAT = '10000';

export const ZCASH_TRANSPARENT_PATH_RE =
  /^m\/44'\/133'\/(\d+)'\/([01])\/(\d+)$/;

export const ZCASH_TRANSPARENT_P2PKH_SCRIPT_RE = /^76a914[0-9a-f]{40}88ac$/i;

// A 4xx can follow a successful upstream submission -- it doesn't prove
// the node rejected the tx. Surface the server's own reason text too.
export function describeZcashBroadcastFailure(e: unknown): {
  reason?: string;
  serverCode?: number;
  httpStatusCode?: number;
} {
  if (!e || typeof e !== 'object') {
    return {};
  }
  const err = e as {
    message?: unknown;
    code?: unknown;
    httpStatusCode?: unknown;
  };
  const serverCode = typeof err.code === 'number' ? err.code : undefined;
  const httpStatusCode =
    typeof err.httpStatusCode === 'number' ? err.httpStatusCode : undefined;
  const raw = typeof err.message === 'string' ? err.message.trim() : '';
  const reason = raw && raw !== 'OneKeyServer Unknown Error' ? raw : undefined;
  return { reason, serverCode, httpStatusCode };
}

export function zcashTransparentError(
  code: string,
  message: string,
  params: Record<string, unknown> = {},
): OneKeyLocalError {
  return Object.assign(new OneKeyLocalError(message), { code, params });
}

// Recipients a send funded from transparent inputs can pay.
export function isZcashTransparentPayable(address: string): boolean {
  return /^(t[13]|u1)/.test(address) || isZcashTexAddress(address);
}

export function sameOutpoints(
  left: IZcashTransparentOutpoint[],
  right: IZcashTransparentOutpoint[],
): boolean {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right.map((item) => `${item.txid}:${item.vout}`));
  return left.every((item) => rightKeys.has(`${item.txid}:${item.vout}`));
}

export function isTerminalTransparentHistoryStatus(
  status: EDecodedTxStatus,
): boolean {
  return status !== EDecodedTxStatus.Pending;
}

// Max wait for a Worker-only reset before the WebEmbed is treated as unresponsive.
export const ZCASH_WORKER_RESET_TIMEOUT_MS = 10_000;

// The first page of each account's private history, under the account epoch
// it was read in (see privacyChainState). Memory only: a failed runtime read
// falls back to it instead of blanking private history; the full list is
// always paged from the runtime.
export const zcashLastPrivateHistory = new Map<
  string,
  { epoch: string | undefined; items: IZcashHistoryItem[] }
>();

// Accounts whose re-derived viewing key named another identity than their
// state. Background repair stops deriving from the seed for them until
// their local data is deleted.
export const zcashIdentityMismatchAccountIds = new Set<string>();

// In-flight user sends (build/prove/submit) hold the runtime lease; the
// sync watchdog must not tear the carrier down while this is nonzero.
let zcashUserOperationsInFlight = 0;

export function zcashUserOperationsActive(): boolean {
  return zcashUserOperationsInFlight > 0;
}

export async function zcashTrackUserOperation<T>(
  run: () => Promise<T>,
): Promise<T> {
  zcashUserOperationsInFlight += 1;
  try {
    return await run();
  } finally {
    zcashUserOperationsInFlight -= 1;
  }
}

// Tagged property so callers can detect this state without matching on message text.
export const ZCASH_SETUP_INCOMPLETE = 'zcashSetupIncomplete';

export function zcashSpendSourceFromKey(
  key: string | undefined,
): IZcashSpendSource | undefined {
  if (key === 'orchard' || key === 'ironwood') {
    return key;
  }
  return undefined;
}

// True only for an unusable on-disk database, not a transient network/lease failure.
export function isZcashRuntimeDatabaseBroken(e: unknown): boolean {
  const runtimeError = readZcashRuntimeError(e);
  if (!runtimeError || runtimeError.code !== 'DATABASE_ERROR') {
    return false;
  }
  const operation = (runtimeError.params as { operation?: unknown } | undefined)
    ?.operation;
  if (operation === 'migrate') {
    return true;
  }
  return /malformed|corrupt/i.test(runtimeError.detail ?? '');
}

export function createZcashSetupIncompleteError(): Error {
  const error = new OneKeyLocalError(
    localWalletText(ETranslations.privacy_error_setup_incomplete__msg),
  );
  (error as unknown as Record<string, unknown>)[ZCASH_SETUP_INCOMPLETE] = true;
  return error;
}

// The fix is the user's: turning privacy mode off and deleting the
// account's local data lets the next enable set it up with this key.
export function createZcashIdentityMismatchError(): Error {
  // Shown from Retry and Enable, whose callers only log; a balance poll
  // that hits it catches it in bg.
  const error = new OneKeyLocalError({
    message: ETranslationsMock.privacy_error_identity_mismatch__msg,
    autoToast: true,
  });
  (error as unknown as Record<string, unknown>)[ZCASH_SETUP_INCOMPLETE] = true;
  return error;
}

export function isZcashSetupIncompleteError(e: unknown): boolean {
  return (
    !!e &&
    typeof e === 'object' &&
    (e as Record<string, unknown>)[ZCASH_SETUP_INCOMPLETE] === true
  );
}

// The runtime's `message` is just an error code; `params.operation`/`detail` hold the real failure info.
export function zcashDescribeError(e: unknown): {
  error: string;
  operation?: string;
  detail?: string;
} {
  const error = e instanceof Error ? e.message : String(e);
  // params/detail don't survive the extension/mobile carrier boundary if read directly; use readZcashRuntimeError.
  const runtime = readZcashRuntimeError(e);
  if (!runtime) {
    return { error };
  }
  const operation =
    typeof runtime.params.operation === 'string'
      ? runtime.params.operation
      : undefined;
  return { error, operation, detail: runtime.detail };
}
