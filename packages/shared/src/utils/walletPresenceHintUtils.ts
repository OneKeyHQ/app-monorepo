import platformEnv from '../platformEnv';
import { syncStorage } from '../storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import { isFreshInstallSync } from './freshInstallDetector';

export type IWalletPresenceHint = 'has_wallet' | 'no_wallet';

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
    if (value === 'has_wallet' || value === 'no_wallet') {
      return value;
    }
  } catch {
    // Unreadable storage is "unknown", never "no wallet".
  }
  return undefined;
}

/** bg-only writer. Callers pass the result of the real DB count. */
export function writeWalletPresenceHint({ hasWallet }: { hasWallet: boolean }) {
  if (!platformEnv.isNative) {
    return;
  }
  const next: IWalletPresenceHint = hasWallet ? 'has_wallet' : 'no_wallet';
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

let coldStartDecision: boolean | undefined;

/**
 * Whether the app should open straight into Onboarding on this cold start.
 *
 * Decided once and cached, so later hint writes by bg cannot flip the initial
 * route mid-session. Errs towards `false`: a wrong `false` only keeps the old
 * behavior, while a wrong `true` would show Onboarding to a user with wallets.
 */
export function shouldColdStartIntoOnboardingSync(): boolean {
  if (coldStartDecision !== undefined) {
    return coldStartDecision;
  }
  const hint = readWalletPresenceHintSync();
  if (hint === 'no_wallet') {
    coldStartDecision = true;
  } else if (hint === 'has_wallet') {
    coldStartDecision = false;
  } else {
    coldStartDecision = isFreshInstallSync();
  }
  return coldStartDecision;
}

export function resetColdStartOnboardingDecisionForTest() {
  coldStartDecision = undefined;
}
