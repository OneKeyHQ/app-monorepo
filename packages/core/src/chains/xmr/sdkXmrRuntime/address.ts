/**
 * Pure derivation only (no DB/node/scanning); math is delegated to the
 * runtime to keep this bit-identical to V4, or V4 mnemonics see an empty wallet.
 */

import type { IXmrNetwork } from './types';

export type IXmrDerivedAccount = {
  primaryAddress: string;
  spendPublicKeyHex: string;
  /**
   * Persisted view key for scanning (same trust boundary as a Zcash UFVK).
   * Spend key is deliberately excluded to avoid widening key exposure.
   */
  viewPrivateKeyHex: string;
};

/**
 * Derivation, validation, and signing only (no DB/node/scanning) - signing
 * here consumes an already-built review object, so it needs no network.
 */
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
  /**
   * The V4 reduction: BIP-32 key in, Monero spend scalar out. Returns bare
   * hex, not JSON.
   */
  spendScalar: (bip32PrivateKeyHex: string) => Promise<string>;
  signTransaction: (
    signableHex: string,
    spendPrivateKeyHex: string,
    reviewJson: string,
  ) => Promise<string>;
  verifyTransaction: (signableHex: string, reviewJson: string) => Promise<void>;
};

let runtimeLoader: (() => Promise<IXmrPureRuntimeApi>) | undefined;

/** Installed once per carrier (web, desktop, extension bg, native) at startup. */
export function setXmrRuntimeLoader(loader: () => Promise<IXmrPureRuntimeApi>) {
  runtimeLoader = loader;
}

/**
 * The pure runtime, loading it in-process if no carrier registered one.
 * Exported so the signing path shares this exact accessor.
 */
export async function getXmrPureRuntime(): Promise<IXmrPureRuntimeApi> {
  if (runtimeLoader) {
    return runtimeLoader();
  }
  // Fallback when no carrier registered a loader: derivation is cheap pure
  // compute, so it doesn't need the Worker that scanning requires.
  const { loadXmrRuntime } = await import('./carrier/loadRuntime');
  const api = await loadXmrRuntime();
  return {
    deriveAccount: api.deriveAccount,
    deriveSubaddress: api.deriveSubaddress,
    validateAddress: api.validateAddress,
    spendScalar: api.spendScalar,
    signTransaction: api.signTransaction,
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

/**
 * Network scoping matters: a mainnet address on testnet is not "wrong
 * network" - it's a well-formed destination nobody holds the keys to.
 */
export async function validateXmrAddress(params: {
  address: string;
  network?: IXmrNetwork;
}): Promise<boolean> {
  const api = await getXmrPureRuntime();
  return api.validateAddress(params.network ?? 'mainnet', params.address);
}
