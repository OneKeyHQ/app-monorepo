import { XMR_TARGET_BLOCK_SECONDS } from '@onekeyhq/shared/src/config/xmr';

/** 120-second target blocks: 720 a day. */
export const XMR_BLOCKS_PER_DAY = Math.round(
  (24 * 60 * 60) / XMR_TARGET_BLOCK_SECONDS,
);

/**
 * One day of slack under every date height: early costs scan time, but late
 * means outputs before it are never trial-decrypted -- a silently missing balance.
 */
export const XMR_BIRTHDAY_SAFETY_BLOCKS = XMR_BLOCKS_PER_DAY;

// Counted back from the live tip at the target rate; real intervals average
// slightly above 120s, which biases this early (the safe direction).
export function estimateXmrHeightDaysAgo({
  daysAgo,
  chainTip,
}: {
  daysAgo: number;
  chainTip: number;
}): number {
  const elapsedDays = Math.max(0, Math.ceil(daysAgo));
  return Math.max(
    0,
    chainTip - elapsedDays * XMR_BLOCKS_PER_DAY - XMR_BIRTHDAY_SAFETY_BLOCKS,
  );
}

// The enable dialog collects a month, not a block height.
export function estimateXmrBirthdayHeight({
  birthdayTimestamp,
  now,
  chainTip,
}: {
  birthdayTimestamp: number;
  now: number;
  chainTip: number;
}): number {
  return estimateXmrHeightDaysAgo({
    daysAgo: (now - birthdayTimestamp) / (24 * 60 * 60 * 1000),
    chainTip,
  });
}
