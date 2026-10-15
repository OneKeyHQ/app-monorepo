import networkUtils from './networkUtils';

// Gates/thresholds shared across client-side chain scanning; chain-specific
// rules (e.g. Zcash's spam region) live with that chain's config.

// auto-backfill = scheduler-noticed arrears at pass end; manual-sync = button
// press; the other two just nudge a boost to start sooner.
export type IPrivacyChainBoostTrigger =
  | 'manual-sync'
  | 'auto-backfill'
  | 'chain-selected'
  | 'compose-send';

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

// Ceiling on staleness, not a fetch cost: reads a published jotai atom and
// never enter the wallet's lane. One number for every surface so they show the same facts.
export const PRIVACY_CHAIN_SYNC_POLL_MS = 8000;

// Only a head-request cadence (no wallet lease) deciding how soon an
// unwatched incoming payment is noticed; a waiting user's foreground boost preempts it.
export const PRIVACY_CHAIN_TIP_POLL_MS = 300_000;
