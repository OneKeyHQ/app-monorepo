import {
  XMR_EARLIEST_SCAN_HEIGHT,
  XMR_HEIGHT_CHECKPOINT,
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

const DAY_MS = 24 * 60 * 60 * 1000;

// Counting forward from the checkpoint runs slightly late, since real intervals average above 120s.
function estimateXmrHeightAtTime(timestampMs: number): number {
  const elapsedMs = timestampMs - XMR_HEIGHT_CHECKPOINT.timestampMs;
  return (
    XMR_HEIGHT_CHECKPOINT.height +
    Math.floor(elapsedMs / (XMR_TARGET_BLOCK_SECONDS * 1000))
  );
}

// Counted back from the live tip, which biases early (safe). The clock caps a tip a bad node inflates.
export function estimateXmrHeightDaysAgo({
  daysAgo,
  chainTip,
  now,
}: {
  daysAgo: number;
  chainTip: number;
  now: number;
}): number {
  const elapsedDays = Math.max(0, Math.ceil(daysAgo));
  const fromTip = chainTip - elapsedDays * XMR_BLOCKS_PER_DAY;
  const fromClock = estimateXmrHeightAtTime(now - elapsedDays * DAY_MS);
  return Math.max(0, Math.min(fromTip, fromClock) - XMR_BIRTHDAY_SAFETY_BLOCKS);
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
    daysAgo: (now - birthdayTimestamp) / DAY_MS,
    chainTip,
    now,
  });
}
