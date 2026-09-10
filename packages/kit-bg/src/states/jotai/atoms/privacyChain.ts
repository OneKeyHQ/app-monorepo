import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type { ILocalWalletSyncProgress } from '../../../vaults/localWallet/types';

// Live scan state for privacy chains, PUBLISHED by the scheduler.
//
// Everything here used to be polled: each surface asked the wallet for
// progress every few seconds, and every one of those reads shared a single
// FIFO lane with the scan itself -- which re-enters that lane every 500ms
// during a boost. Opening token details therefore queued three reads behind a
// scan pass each, and the block heights took ~10s to appear.
//
// Inverting it fixes the cause rather than hiding it: the scanner already
// holds the wallet at the end of every pass, so it reads progress once, for
// free, and publishes. Readers become pure subscribers and can never queue.
//
// Not persisted: this is derived, rebuildable state. A stale height restored
// from disk would claim a scan position the wallet may no longer have.
//
// ---------------------------------------------------------------------------
// Two rules for changing this shape. Both exist because a shared mutable blob
// accretes fields by default, and nothing here stops it automatically.
//
// 1. ONLY PUBLISH WHAT SOMETHING SUBSCRIBES TO.
//    Every field below has a named consumer today: the always-on light reads
//    `boostingNetworkIds`, the sync surfaces read `progress`. A field with no
//    subscriber is the point where this starts rotting -- it costs a write on
//    every scan pass and nobody notices when it goes wrong.
//
// 2. SHARED CONCEPTS GO IN THE SHARED SHAPE; CHAIN-SPECIFIC ONES DO NOT.
//    `ILocalWalletSyncProgress` is the capability-level type, not zcash's:
//    every client-scanning chain has a scan start, a backfill range, and a tip
//    lag. When a chain needs something no other chain has, add an opaque
//    per-chain slot rather than an optional field here -- an optional field
//    turns this type into the union of every chain's needs, and every consumer
//    into a null check. (No such slot exists yet, deliberately: there is only
//    one chain, and building it now would be inventing a requirement.)
//
// Changing the shape is cheap BECAUSE it is not persisted -- there is no
// migration to write and no stored data to invalidate. That is what makes this
// the right place to iterate, and simpleDb the wrong one.
//
// Known wording debt: `birthdayHeight` is Zcash vocabulary for what Monero
// calls a restore height. Same concept, zcash accent. Rename it at will,
// precisely because nothing here is stored.
// ---------------------------------------------------------------------------

export type IPrivacyChainScanState = {
  // Keyed `${networkId}:${accountId}`.
  progress: Record<string, ILocalWalletSyncProgress>;
  // Which networks are currently running at the foreground pace. Drives the
  // always-on light and the in-page banners, so "a boost is running" and
  // "something says so" cannot drift apart.
  boostingNetworkIds: string[];
  // Networks that WANT the foreground pace but cannot have it until the user
  // allows metered data. Published separately from `boostingNetworkIds`
  // because the two drive different UI: one holds the screen awake and offers
  // pause, the other holds nothing and offers consent. Refusing silently
  // would leave a scan that never finishes with nothing on screen saying why.
  dataBlockedNetworkIds: string[];
};

export const { target: privacyChainAtom, use: usePrivacyChainAtom } =
  globalAtom<IPrivacyChainScanState>({
    persist: false,
    name: EAtomNames.privacyChainAtom,
    initialValue: {
      progress: {},
      boostingNetworkIds: [],
      dataBlockedNetworkIds: [],
    },
  });
