import {
  ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET,
  ZCASH_SPAM_REGION_END_MAINNET,
  ZCASH_SPAM_REGION_START_MAINNET,
} from '@onekeyhq/shared/src/config/zcash';

// cspell:ignore chainsafe Zaino zebrad gettreestate

import type { IZcashNetwork, IZcashSpendSource } from './types/sdk';

export {
  ZCASH_MIN_BIRTHDAY_HEIGHT_MAINNET,
  ZCASH_SPAM_REGION_END_MAINNET,
  ZCASH_SPAM_REGION_START_MAINNET,
};

// Temporary direct lightwalletd endpoint; migrates to the OneKey service proxy
// once server-side support lands.
export const ZCASH_LIGHTWALLETD_MAINNET = 'https://zcash-mainnet.chainsafe.dev';

export const ZCASH_NETWORK_MAIN: IZcashNetwork = 'main';

// Bump only when the App changes addresses derived from an existing UFVK.
export const ZCASH_ADDRESS_SCHEME_VERSION = 1;

// The current shielded pool: where new value lands, where change goes, and
// what a send spends by default. Pools rotate by protocol design; when the
// next one activates, this is the only line that moves.
export const ZCASH_CURRENT_SHIELDED_POOL: IZcashSpendSource = 'ironwood';

// Upstream wallet-db pool codes, verbatim from zcash_client_sqlite's
// wallet/encoding.rs. History rows carry them as `poolIds`; never renumber.
export const ZCASH_POOL_IDS = {
  transparent: 0,
  sapling: 2,
  orchard: 3,
  ironwood: 4,
} as const;

// Names are presentation; identity is always the number.
export const ZCASH_POOL_NAME_BY_ID: Record<string, string> = {
  '0': 'transparent',
  '2': 'sapling',
  '3': 'orchard',
  '4': 'ironwood',
};

// zatoshi per ZEC (10^8), decimals mirror presetNetworks.
export const ZCASH_DECIMALS = 8;

// Sapling activation, Zcash mainnet -- the earliest height any shielded tx
// can exist at. Safe birthday floor for a wallet we can't prove is
// history-free. Not the product scan floor, which starts at Orchard.
export const ZCASH_SAPLING_ACTIVATION_HEIGHT_MAINNET = 419_200;
