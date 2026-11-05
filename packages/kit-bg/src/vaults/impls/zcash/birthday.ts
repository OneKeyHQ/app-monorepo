import { findZcashHeightAtTimeDirect } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
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

// A date's scan start placed by the chain's own block times: the last block a
// day before it, kept within the product floor and the tip. Unlike the clock
// estimate it cannot land late. Null when the node cannot answer.
export async function placeZcashBirthdayHeight({
  lightwalletdUrl,
  birthdayTimestamp,
  chainTip,
}: {
  lightwalletdUrl: string;
  birthdayTimestamp: number;
  chainTip: number;
}): Promise<number | null> {
  const height = await findZcashHeightAtTimeDirect({
    lightwalletdUrl,
    timeSeconds: Math.floor(
      (birthdayTimestamp - ZCASH_BIRTHDAY_SAFETY_MS) / 1000,
    ),
    lowHeight: ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET,
    highHeight: chainTip,
  });
  return height === null
    ? null
    : clampZcashBirthdayHeight({ birthdayHeight: height, chainTip });
}

// After this many sync turns in a row in which the node cannot place an account's dated birthday,
// the turn reports the node unreachable instead of waiting without a word.
const ZCASH_BIRTHDAY_PLACEMENT_ATTEMPTS = 3;
const zcashBirthdayPlacementFailedThisTurn = new Set<string>();
const zcashBirthdayPlacementFailedTurns = new Map<string, number>();

export function noteZcashBirthdayPlacement(
  accountId: string,
  placed: boolean,
): void {
  if (placed) {
    zcashBirthdayPlacementFailedThisTurn.delete(accountId);
  } else {
    zcashBirthdayPlacementFailedThisTurn.add(accountId);
  }
}

// Ends a sync turn's count; an account that did not fail this turn starts over. True when one of
// `accountIds` has failed for enough turns in a row to tell the user.
export function settleZcashBirthdayPlacementTurn(
  accountIds: string[],
): boolean {
  const failedTurns = new Map<string, number>();
  for (const accountId of zcashBirthdayPlacementFailedThisTurn) {
    failedTurns.set(
      accountId,
      (zcashBirthdayPlacementFailedTurns.get(accountId) ?? 0) + 1,
    );
  }
  zcashBirthdayPlacementFailedThisTurn.clear();
  zcashBirthdayPlacementFailedTurns.clear();
  for (const [accountId, turns] of failedTurns) {
    zcashBirthdayPlacementFailedTurns.set(accountId, turns);
  }
  return accountIds.some(
    (accountId) =>
      (failedTurns.get(accountId) ?? 0) >= ZCASH_BIRTHDAY_PLACEMENT_ATTEMPTS,
  );
}
