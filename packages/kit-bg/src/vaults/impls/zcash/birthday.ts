import {
  ZCASH_IRONWOOD_ACTIVATION_TIMESTAMP_MS,
  ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET,
  ZCASH_TARGET_BLOCK_SECONDS,
} from '@onekeyhq/shared/src/config/zcash';

export const ZCASH_BLOCKS_PER_DAY = 1152;
export const ZCASH_BIRTHDAY_SAFETY_BLOCKS = ZCASH_BLOCKS_PER_DAY;

export function clampZcashBirthdayHeight({
  birthdayHeight,
  chainTip,
}: {
  birthdayHeight: number;
  chainTip?: number;
}): number {
  return Math.max(
    ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET,
    chainTip === undefined
      ? birthdayHeight
      : Math.min(birthdayHeight, chainTip),
  );
}

// Real block cadence drifts from the 75s target; keep the offline estimate
// conservative so an offline birthday estimate errs toward scanning more.
const ZCASH_OFFLINE_TIP_DRIFT_RATIO = 0.97;

// Chain tip from the wall clock alone, for callers that could not reach
// lightwalletd, bounded by the product's first supported height.
export function estimateZcashChainTipFromClock(now: number): number {
  const elapsedBlocks = Math.max(
    0,
    (now - ZCASH_IRONWOOD_ACTIVATION_TIMESTAMP_MS) /
      (ZCASH_TARGET_BLOCK_SECONDS * 1000),
  );
  return (
    ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET +
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
  // A stale persisted tip must not move the estimate before the product floor.
  const tip = Math.max(chainTip ?? 0, estimateZcashChainTipFromClock(now));
  const elapsedDays = Math.max(
    0,
    Math.ceil((now - birthdayTimestamp) / (24 * 60 * 60 * 1000)),
  );
  return Math.max(
    ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET,
    tip - elapsedDays * ZCASH_BLOCKS_PER_DAY - ZCASH_BIRTHDAY_SAFETY_BLOCKS,
  );
}
