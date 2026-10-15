import {
  ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET,
  ZCASH_ORCHARD_ACTIVATION_TIMESTAMP_MS,
  ZCASH_TARGET_BLOCK_SECONDS,
} from '@onekeyhq/shared/src/config/zcash';

// Birthday policy stays separate from storage and network I/O.

export const ZCASH_BLOCKS_PER_DAY = 1152;
export const ZCASH_BIRTHDAY_SAFETY_BLOCKS = ZCASH_BLOCKS_PER_DAY;

export function clampZcashBirthdayHeight({
  birthdayHeight,
  chainTip,
}: {
  birthdayHeight: number;
  chainTip?: number;
}): number {
  const aboveActivation = Math.max(
    ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET,
    birthdayHeight,
  );
  return chainTip === undefined
    ? aboveActivation
    : Math.min(aboveActivation, chainTip);
}

// Real block cadence drifts from the 75s target; keep the offline estimate
// under the true tip so a birthday derived from it can only be too early.
const ZCASH_OFFLINE_TIP_DRIFT_RATIO = 0.97;

// Chain tip from the wall clock alone, for callers that could not reach
// lightwalletd. Always at or below the real tip.
export function estimateZcashChainTipFromClock(now: number): number {
  const elapsedBlocks = Math.max(
    0,
    (now - ZCASH_ORCHARD_ACTIVATION_TIMESTAMP_MS) /
      (ZCASH_TARGET_BLOCK_SECONDS * 1000),
  );
  return (
    ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET +
    Math.floor(elapsedBlocks * ZCASH_OFFLINE_TIP_DRIFT_RATIO)
  );
}

export function estimateZcashBirthdayHeight({
  birthdayTimestamp,
  now,
  chainTip,
}: {
  birthdayTimestamp: number;
  now: number;
  chainTip: number | null | undefined;
}): number {
  const tip = chainTip ?? estimateZcashChainTipFromClock(now);
  const elapsedDays = Math.max(
    0,
    Math.ceil((now - birthdayTimestamp) / (24 * 60 * 60 * 1000)),
  );
  return Math.max(
    ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET,
    tip - elapsedDays * ZCASH_BLOCKS_PER_DAY - ZCASH_BIRTHDAY_SAFETY_BLOCKS,
  );
}
