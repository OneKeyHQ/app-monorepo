export const BTC_TX_PLACEHOLDER_VSIZE = 79; // calculate_vsize(["P2WPKH"], [])
export const BTC_FIRST_TAPROOT_PATH = "m/86'/0'/0'";

// Tron deep links used from the UI layer. Kept in shared/consts so the
// eager main bundle does not have to reach into @onekeyhq/core/src/chains/
// (which is forbidden in the main bundle under the three-bundle rules).
export const TRON_SCAN_STAKING_URL = 'https://tronscan.io/#/wallet/resources';
export const TRON_SCAN_VOTE_URL = 'https://tronscan.io/#/sr/votes';
