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

export function pickPrivacyChainSyncCandidate<
  T extends IPrivacyChainSyncCandidateBase,
>(candidates: T[], lastBackfillRuntimeStateKey?: string): T | undefined {
  const ordered = candidates.toSorted(
    (a, b) =>
      syncReasonPriority[a.reason] - syncReasonPriority[b.reason] ||
      a.runtimeStateKey.localeCompare(b.runtimeStateKey),
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
