import {
  XMR_EARLIEST_SCAN_HEIGHT,
  XMR_TARGET_BLOCK_SECONDS,
} from '@onekeyhq/shared/src/config/xmr';

export const XMR_BIRTHDAY_PENDING_SOURCE = 'pending-timestamp';

// v2 activated on 2016-03-22; earlier dates used 60-second blocks.
const XMR_V2_DAY_END_MS = Date.UTC(2016, 2, 23);

/** 120-second target blocks: 720 a day. */
export const XMR_BLOCKS_PER_DAY = Math.round(
  (24 * 60 * 60) / XMR_TARGET_BLOCK_SECONDS,
);

/** One day of slack: a late start never trial-decrypts earlier outputs (silently missing balance). */
export const XMR_BIRTHDAY_SAFETY_BLOCKS = XMR_BLOCKS_PER_DAY;

// Counted back from the live tip; real intervals average above 120s, which biases early (safe).
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

export function estimateXmrBirthdayHeight({
  birthdayTimestamp,
  now,
  chainTip,
}: {
  birthdayTimestamp: number;
  now: number;
  chainTip: number;
}): number {
  if (birthdayTimestamp < XMR_V2_DAY_END_MS) {
    return XMR_EARLIEST_SCAN_HEIGHT;
  }
  return estimateXmrHeightDaysAgo({
    daysAgo: (now - birthdayTimestamp) / (24 * 60 * 60 * 1000),
    chainTip,
  });
}
