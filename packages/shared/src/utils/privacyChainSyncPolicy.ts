import networkUtils from './networkUtils';

// Gates/thresholds shared across client-side chain scanning; chain-specific
// rules (e.g. Zcash's spam region) live with that chain's config.

// auto-backfill = scheduler-noticed arrears at pass end; manual-sync = button
// press; chain-selected just nudges a boost to start sooner.
export type IPrivacyChainBoostTrigger =
  | 'manual-sync'
  | 'auto-backfill'
  | 'chain-selected';

type IPrivacyChainBackfillPosition = {
  isBackfillComplete: boolean;
  backfillScannedHeight: number | null;
  backfillTargetHeight: number | null;
  backfillRemainingBlocks?: number;
};

// Null when no pass has published a position yet.
export function getPrivacyChainBlocksLeft(
  progress:
    | (IPrivacyChainBackfillPosition & { tipLag: number | null })
    | null
    | undefined,
): number | null {
  if (!progress) return null;
  const backfillLeft = progress.isBackfillComplete
    ? 0
    : getPrivacyChainBackfillBlocksLeft(progress);
  if (backfillLeft === undefined) return null;
  return backfillLeft + Math.max(0, progress.tipLag ?? 0);
}

// Backfill blocks left: the chain's own count when it reports one (Zcash scans out of order),
// else target minus scanned.
export function getPrivacyChainBackfillBlocksLeft(
  progress: IPrivacyChainBackfillPosition,
): number | undefined {
  if (progress.isBackfillComplete) return undefined;
  const reported = progress.backfillRemainingBlocks;
  if (reported !== undefined) {
    return Number.isSafeInteger(reported) && reported >= 0
      ? reported
      : undefined;
  }
  const scanned = progress.backfillScannedHeight;
  const target = progress.backfillTargetHeight;
  return typeof scanned === 'number' && typeof target === 'number'
    ? Math.max(0, target - scanned)
    : undefined;
}

export type IPrivacyChainScanRateSample = {
  done: number;
  at: number;
  // When this run of measurements started; a short one still swings.
  since: number;
  blocksPerSec: number | null;
};

// A gap this long means the scan stopped in between; its average says nothing about now.
const SCAN_RATE_STALE_MS = 5 * 60 * 1000;

// Smoothed blocks per second between publishes. Work done is target minus blocks left, so a new
// tip moves neither; work going backwards (rewind, rebuilt scan) starts over.
export function nextPrivacyChainScanRate({
  previous,
  progress,
  now,
}: {
  previous: IPrivacyChainScanRateSample | undefined;
  progress: IPrivacyChainBackfillPosition;
  now: number;
}): IPrivacyChainScanRateSample | undefined {
  const left = getPrivacyChainBackfillBlocksLeft(progress);
  const target = progress.backfillTargetHeight;
  if (left === undefined || typeof target !== 'number') return undefined;
  const done = target - left;
  if (
    !previous ||
    done < previous.done ||
    now - previous.at > SCAN_RATE_STALE_MS
  ) {
    return { done, at: now, since: now, blocksPerSec: null };
  }
  if (done === previous.done || now <= previous.at) return previous;
  const instantaneous = ((done - previous.done) * 1000) / (now - previous.at);
  return {
    done,
    at: now,
    since: previous.since,
    blocksPerSec:
      previous.blocksPerSec === null
        ? instantaneous
        : previous.blocksPerSec * 0.7 + instantaneous * 0.3,
  };
}

// Floating light only shows for a long wait; shorter catch-ups finish
// silently in the background.
export const PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT = 10_000;

export function isPrivacyChainLongCatchUp(
  remainingBlocks: number | null | undefined,
): boolean {
  return (
    typeof remainingBlocks === 'number' &&
    remainingBlocks >= PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT
  );
}

// The account furthest behind among a network's published positions; null when none has one.
export function getPrivacyChainFurthestBlocksLeft(
  progress: Record<
    string,
    Parameters<typeof getPrivacyChainBlocksLeft>[0] | undefined
  >,
  networkId: string,
): number | null {
  const prefix = `${networkId}:`;
  let furthest: number | null = null;
  for (const [key, entry] of Object.entries(progress)) {
    const left = key.startsWith(prefix)
      ? getPrivacyChainBlocksLeft(entry)
      : null;
    if (left !== null && (furthest === null || left > furthest)) {
      furthest = left;
    }
  }
  return furthest;
}

