import { ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET } from '@onekeyhq/shared/src/config/zcash';

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

export function estimateZcashBirthdayHeight({
  birthdayTimestamp,
  now,
  chainTip,
}: {
  birthdayTimestamp: number;
  now: number;
  chainTip: number;
}): number {
  const elapsedDays = Math.max(
    0,
    Math.ceil((now - birthdayTimestamp) / (24 * 60 * 60 * 1000)),
  );
  return Math.max(
    ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET,
    chainTip -
      elapsedDays * ZCASH_BLOCKS_PER_DAY -
      ZCASH_BIRTHDAY_SAFETY_BLOCKS,
  );
}
