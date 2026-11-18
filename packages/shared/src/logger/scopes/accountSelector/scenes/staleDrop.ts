import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

// Unlike the other accountSelector scenes, this one is deliberately NOT dev-only.
// A stale drop silently discards a user-visible update, and the failure is a race
// that rarely reproduces locally — production needs a trace in the exportable log.
// Payloads stay identifier-free: scene identity plus shape, never account ids or
// dapp origins.

type ISelectedAccountLike = {
  deriveType?: string;
  indexedAccountId?: string;
  networkId?: string;
  othersWalletAccountId?: string;
  walletId?: string;
};

function buildSelectionShape(
  selectedAccount: ISelectedAccountLike | undefined,
) {
  if (!selectedAccount) {
    return { accountKind: 'none' };
  }
  let accountKind = 'none';
  if (selectedAccount.indexedAccountId) {
    accountKind = 'indexed';
  } else if (selectedAccount.othersWalletAccountId) {
    accountKind = 'others';
  }
  return {
    accountKind,
    deriveType: selectedAccount.deriveType,
    hasWallet: Boolean(selectedAccount.walletId),
    networkId: selectedAccount.networkId,
  };
}

export class AccountSelectorStaleDropScene extends BaseScene {
  @LogToLocal({ level: 'warn' })
  public selectionUpdateDropped({
    current,
    expected,
    num,
    reason,
    sceneName,
    staleGuard,
    suppressedSinceLastLog,
  }: {
    current: ISelectedAccountLike | undefined;
    expected: ISelectedAccountLike | undefined;
    num: number;
    reason: string;
    sceneName: string | undefined;
    // Which guard rejected the update. Deliberately not the revision timestamps:
    // those differ on every drop and would stop the log transport from collapsing
    // repeats, while adding nothing the shape below does not already say.
    staleGuard: string | undefined;
    // Drops suppressed by the caller's throttle since the previous entry.
    suppressedSinceLastLog: number;
  }) {
    return [
      'accountSelector selection update dropped as stale',
      {
        current: buildSelectionShape(current),
        expected: buildSelectionShape(expected),
        num,
        reason,
        sceneName,
        staleGuard,
        suppressedSinceLastLog,
      },
    ];
  }

  // Documented theoretical edge of the compare-if-newer sync: two runtimes
  // committed different selections with the same millisecond revision, so
  // there is no ordering to decide a winner and each side keeps its own value.
  // No tie-break on purpose - any extra input (runtime id, random) would make
  // the two sides converge on a value neither user necessarily picked. The
  // divergence heals on the next selection commit; this entry exists so a
  // report of "two windows disagree" can be traced to it.
  @LogToLocal({ level: 'warn' })
  public equalRevisionConflictKeptLocal({
    current,
    incoming,
    num,
    reason,
    sceneName,
  }: {
    current: ISelectedAccountLike | undefined;
    incoming: ISelectedAccountLike | undefined;
    num: number;
    reason: string;
    sceneName: string | undefined;
  }) {
    return [
      'accountSelector cross-runtime event carried the same revision as the local selection but a different value; keeping local',
      {
        current: buildSelectionShape(current),
        incoming: buildSelectionShape(incoming),
        num,
        reason,
        sceneName,
      },
    ];
  }

  @LogToLocal({ level: 'warn' })
  public storageSideEffectDropped({
    eventEmitDisabled,
    eventEmitted,
    num,
    outcome,
    primaryPersisted,
    reason,
    sceneName,
    suppressedSinceLastLog,
    syncedHome,
  }: {
    // The selection was disabled from emitting by its caller, so a missing
    // event here is intended rather than lost.
    eventEmitDisabled: boolean | undefined;
    // The consequence that matters. The record on disk is taken over by the
    // newer save, but a change event that never fired leaves dapp and swap
    // consumers on the previous account with nothing to correct them.
    eventEmitted: boolean;
    num: number;
    outcome: string;
    // Whether this attempt had already written the primary record before it
    // aborted — tells a partial write apart from one that never started.
    primaryPersisted: boolean;
    reason: string | undefined;
    sceneName: string | undefined;
    // Drops suppressed by the caller's throttle since the previous entry.
    suppressedSinceLastLog: number;
    syncedHome: boolean;
  }) {
    return [
      'accountSelector storage side effect dropped as stale',
      {
        eventEmitDisabled,
        eventEmitted,
        num,
        outcome,
        primaryPersisted,
        reason,
        sceneName,
        suppressedSinceLastLog,
        syncedHome,
      },
    ];
  }

  @LogToLocal({ level: 'error' })
  public repeatedStaleDropsDetected({
    consecutiveCount,
    num,
    reason,
    sceneName,
  }: {
    consecutiveCount: number;
    num: number;
    reason: string;
    sceneName: string | undefined;
  }) {
    return [
      'accountSelector selection updates repeatedly dropped as stale without any commit in between',
      { consecutiveCount, num, reason, sceneName },
    ];
  }
}
