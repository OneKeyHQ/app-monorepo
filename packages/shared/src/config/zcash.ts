// NU5 / Orchard activation, mainnet (zcash_protocol consensus.rs).
export const ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET = 1_687_104;
export const ZCASH_ORCHARD_ACTIVATION_TIMESTAMP_MS = Date.UTC(2022, 4, 31);

// NU6.3 / Ironwood activation, mainnet.
export const ZCASH_IRONWOOD_ACTIVATION_HEIGHT_MAINNET = 3_428_143;
export const ZCASH_IRONWOOD_ACTIVATION_TIMESTAMP_MS = Date.UTC(2026, 6, 28);

// The first release supports Ironwood history. Both custom birthdays and
// full scans must start at or above this product floor.
export const ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET =
  ZCASH_IRONWOOD_ACTIVATION_HEIGHT_MAINNET;

export const ZCASH_SPAM_REGION_START_MAINNET = 1_710_000;
export const ZCASH_SPAM_REGION_END_MAINNET = 1_960_000;

// The 2022 spam wall: shielded output volume here is 100x+ a recent block,
// so a scan crossing it looks hung without this being named on screen.
export function isZcashSpamRegionHeight(height: number | null | undefined) {
  return (
    typeof height === 'number' &&
    height >= ZCASH_SPAM_REGION_START_MAINNET &&
    height <= ZCASH_SPAM_REGION_END_MAINNET
  );
}

// Zcash's target block interval, used to turn a block lag into elapsed time.
export const ZCASH_TARGET_BLOCK_SECONDS = 75;
