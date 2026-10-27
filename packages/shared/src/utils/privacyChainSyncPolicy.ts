import networkUtils from './networkUtils';

// Gates/thresholds shared across client-side chain scanning; chain-specific
// rules (e.g. Zcash's spam region) live with that chain's config.

// auto-backfill = scheduler-noticed arrears at pass end; manual-sync = button
// press; chain-selected just nudges a boost to start sooner.
export type IPrivacyChainBoostTrigger =
  | 'manual-sync'
  | 'auto-backfill'
  | 'chain-selected';

// Null when no pass has published a position yet.
export function getPrivacyChainBlocksLeft(
  progress:
    | {
        isBackfillComplete: boolean;
        backfillScannedHeight: number | null;
        backfillTargetHeight: number | null;
        tipLag: number | null;
      }
    | null
    | undefined,
): number | null {
  if (!progress) return null;
  let backfillLeft = 0;
  if (!progress.isBackfillComplete) {
    const { backfillScannedHeight, backfillTargetHeight } = progress;
    if (
      typeof backfillScannedHeight !== 'number' ||
      typeof backfillTargetHeight !== 'number'
    ) {
      return null;
    }
    backfillLeft = Math.max(0, backfillTargetHeight - backfillScannedHeight);
  }
  return backfillLeft + Math.max(0, progress.tipLag ?? 0);
}

type IPrivacyChainBackfillPosition = {
  isBackfillComplete: boolean;
  backfillScannedHeight: number | null;
  backfillTargetHeight: number | null;
  backfillRemainingBlocks?: number;
};

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
    return { done, at: now, blocksPerSec: null };
  }
  if (done === previous.done || now <= previous.at) return previous;
  const instantaneous = ((done - previous.done) * 1000) / (now - previous.at);
  return {
    done,
    at: now,
    blocksPerSec:
      previous.blocksPerSec === null
        ? instantaneous
        : previous.blocksPerSec * 0.7 + instantaneous * 0.3,
  };
}

// Floating light only shows for a long wait; shorter catch-ups finish
// silently in the background.
export const PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT = 10_000;

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
  if (typeof remainingBlocks !== 'number') {
    return false;
  }
  return remainingBlocks >= PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT;
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
