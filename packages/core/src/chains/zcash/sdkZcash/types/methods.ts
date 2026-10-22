import type { IZcashSdkApi } from './sdk';

// The single source of truth for the SDK's method names; every carrier shim
// and host builds its forwarding from this list.
export const ZCASH_SDK_METHODS = [
  'runRuntimeSelfTest',
  // Never leased: it must run past a stuck lease to recover a wedged carrier.
  'resetCarrier',
  'capabilities',
  'getChainTip',
  'prewarmPczt',

  // keys side
  'validateAddress',
  'deriveAccount',
  'deriveAccountKeys',
  'deriveAddressFromUfvk',
  'signPczt',
  'verifyPcztReview',
  'deriveTransparentXpubFromUfvk',
  'combinePczt',
  'parseTransparentTransactions',
  'quoteTransparentTx',
  'buildTransparentTxWithAccountXprv',
  'createTransparentHardwarePczt',
  'finalizeTransparentHardwarePczt',
  'redactPcztForHardwareSigner',

  // wallet side (watch-only)
  'prepareWalletAccounts',
  'syncWallet',
  'queueRescanFrom',
  'getSyncProgress',
  'getEndpointHealth',
  'diagnoseWalletDatabase',
  'getBalance',
  'getHistory',
  'getTxDetails',
  'getPendingBroadcasts',
  'createPczt',
  'quotePczt',
  'provePczt',
  'submitPczt',
  'purgeWallet',
  'dropWalletDatabase',
] as const satisfies readonly (keyof IZcashSdkApi)[];

export type IZcashSdkMethod = (typeof ZCASH_SDK_METHODS)[number];

// Compile-time guard: an IZcashSdkApi member missing from the list would fail
// only at runtime on proxied carriers (extension, mobile).
type IMissingFromList = Exclude<keyof IZcashSdkApi, IZcashSdkMethod>;
const _assertNoMissingMethods: IMissingFromList extends never ? true : never =
  true;
void _assertNoMissingMethods;
