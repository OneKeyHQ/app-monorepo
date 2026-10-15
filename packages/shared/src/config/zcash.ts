// Zcash-specific constants. Chain-agnostic scanning gates live in
// utils/privacyChainSyncPolicy; what is here is true of Zcash alone.

// Lowest height the low-level wallet registration flow accepts. Keep
// separate from the product scan floor below, which starts at Orchard
// since this wallet cannot spend Sapling.
export const ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET = 419_201;

// NU5 / Orchard activation, mainnet (zcash_protocol consensus.rs). The
// deepest product scan worth offering -- this wallet cannot spend Sapling
// (no proving parameters shipped), so scanning below here only costs hours
// to surface a number nothing can act on.
export const ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET = 1_687_104;
// Wall-clock time of that activation block; paired with the block interval
// to estimate a chain tip when the network is unreachable.
export const ZCASH_ORCHARD_ACTIVATION_TIMESTAMP_MS = Date.UTC(2022, 4, 31);

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

// UI-facing string form; the core policy converts it to bigint before constructing transactions.
export const ZCASH_SHIELDING_THRESHOLD_ZAT = '10000';
