export type IPrivacyChainSyncReason = 'tip' | 'membership' | 'backfill';

export type IPrivacyChainRuntimeState = {
  accountSignature: string;
  lastChainTip: number | null;
};

type IPrivacyChainSyncCandidateBase = {
  runtimeStateKey: string;
  reason: IPrivacyChainSyncReason;
};

const syncReasonPriority: Record<IPrivacyChainSyncReason, number> = {
  tip: 0,
  membership: 1,
  backfill: 2,
};

export function getPrivacyChainSyncReason({
  previous,
  accountSignature,
  chainTip,
  hasBackfill,
}: {
  previous: IPrivacyChainRuntimeState | undefined;
  accountSignature: string;
  chainTip: number | null;
  hasBackfill: boolean;
}): IPrivacyChainSyncReason | undefined {
  if (!previous || previous.accountSignature !== accountSignature) {
    return 'membership';
  }
  if (chainTip !== null && chainTip !== previous.lastChainTip) {
    return 'tip';
  }
  if (hasBackfill) {
    return 'backfill';
  }
  return undefined;
}

// Code-unit order, the same order the rotation below steps through with `>`.
// A locale collation here would sort keys one way and rotate through them
// another, skipping or repeating a group.
function compareKeys(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function pickPrivacyChainSyncCandidate<
  T extends IPrivacyChainSyncCandidateBase,
>(candidates: T[], lastBackfillRuntimeStateKey?: string): T | undefined {
  const ordered = candidates.toSorted(
    (a, b) =>
      syncReasonPriority[a.reason] - syncReasonPriority[b.reason] ||
      compareKeys(a.runtimeStateKey, b.runtimeStateKey),
  );
  const first = ordered[0];
  if (!first || first.reason !== 'backfill') {
    return first;
  }
  const backfillCandidates = ordered.filter(
    (candidate) => candidate.reason === 'backfill',
  );
  const next = backfillCandidates.find(
    (candidate) =>
      !lastBackfillRuntimeStateKey ||
      candidate.runtimeStateKey > lastBackfillRuntimeStateKey,
  );
  return next ?? backfillCandidates[0];
}

// A group whose turns keep failing sits out for a while, doubling each time:
// otherwise its `tip`/`membership` reason (never cleared by a failed turn)
// outranks every other chain's backfill on every tick.
const FAILURE_BACKOFF_BASE_MS = 5000;
const FAILURE_BACKOFF_MAX_MS = 5 * 60 * 1000;

export function getPrivacyChainFailureBackoffMs(failures: number): number {
  if (failures <= 0) return 0;
  return Math.min(
    FAILURE_BACKOFF_BASE_MS * 2 ** (failures - 1),
    FAILURE_BACKOFF_MAX_MS,
  );
}
