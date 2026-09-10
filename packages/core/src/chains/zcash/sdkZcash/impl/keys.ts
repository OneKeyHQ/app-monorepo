import bs58check from 'bs58check';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getKeys, getRuntime, pickLightwalletdUrl } from './carrier';

import type {
  IZcashDeriveAccountParams,
  IZcashDeriveAccountResult,
  IZcashDeriveAddressFromUfvkParams,
  IZcashDeriveAddressFromUfvkResult,
  IZcashDeriveTransparentXpubFromUfvkParams,
  IZcashGetChainTipParams,
  IZcashNetwork,
  IZcashSignPcztParams,
  IZcashTransparentTxBuildResult,
  IZcashTransparentTxQuote,
  IZcashTransparentTxRequest,
} from '../types/sdk';

// Everything that touches the seed lives in the keys package, which has no
// storage, no network and no SQLite. The split is a compile-time boundary:
// the keys crate does not depend on the wallet crate, so spending material
// cannot reach the scanning code even by accident.

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function deriveAccount(
  params: IZcashDeriveAccountParams,
): Promise<IZcashDeriveAccountResult> {
  const keys = await getKeys();
  const { ufvk, seedFingerprintHex } = (() => {
    const seed = hexToBytes(params.seedHex);
    try {
      // Reuse one mutable copy for every seed-derived value. In particular,
      // do not reconstruct the root seed for the fingerprint after clearing
      // the UFVK input.
      return {
        ufvk: keys.ufvkFromSeed(params.network, seed, params.hdIndex),
        seedFingerprintHex: keys.seedFingerprint(seed),
      };
    } finally {
      // Clear before any network await below, including when either wasm call
      // throws. The immutable wire-format string is released by the caller's
      // RPC lifecycle and cannot be cleared in JavaScript.
      seed.fill(0);
    }
  })();

  // Both addresses come from the UFVK alone — no wallet database, no network.
  //
  // The unified address is shielded-only: no Sapling receiver (this wallet can
  // never spend Sapling, so advertising it would strand incoming funds) and no
  // transparent receiver (that would tie the user's transparent activity to
  // their shielded activity in one string). The transparent address is handed
  // out separately, for counterparties that only accept `t1...`.
  const unifiedAddress = keys.unifiedAddress(params.network, ufvk, 'orchard');
  const transparentAddress = keys.transparentAddressFromUfvk(
    params.network,
    ufvk,
  );

  let chainTip: number | null = null;
  try {
    const rt = await getRuntime();
    chainTip = await rt.chainTipAt(params.lightwalletdUrl);
  } catch {
    // Offline, or a carrier without the wallet runtime. A null tip is a
    // documented outcome, not a failure: the caller picks a birthday from it
    // and already has to handle null.
    chainTip = null;
  }

  return {
    ufvk,
    seedFingerprintHex,
    unifiedAddress,
    transparentAddress,
    chainTip,
  };
}

export async function deriveAddressFromUfvk(
  params: IZcashDeriveAddressFromUfvkParams,
): Promise<IZcashDeriveAddressFromUfvkResult> {
  const keys = await getKeys();
  return {
    unifiedAddress: keys.unifiedAddress(params.network, params.ufvk, 'orchard'),
    transparentAddress: keys.transparentAddressFromUfvk(
      params.network,
      params.ufvk,
    ),
  };
}

// Serialized BIP32 extended public key. The UFVK carries only chain code and
// public key, so depth/child number are set from the known account path and
// the parent fingerprint is left zero (it is metadata, not used for derivation).
const XPUB_VERSION: Record<IZcashNetwork, number> = {
  main: 0x04_88_b2_1e,
  test: 0x04_35_87_cf,
};

export async function deriveTransparentXpubFromUfvk(
  params: IZcashDeriveTransparentXpubFromUfvkParams,
): Promise<{ xpub: string }> {
  const keys = await getKeys();
  const accountKey = Buffer.from(
    keys.transparentAccountPubKeyFromUfvk(params.network, params.ufvk),
    'hex',
  );
  if (accountKey.length !== 65) {
    throw new OneKeyLocalError(
      `zcash: unexpected transparent account key length ${accountKey.length}`,
    );
  }
  const payload = Buffer.alloc(78);
  payload.writeUInt32BE(XPUB_VERSION[params.network], 0);
  payload[4] = 3; // depth: m/44'/133'/account'
  payload.writeUInt32BE(0, 5); // parent fingerprint unknown
  payload.writeUInt32BE(0x80_00_00_00 + params.hdIndex, 9); // hardened child
  accountKey.copy(payload, 13); // chain code (32) + compressed pubkey (33)
  return { xpub: bs58check.encode(payload) };
}

export async function signPczt(
  params: IZcashSignPcztParams,
): Promise<{ pcztHex: string }> {
  const keys = await getKeys();
  const seed = hexToBytes(params.seedHex);
  try {
    const signed = keys.pcztSignWithSeed(
      params.network,
      seed,
      params.hdIndex,
      hexToBytes(params.pcztHex),
    );
    return { pcztHex: bytesToHex(signed) };
  } finally {
    // Only clears this copy. The caller's `seedHex` string is immutable and
    // stays until GC — that is the host's problem to bound, not something the
    // wasm boundary can fix.
    seed.fill(0);
  }
}

export async function quoteTransparentTx(
  params: IZcashTransparentTxRequest,
): Promise<IZcashTransparentTxQuote> {
  const keys = await getKeys();
  return JSON.parse(
    keys.transparentTxQuote(JSON.stringify(params)),
  ) as IZcashTransparentTxQuote;
}

export async function buildTransparentTxWithSeed(
  params: IZcashTransparentTxRequest & { seedHex: string },
): Promise<IZcashTransparentTxBuildResult> {
  const { seedHex, ...request } = params;
  const keys = await getKeys();
  const seed = hexToBytes(seedHex);
  try {
    return JSON.parse(
      keys.transparentTxBuildWithSeed(JSON.stringify(request), seed),
    ) as IZcashTransparentTxBuildResult;
  } finally {
    seed.fill(0);
  }
}

export async function buildTransparentTxWithAccountXprv(
  params: IZcashTransparentTxRequest & { accountXprvHex: string },
): Promise<IZcashTransparentTxBuildResult> {
  const { accountXprvHex, ...request } = params;
  const keys = await getKeys();
  const accountXprvBytes = hexToBytes(accountXprvHex);
  try {
    return JSON.parse(
      keys.transparentTxBuildWithAccountXprv(
        JSON.stringify(request),
        bs58check.encode(accountXprvBytes),
      ),
    ) as IZcashTransparentTxBuildResult;
  } finally {
    accountXprvBytes.fill(0);
  }
}

export async function getChainTip(
  params: IZcashGetChainTipParams,
): Promise<number | null> {
  try {
    const rt = await getRuntime();
    return await rt.chainTipAt(pickLightwalletdUrl(params.lightwalletdUrl));
  } catch {
    // Contract: null on failure rather than throwing. Callers use the tip to
    // pick a birthday or show progress; neither should break when offline.
    return null;
  }
}
