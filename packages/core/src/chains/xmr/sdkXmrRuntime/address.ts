import type { IXmrNetwork } from './types';

export type IXmrDerivedAccount = {
  primaryAddress: string;
  spendPublicKeyHex: string;
  /** Persisted for scanning; the spend key is deliberately never returned. */
  viewPrivateKeyHex: string;
};

/** Derivation, validation and signing only: no database, node or scanning. */
export type IXmrPureRuntimeApi = {
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
  /** Reduces the BIP-32 key to the spend key inside the runtime; neither comes back. */
  signTransactionWithBip32Key: (
    signableHex: string,
    bip32PrivateKeyHex: string,
    reviewJson: string,
  ) => Promise<string>;
  verifyTransaction: (signableHex: string, reviewJson: string) => Promise<void>;
};

let runtimeLoader: (() => Promise<IXmrPureRuntimeApi>) | undefined;

export function setXmrRuntimeLoader(loader: () => Promise<IXmrPureRuntimeApi>) {
  runtimeLoader = loader;
}

export async function getXmrPureRuntime(): Promise<IXmrPureRuntimeApi> {
  if (runtimeLoader) {
    return runtimeLoader();
  }
  const { loadXmrRuntime } = await import('./carrier/loadRuntime');
  const api = await loadXmrRuntime();
  return {
    deriveAccount: api.deriveAccount,
    deriveSubaddress: api.deriveSubaddress,
    validateAddress: api.validateAddress,
    signTransactionWithBip32Key: api.signTransactionWithBip32Key,
    verifyTransaction: api.verifyTransaction,
  };
}

export async function deriveXmrAccount(params: {
  network: IXmrNetwork;
  bip32PrivateKeyHex: string;
}): Promise<IXmrDerivedAccount> {
  const api = await getXmrPureRuntime();
  return JSON.parse(
    await api.deriveAccount(params.network, params.bip32PrivateKeyHex),
  ) as IXmrDerivedAccount;
}

export async function deriveXmrSubaddress(params: {
  network: IXmrNetwork;
  spendPublicKeyHex: string;
  viewPrivateKeyHex: string;
  major: number;
  minor: number;
}): Promise<{ address: string; major: number; minor: number }> {
  const api = await getXmrPureRuntime();
  return JSON.parse(
    await api.deriveSubaddress(
      params.network,
      params.spendPublicKeyHex,
      params.viewPrivateKeyHex,
      params.major,
      params.minor,
    ),
  ) as { address: string; major: number; minor: number };
}

/** A mainnet address on testnet is well-formed, but nobody holds its keys. */
export async function validateXmrAddress(params: {
  address: string;
  network?: IXmrNetwork;
}): Promise<boolean> {
  const api = await getXmrPureRuntime();
  return api.validateAddress(params.network ?? 'mainnet', params.address);
}
