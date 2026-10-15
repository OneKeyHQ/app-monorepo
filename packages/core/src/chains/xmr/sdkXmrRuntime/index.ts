/**
 * Amounts are decimal strings of atomic units: Monero's supply exceeds
 * Number.MAX_SAFE_INTEGER, so a number would silently lose precision.
 */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IXmrFeePriority, IXmrNetwork, IXmrRuntimeError } from './types';

// All async despite sync wasm: reached across a Worker/WebView boundary on
// every platform (background runs Hermes, which can't execute wasm).
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
  /** Bare hex, not JSON. */
  spendScalar: (bip32PrivateKeyHex: string) => Promise<string>;
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

  importKeyImages: (
    accountId: string,
    spendPrivateKeyHex: string,
  ) => Promise<string>;
  verifyTransaction: (signableHex: string, reviewJson: string) => Promise<void>;

  /**
   * Returned feeAtomic/amountAtomic are final; signing does not recompute
   * them. maxSend solves for spendable-fee rather than omitting change
   * (which would donate the remainder to the miner).
   */
  prepareTransaction: (
    accountId: string,
    recipientsJson: string,
    maxSend: boolean,
    reservationId: string,
    chainTip: string,
    priority: IXmrFeePriority,
  ) => Promise<string>;
  /** Sign a prepared transaction. Touches neither the node nor the database. */
  signTransaction: (
    signableHex: string,
    spendPrivateKeyHex: string,
    reviewJson: string,
  ) => Promise<string>;
  /** Broadcast and record. Irreversible. */
  broadcastTransaction: (
    accountId: string,
    rawHex: string,
    reservationId: string,
    chainTip: string,
    /** Amount plus fee, for the pending row. */
    outgoingAtomic?: string,
    /** Change, counted in the total (locked) until the send is mined. */
    changeAtomic?: string,
  ) => Promise<string>;
  /** Claim every live input before signing; later prepares keep it held. */
  markReservationSigned: (
    reservationId: string,
    expectedInputs: number,
  ) => Promise<string>;
  releaseReservation: (reservationId: string) => Promise<string>;

  diagDatabase: () => Promise<string>;
};

let loader: (() => Promise<IXmrRuntimeApi>) | undefined;

/** Each carrier installs its own loader once at startup; this module never learns which one. */
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

/** Runtime errors cross the boundary as JSON strings; a value that doesn't parse isn't ours, so it's passed through untouched. */
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
    // Not a runtime error. Deliberately silent: the caller decides.
  }
  return null;
}

export * from './address';
export * from './sign';
export * from './types';
