import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IXmrFeePriority, IXmrNetwork, IXmrRuntimeError } from './types';

// All async despite sync wasm: reached across a Worker/WebView boundary on
// every platform.
export type IXmrRuntimeApi = {
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
    forceRescan?: boolean,
  ) => Promise<string>;
  listAccounts: () => Promise<string>;
  removeAccount: (uuid: string) => Promise<string>;
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

  importKeyImagesWithBip32Key: (
    accountId: string,
    bip32PrivateKeyHex: string,
  ) => Promise<string>;
  /** Outputs still lacking a key image, in the form a hardware device takes them. */
  exportKeyImageSyncData: (accountId: string) => Promise<string>;
  /** Key images a device computed; every signature is verified before any is stored. */
  importDeviceKeyImages: (
    accountId: string,
    itemsJson: string,
  ) => Promise<string>;
  verifyTransaction: (signableHex: string, reviewJson: string) => Promise<void>;
  verifySignedTransaction: (
    signableHex: string,
    reviewJson: string,
    rawHex: string,
  ) => Promise<string>;

  /** Returned fee and amount are final. maxSend solves spendable - fee; omitting change would donate it to the miner. */
  prepareTransaction: (
    accountId: string,
    recipientsJson: string,
    maxSend: boolean,
    chainTip: string,
    priority: IXmrFeePriority,
  ) => Promise<string>;
  signTransactionWithBip32Key: (
    signableHex: string,
    bip32PrivateKeyHex: string,
    reviewJson: string,
  ) => Promise<string>;
  broadcastTransaction: (
    accountId: string,
    rawHex: string,
    chainTip: string,
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
    // Not a runtime error.
  }
  return null;
}

export * from './address';
export * from './sign';
export * from './types';
