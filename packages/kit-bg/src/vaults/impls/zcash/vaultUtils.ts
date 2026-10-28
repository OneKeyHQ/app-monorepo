import { isZcashTexAddress } from '@onekeyhq/core/src/chains/zcash/sdkZcash';
import { readZcashRuntimeError } from '@onekeyhq/core/src/chains/zcash/sdkZcash/runtimeError';
import type {
  IZcashSpendSource,
  IZcashTransparentOutpoint,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { localWalletText } from '../../localWallet/messages';
import { isLocalWalletPrivacyDisabled } from '../../localWallet/remoteConfig';

import type Vault from './Vault';
import type { IZcashPrivacyModeStateView } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

// Read-only views retain scanned data while a paused account stops scheduling and spending.
// With privacy switched off by the server every account reads as transparent-only; nothing is deleted.
export function canReadZcashPrivateData(
  state: IZcashPrivacyModeStateView,
): boolean {
  if (isLocalWalletPrivacyDisabled(getNetworkIdsMap().zec)) {
    return false;
  }
  return (
    state.intent === 'on' ||
    (state.operation === undefined && state.resumeFromHeight !== undefined)
  );
}

export async function getZcashTransactionPolicy(
  vault: Vault,
  targetHeight?: number,
) {
  const tip =
    targetHeight === undefined
      ? await vault.zcashGetObservedChainTip().catch(() => undefined)
      : undefined;
  const api = await vault.zcashGetApi();
  return api.getTransactionPolicy({
    targetHeight: targetHeight ?? (tip === undefined ? 0 : tip + 1),
  });
}

export const ZCASH_TRANSPARENT_PATH_RE =
  /^m\/44'\/133'\/(\d+)'\/([01])\/(\d+)$/;

export const ZCASH_TRANSPARENT_P2PKH_SCRIPT_RE = /^76a914[0-9a-f]{40}88ac$/i;

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

// Accounts whose re-derived viewing key named another identity; background repair skips them until their local data is deleted.
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
  const { operation, reason } = runtimeError.params;
  if (operation === 'importAccount') {
    return false;
  }
  const detail = `${runtimeError.detail ?? ''} ${typeof reason === 'string' ? reason : ''}`;
  if (
    /locked|busy|\bi\/?o\b|ioerr|input\/output|read[_ -]?only|permission|access[_ -]?denied|no space|out[_ -]?of[_ -]?(?:disk[_ -]?)?space|disk (?:is )?full|sqlite_full|quota|too[_ -]?new|newer (?:version|app)|unknown migrations?|network(?:[_ -]?type)?[_ -]?mismatch/i.test(
      detail,
    )
  ) {
    return false;
  }
  // Only physical SQLite corruption permits a rebuild; runtime errors can wrap other failures as 'corrupted'.
  return (
    /database disk image is malformed|\bsqlite_(?:corrupt(?:_\w+)?|notadb)\b|file is not a database|invalid disk image/i.test(
      detail,
    ) ||
    (operation !== 'migrate' &&
      /^database is corrupt(?:ed)?$/i.test(detail.trim()))
  );
}

export function createZcashSetupIncompleteError(): Error {
  const error = new OneKeyLocalError(
    localWalletText(ETranslations.privacy_error_setup_incomplete__msg),
  );
  (error as unknown as Record<string, unknown>)[ZCASH_SETUP_INCOMPLETE] = true;
  return error;
}

// Turning privacy mode off and deleting local data lets the next enable set up with this key.
export function createZcashIdentityMismatchError(): Error {
  // Shown from Retry and Enable, whose callers only log.
  const error = new OneKeyLocalError({
    message: localWalletText(
      ETranslations.privacy_error_identity_mismatch__msg,
    ),
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
