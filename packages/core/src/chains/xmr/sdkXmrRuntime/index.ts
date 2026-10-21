import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IXmrFeePriority, IXmrNetwork, IXmrRuntimeError } from './types';

// All async despite sync wasm: reached across a Worker/WebView boundary on
// every platform.
export type IXmrRuntimeApi = {
  /** Install the persistent VFS. Must run before any wallet is opened. */
  init: () => Promise<void>;
  dependencyVersions: () => Promise<string>;

  openWallet: (dbName: string, network: IXmrNetwork) => Promise<string>;
  closeWallet: () => Promise<void>;
  setNodeUrl: (url: string) => Promise<void>;
  chainTip: () => Promise<string>;

  deriveAccount: (
    network: IXmrNetwork,
    bip32PrivateKeyHex: string,
  ) => Promise<string>;
  deriveSubaddress: (
    network: IXmrNetwork,
    spendPublicKeyHex: string,
    viewPrivateKeyHex: string,
    major: number,
    minor: number,
  ) => Promise<string>;
  validateAddress: (network: IXmrNetwork, address: string) => Promise<boolean>;

  addAccount: (
    uuid: string,
    spendPublicKeyHex: string,
    viewPrivateKeyHex: string,
    birthdayHeight: string,
  ) => Promise<string>;
  listAccounts: () => Promise<string>;
  removeAccount: (uuid: string) => Promise<string>;
  /** Deletes the database file without opening it (App reset, storage reset). */
  deleteWallet: (dbName: string) => Promise<string>;
  registerSubaddress: (
    accountId: string,
    major: number,
    minor: number,
    label?: string,
  ) => Promise<string>;

  updateChainTip: (accountId: string, tip: string) => Promise<string>;
  syncStep: (accountId: string, maxBlocks: string) => Promise<string>;
  syncPeek: (accountId: string) => Promise<string>;
  rewindTo: (accountId: string, height: string, tip: string) => Promise<string>;

  balance: (accountId: string, chainTip?: string) => Promise<string>;
  history: (
    accountId: string,
    limit: number,
    offset: number,
  ) => Promise<string>;
  transactionDetails: (accountId: string, txidHex: string) => Promise<string>;

  /** Takes the account's BIP-32 key; the spend key is reduced inside the runtime. */
  importKeyImagesWithBip32Key: (
    accountId: string,
    bip32PrivateKeyHex: string,
  ) => Promise<string>;
  verifyTransaction: (signableHex: string, reviewJson: string) => Promise<void>;
  verifySignedTransaction: (
    signableHex: string,
    reviewJson: string,
    rawHex: string,
  ) => Promise<string>;

  /**
   * Returned feeAtomic/amountAtomic are final. maxSend solves for
   * spendable - fee rather than omitting change, which would donate the
   * remainder to the miner.
   */
  prepareTransaction: (
    accountId: string,
    recipientsJson: string,
    maxSend: boolean,
    chainTip: string,
    priority: IXmrFeePriority,
  ) => Promise<string>;
  /** Touches neither node nor database; the spend key is reduced in-runtime. */
  signTransactionWithBip32Key: (
    signableHex: string,
    bip32PrivateKeyHex: string,
    reviewJson: string,
  ) => Promise<string>;
  /** Broadcast and record. Irreversible. */
  broadcastTransaction: (
    accountId: string,
    rawHex: string,
    chainTip: string,
    /** Amount plus fee, for the pending row. */
    outgoingAtomic: string | undefined,
    /** Change, counted in the total (locked) until the send is mined. */
    changeAtomic: string | undefined,
    signableHex: string,
    reviewJson: string,
  ) => Promise<string>;

  diagDatabase: () => Promise<string>;
};

let loader: (() => Promise<IXmrRuntimeApi>) | undefined;

export function setXmrRuntimeApiLoader(next: () => Promise<IXmrRuntimeApi>) {
  loader = next;
}

export function hasXmrRuntimeApiLoader(): boolean {
  return Boolean(loader);
}

export async function getXmrRuntimeApi(): Promise<IXmrRuntimeApi> {
  if (!loader) {
    throw new OneKeyLocalError(
      'xmr runtime is not available on this carrier; setXmrRuntimeApiLoader() was never called',
    );
  }
  return loader();
}

/** Runtime errors cross the boundary as JSON strings; anything else returns null. */
export function readXmrRuntimeError(error: unknown): IXmrRuntimeError | null {
  let raw: string | null = null;
  if (typeof error === 'string') {
    raw = error;
  } else if (error instanceof Error) {
    raw = error.message;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as IXmrRuntimeError).code === 'string'
    ) {
      return parsed as IXmrRuntimeError;
    }
  } catch {
    // Not a runtime error; the caller decides.
  }
  return null;
}

export * from './address';
export * from './sign';
export * from './types';
