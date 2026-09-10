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
// once server-side support lands (same pattern other chains followed).
export const ZCASH_LIGHTWALLETD_MAINNET = 'https://zcash-mainnet.chainsafe.dev';

// Ordered fallbacks for the endpoint pool (carrier.ts). Every entry must be
// browser-usable: grpc-web framing AND permissive CORS on the POST -- plain
// gRPC nodes (the zec.rocks family, lightwalletd.com) answer 200 but browsers
// cannot read the response, so they do not qualify however healthy they are.
//
// Probed 2026-08-25: chainsafe is the only qualifying public endpoint. The
// one other CORS-open server found (Ledger's zec-indexer.coin.ledger-test.com,
// a Zaino 0.7.0) is deliberately NOT listed: competitor test infrastructure
// with no SLA, and our users' transparent-address queries would land in their
// logs. First-position candidate once it exists: our own zebrad+Zaino.
export const ZCASH_LIGHTWALLETD_MAINNET_FALLBACKS: string[] = [
  ZCASH_LIGHTWALLETD_MAINNET,
];

export const ZCASH_NETWORK_MAIN: IZcashNetwork = 'main';

// THE current shielded pool: where new shielded value lands, where change
// goes, and what a send spends by default. Pools rotate every few years by
// protocol design (Sapling -> Orchard -> Ironwood); when the next one
// activates, this is the only line that moves. Nothing else may spell the
// pool name as a default -- the runtime holds no fallback either.
export const ZCASH_CURRENT_SHIELDED_POOL: IZcashSpendSource = 'ironwood';

// Upstream wallet-db pool codes, verbatim from zcash_client_sqlite's
// wallet/encoding.rs. History rows carry them as `poolIds`; never renumber.
export const ZCASH_POOL_IDS = {
  transparent: 0,
  sapling: 2,
  orchard: 3,
  ironwood: 4,
} as const;

// Upstream wallet-db pool identifiers (history rows key per-pool deltas by
// these). Names are presentation; identity is always the number.
export const ZCASH_POOL_NAME_BY_ID: Record<string, string> = {
  '0': 'transparent',
  '2': 'sapling',
  '3': 'orchard',
  '4': 'ironwood',
};

// zatoshi per ZEC (10^8), decimals mirror presetNetworks.
export const ZCASH_DECIMALS = 8;

// Sapling activation, Zcash mainnet (block 419_200, 2018-10-28) -- the
// earliest height any shielded tx can exist at. Safe birthday floor for a
// wallet we can't prove is history-free (see KeyringHd.
// zcashDeriveAndSaveOneAccountMeta). NOT the same as
// the product scan floor, which starts at Orchard activation.
export const ZCASH_SAPLING_ACTIVATION_HEIGHT_MAINNET = 419_200;

// OUR wallet's address-derivation compatibility ledger — deliberately NOT the
// SDK's or the protocol's version. Bump ONLY when WE change what a given key
// derives to; stored addresses stamped with an older version are re-derived
// from the persisted UFVK (no password needed) and overwritten. When bumping
// the zcash runtime packages, run sdkZcash/scripts/verify-address-golden.js:
// if outputs changed, the same diff must bump this and update the goldens.
//
// v1: UA = Orchard + Sapling + P2PKH, SDK-default diversifier
//     (pre-migration webzjs behavior, kept for provenance)
// v2: UA = Orchard + P2PKH (no Sapling receiver — prover removed, don't
//     advertise what we can't spend), diversifier fixed at index 0 so the
//     embedded P2PKH equals the BIP-44 t-addr
//     (shipped with a webzjs dep bump in the same diff, pre-migration)
// v3: UA = Orchard only. The independent BIP-44 transparent address remains
//     available as its own receive option; embedding it in the UA would link
//     transparent and shielded activity at the receiver boundary.
export const ZCASH_ADDRESS_SCHEME_VERSION = 3;
