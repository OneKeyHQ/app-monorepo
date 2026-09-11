// Zcash-specific constants and the gates built directly on them.
//
// The chain-agnostic scanning gates (how far behind is worth mentioning, how
// often surfaces re-read, when a boost is warranted) live in
// utils/privacyChainSyncPolicy -- every client-scanning chain answers those.
// What is here is true of Zcash and of nothing else.

// Lowest height accepted by the low-level wallet registration flow. Product
// recovery UI uses the Orchard activation floor below because Sapling is not
// supported; keep this protocol guard separate from the product scan policy.
export const ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET = 419_201;

// NU5 / Orchard activation, mainnet (zcash_protocol consensus.rs).
//
// The deepest product scan worth offering. Below this the only shielded value that can
// exist is Sapling, and this wallet cannot spend Sapling -- the 50MB proving
// parameters are not shipped. Scanning the ~1.27M blocks between Sapling
// activation and here therefore costs hours to surface a number nothing can
// act on. The registration floor above stays where it is: that one is about
// which heights lightwalletd can serve a treestate for, not about which
// heights are worth reading.
export const ZCASH_ORCHARD_ACTIVATION_HEIGHT_MAINNET = 1_687_104;
// Wall-clock time of that activation block (2022-05-31, +/- a day). Paired
// with the block interval it estimates a chain tip when the network is
// unreachable.
export const ZCASH_ORCHARD_ACTIVATION_TIMESTAMP_MS = Date.UTC(2022, 4, 31);

export const ZCASH_SPAM_REGION_START_MAINNET = 1_710_000;
export const ZCASH_SPAM_REGION_END_MAINNET = 1_960_000;

// The 2022 spam wall: blocks in this range carry 139-318x the shielded output
// volume of a recent block (measured against mainnet, not estimated), so a
// scan crossing it slows down by roughly that factor. Worth naming on screen,
// because otherwise a scan that has simply reached 2022 looks like a scan
// that has hung.
export function isZcashSpamRegionHeight(height: number | null | undefined) {
  return (
    typeof height === 'number' &&
    height >= ZCASH_SPAM_REGION_START_MAINNET &&
    height <= ZCASH_SPAM_REGION_END_MAINNET
  );
}

// Zcash's target block interval. Used to turn a block lag into elapsed time:
// "40 blocks behind" means nothing to a reader, "50 min behind" does.
export const ZCASH_TARGET_BLOCK_SECONDS = 75;

// UI-facing string form of the shielding policy threshold. The core policy
// converts it to bigint before constructing transactions.
export const ZCASH_SHIELDING_THRESHOLD_ZAT = '10000';
