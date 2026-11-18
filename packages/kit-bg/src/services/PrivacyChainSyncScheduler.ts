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

// Code-unit order, matching the `>` rotation below; locale collation would skip or repeat a group.
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

// A group whose turns keep failing sits out with doubling delay, else its never-cleared `tip`/`membership`
// reason outranks every other chain's backfill.
const FAILURE_BACKOFF_BASE_MS = 5000;
const FAILURE_BACKOFF_MAX_MS = 5 * 60 * 1000;

export function getPrivacyChainFailureBackoffMs(failures: number): number {
  if (failures <= 0) return 0;
  return Math.min(
    FAILURE_BACKOFF_BASE_MS * 2 ** (failures - 1),
    FAILURE_BACKOFF_MAX_MS,
  );
}

// The longest a failing chain waits while the user watches it; only background scanning backs off
// further.
export const WATCHED_FAILURE_BACKOFF_MAX_MS = 30 * 1000;

// A runtime whose stuck scan could not be stopped is tried again, slower each time: nothing else
// frees it short of a restart.
const QUARANTINE_RECOVERY_BASE_MS = 30 * 1000;
const QUARANTINE_RECOVERY_MAX_MS = 5 * 60 * 1000;

export function getQuarantineRecoveryDelayMs(failures: number): number {
  return Math.min(
    QUARANTINE_RECOVERY_BASE_MS * 2 ** Math.max(0, failures - 1),
    QUARANTINE_RECOVERY_MAX_MS,
  );
}

const ACTIVE_TIMEOUT_TICK_MS = 1000;
// Longer than a hidden window's slowest timer (about a minute), so throttling still counts; a
// longer gap means the process was suspended: a phone in the background, a laptop asleep.
const SUSPENDED_GAP_MS = 90 * 1000;

// A deadline that counts only time the process ran, so a scan a suspension interrupted is not
// mistaken for a stuck one when the process wakes. Returns the cancel.
export function setActiveTimeout(
  onTimeout: () => void,
  ms: number,
): () => void {
  const tick = Math.min(ACTIVE_TIMEOUT_TICK_MS, ms);
  let active = 0;
  let last = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    const gap = now - last;
    last = now;
    active += gap > SUSPENDED_GAP_MS ? tick : gap;
    if (active >= ms) {
      clearInterval(timer);
      onTimeout();
    }
  }, tick);
  return () => clearInterval(timer);
}
