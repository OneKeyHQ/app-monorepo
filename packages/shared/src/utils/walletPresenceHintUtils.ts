import platformEnv from '../platformEnv';
import { syncStorage } from '../storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

export type IWalletPresenceHint = 'has_wallet' | 'no_wallet' | 'unknown';

/**
 * Synchronously read the wallet presence hint that bg wrote from the real
 * wallet count. Returns `undefined` when unknown (never written, unreadable,
 * or blocked by Travel Mode).
 */
export function readWalletPresenceHintSync(): IWalletPresenceHint | undefined {
  try {
    const value = syncStorage.getString(
      EAppSyncStorageKeys.onekey_wallet_presence_hint,
    );
    if (
      value === 'has_wallet' ||
      value === 'no_wallet' ||
      value === 'unknown'
    ) {
      return value;
    }
  } catch {
    // Unreadable storage is "unknown", never "no wallet".
  }
  return undefined;
}

/** bg-only writer. Callers pass the result of the real DB count. */
export function writeWalletPresenceHint(hasWallet: boolean | undefined) {
  if (!platformEnv.isNativeBackgroundThread) {
    return;
  }
  let next: IWalletPresenceHint = 'unknown';
  if (hasWallet !== undefined) {
    next = hasWallet ? 'has_wallet' : 'no_wallet';
  }
  try {
    if (readWalletPresenceHintSync() === next) {
      return;
    }
    void Promise.resolve(
      syncStorage.set(EAppSyncStorageKeys.onekey_wallet_presence_hint, next),
    ).catch(() => undefined);
  } catch {
    // Best effort: a missing hint only falls back to the old startup path.
  }
}