export function shouldStartBoost({
  trigger,
  networkId,
  remainingBlocks,
  pausedByUser,
}: {
  trigger: IPrivacyChainBoostTrigger;
  networkId: string | undefined;
  // From getPrivacyChainBlocksLeft; only consulted for automatic triggers.
  remainingBlocks?: number | null;
  // Explicit pause outranks every automatic trigger; only an explicit Sync
  // press clears it.
  pausedByUser?: boolean;
}): boolean {
  if (!networkId) {
    return false;
  }
  // Landing on the aggregate view is not a request to catch this chain up.
  if (networkUtils.isAllNetwork({ networkId })) {
    return false;
  }
  // Manual sync always runs (and resumes from a pause) regardless of arrears size.
  if (trigger === 'manual-sync') {
    return true;
  }
  if (pausedByUser) {
    return false;
  }
  // Unknown arrears never start a boost; the caller re-asks once the next
  // pass publishes a position.
  return isPrivacyChainLongCatchUp(remainingBlocks);
}

// A chain's target block interval, which may change from a height on (Zcash NU7: 75s to 25s).
export type IPrivacyChainBlockTime = {
  blockTimeSeconds: number;
  blockTimeChange?: { fromHeight: number; blockTimeSeconds: number };
};

// Blocks up to `tip` produced after the interval changed.
function countChangedBlocks(
  blockTime: IPrivacyChainBlockTime,
  tip: number | null | undefined,
): number {
  const change = blockTime.blockTimeChange;
  if (!change || typeof tip !== 'number') return 0;
  return Math.max(0, tip - change.fromHeight + 1);
}

// Target chain time of the `blocks` blocks up to `tip`, each at its own height's interval.
export function getPrivacyChainBlocksSeconds(
  blockTime: IPrivacyChainBlockTime,
  blocks: number,
  tip: number | null | undefined,
): number {
  const changed = Math.min(blocks, countChangedBlocks(blockTime, tip));
  const changedSeconds = blockTime.blockTimeChange?.blockTimeSeconds ?? 0;
  return (
    (blocks - changed) * blockTime.blockTimeSeconds + changed * changedSeconds
  );
}

// A window set as `windowBlocks` at the original interval that stands for time: the blocks up
// to `tip` that take as long (ZIP 218 keeps such windows in time).
export function getPrivacyChainTimeWindowBlocks(
  blockTime: IPrivacyChainBlockTime | undefined,
  windowBlocks: number,
  tip: number | null | undefined,
): number {
  const change = blockTime?.blockTimeChange;
  if (!blockTime || !change) return windowBlocks;
  const windowSeconds = windowBlocks * blockTime.blockTimeSeconds;
  const changedBlocks = countChangedBlocks(blockTime, tip);
  const changedSeconds = changedBlocks * change.blockTimeSeconds;
  if (windowSeconds <= changedSeconds) {
    return windowSeconds / change.blockTimeSeconds;
  }
  return (
    changedBlocks +
    (windowSeconds - changedSeconds) / blockTime.blockTimeSeconds
  );
}

// Small lag is normal chain-following, not a problem; reserved for lag a
// user could act on (about an hour of chain).
export function isTipLagWorthMentioning(
  lagBlocks: number | null | undefined,
  warningThresholdBlocks: number,
): lagBlocks is number {
  return typeof lagBlocks === 'number' && lagBlocks > warningThresholdBlocks;
}

// UI staleness ceiling: polls a published atom, never the wallet lane. Shared
// by every surface so they show the same facts.
export const PRIVACY_CHAIN_SYNC_POLL_MS = 8000;

// Tip-only poll (no wallet lease): how soon an unwatched incoming payment is
// noticed. A foreground boost preempts it.
export const PRIVACY_CHAIN_TIP_POLL_MS = 300_000;
