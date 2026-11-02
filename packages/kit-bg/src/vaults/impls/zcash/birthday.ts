import {
  ZCASH_IRONWOOD_ACTIVATION_TIMESTAMP_MS,
  ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET,
  ZCASH_NU7_ACTIVATION_TIMESTAMP_MS,
  ZCASH_POST_NU7_TARGET_BLOCK_SECONDS,
  ZCASH_TARGET_BLOCK_SECONDS,
} from '@onekeyhq/shared/src/config/zcash';

const DAY_MS = 24 * 60 * 60 * 1000;
// Extra history scanned before the requested date.
export const ZCASH_BIRTHDAY_SAFETY_MS = DAY_MS;

// Blocks produced between two wall-clock times at the target interval,
// which shrinks from 75s to 25s at NU7.
export function estimateZcashBlocksBetween(fromMs: number, toMs: number) {
  const secondsBetween = (start: number, end: number) =>
    Math.max(0, end - start) / 1000;
  const beforeNu7 = secondsBetween(
    fromMs,
    Math.min(toMs, ZCASH_NU7_ACTIVATION_TIMESTAMP_MS),
  );
  const afterNu7 = secondsBetween(
    Math.max(fromMs, ZCASH_NU7_ACTIVATION_TIMESTAMP_MS),
    toMs,
  );
  return (
    beforeNu7 / ZCASH_TARGET_BLOCK_SECONDS +
    afterNu7 / ZCASH_POST_NU7_TARGET_BLOCK_SECONDS
  );
}

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

// Real block cadence drifts from the target; keep the offline estimate
// conservative so an offline birthday estimate errs toward scanning more.
const ZCASH_OFFLINE_TIP_DRIFT_RATIO = 0.97;

// Chain tip from the wall clock alone, for callers that could not reach
// lightwalletd, bounded by the product's first supported height.
export function estimateZcashChainTipFromClock(now: number): number {
  const elapsedBlocks = estimateZcashBlocksBetween(
    ZCASH_IRONWOOD_ACTIVATION_TIMESTAMP_MS,
    now,
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
    Math.ceil((now - birthdayTimestamp) / DAY_MS),
  );
  const scanFrom = now - elapsedDays * DAY_MS - ZCASH_BIRTHDAY_SAFETY_MS;
  return Math.max(
    ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET,
    tip - Math.ceil(estimateZcashBlocksBetween(scanFrom, now)),
  );
}
