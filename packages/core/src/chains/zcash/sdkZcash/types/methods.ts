import type { IZcashSdkApi } from './sdk';

// The single source of truth for the SDK's method names.
//
// The same 18 names used to be hand-written in four places: the two bg-side
// carrier shims (ext-bg-v3, native) and the two receiving-side hosts
// (offscreen, web-embed). Adding one method meant editing five files, and
// forgetting one of them fails only on that carrier, at runtime.
//
// Every carrier builds its forwarding from this list and uses the same wallet
// Worker. App main/bg share a runtime on web/desktop and have separate heaps
// on extension/mobile; the Worker always has its own heap.
export const ZCASH_SDK_METHODS = [
  'smokeTest',
  'runRuntimeSelfTest',
  // Recovery: tears down a wedged carrier (never leased -- it must run
  // PAST a stuck lease, that is its whole job).
  'resetCarrier',
  // Diagnostics: toggles per-read timing inside whichever carrier runs the
  // wallet, which is the only place that can see why a read queued.
  'setPerfTrace',
  'capabilities',
  'getChainTip',
  'getRuntimeVersions',

  // keys side
  'deriveAccount',
  'deriveAddressFromUfvk',
  'signPczt',
  'deriveTransparentXpubFromUfvk',
  'combinePczt',
  'quoteTransparentTx',
  'buildTransparentTxWithSeed',
  'buildTransparentTxWithAccountXprv',

  // wallet side (watch-only)
  'prepareWalletAccounts',
  'syncWallet',
  'queueRescanFrom',
  'getSyncProgress',
  'diagnoseWalletDatabase',
  'runStorageBenchmark',
  'getBalance',
  'getHistory',
  'getTxDetails',
  'getPendingBroadcasts',
  'createPczt',
  'shieldFunds',
  'quoteShieldFunds',
  'quotePczt',
  'provePczt',
  'finalizePczt',
  'broadcastPczt',
  'releasePczt',
  'purgeWallet',
  'dropWalletDatabase',
] as const satisfies readonly (keyof IZcashSdkApi)[];

export type IZcashSdkMethod = (typeof ZCASH_SDK_METHODS)[number];

// Compile-time exhaustiveness guard.
//
// Without this, a method added to IZcashSdkApi but not to the list above would
// simply be missing from every proxied carrier — a runtime failure on
// extension and mobile only, which is exactly the kind of gap that reaches
// users. `satisfies` above catches names that are *not* on the interface;
// this catches interface members that are *not* on the list.
type IMissingFromList = Exclude<keyof IZcashSdkApi, IZcashSdkMethod>;
const _assertNoMissingMethods: IMissingFromList extends never ? true : never =
  true;
void _assertNoMissingMethods;
