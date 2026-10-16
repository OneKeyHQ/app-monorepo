import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getBitcoinBip32 } from '../btc/sdkBtc';

import {
  ZCASH_COIN_TYPE,
  deriveZcashOrchardSpendingKey,
  zcashSeedFingerprintHex,
} from './zip32Orchard';

import type { BIP32Interface } from 'bip32';

// Account-scoped keys the Zcash SDK may receive instead of the BIP39 seed.
// Background only: never import this from sdkZcash/impl (carrier Worker).
export type IZcashAccountSecrets = {
  // 32-byte Orchard spending key at m/32'/133'/account'. Caller must wipe it.
  orchardSk: Uint8Array;
  // Raw 78-byte BIP32 xprv payload at m/44'/133'/account' (hex wire format of
  // buildTransparentTxWithAccountXprv).
  accountXprvHex: string;
  // Public counterpart; compare against the stored account xpub.
  accountXpub: string;
  seedFingerprintHex: string;
};

const XPRV_VERSION_MAIN = 0x04_88_ad_e4;
const HARDENED = 0x80_00_00_00;

function assertAccountIndex(accountIndex: number) {
  if (
    !Number.isInteger(accountIndex) ||
    accountIndex < 0 ||
    accountIndex >= HARDENED
  ) {
    throw new OneKeyLocalError('zcash: invalid account index');
  }
}

function deriveTransparentAccountKeys({
  seed,
  accountIndex,
  includeXprv,
}: {
  seed: Uint8Array;
  accountIndex: number;
  includeXprv: boolean;
}): { accountXpub: string; accountXprvHex?: string } {
  const seedCopy = Buffer.from(seed);
  const payload = Buffer.alloc(78);
  const nodes: BIP32Interface[] = [];
  try {
    // Step by step so every intermediate private node can be wiped.
    let node = getBitcoinBip32().fromSeed(seedCopy);
    nodes.push(node);
    for (const index of [44, ZCASH_COIN_TYPE, accountIndex]) {
      node = node.deriveHardened(index);
      nodes.push(node);
    }
    const accountXpub = node.neutered().toBase58();
    if (!includeXprv) return { accountXpub };
    const privateKey = node.privateKey;
    if (!privateKey) {
      throw new OneKeyLocalError('zcash: account private key missing');
    }
    payload.writeUInt32BE(XPRV_VERSION_MAIN, 0);
    payload[4] = node.depth;
    payload.writeUInt32BE(node.parentFingerprint, 5);
    payload.writeUInt32BE(node.index, 9);
    payload.set(node.chainCode, 13);
    payload[45] = 0;
    payload.set(privateKey, 46);
    return { accountXpub, accountXprvHex: payload.toString('hex') };
  } finally {
    payload.fill(0);
    seedCopy.fill(0);
    for (const n of nodes) {
      n.privateKey?.fill(0);
      n.chainCode.fill(0);
    }
  }
}

export type IZcashAccountViewingSecrets = Omit<
  IZcashAccountSecrets,
  'accountXprvHex'
>;

// Signing: Orchard sk + transparent account xprv.
export function deriveZcashAccountSecrets({
  seed,
  accountIndex,
}: {
  seed: Uint8Array;
  accountIndex: number;
}): IZcashAccountSecrets {
  assertAccountIndex(accountIndex);
  const seedFingerprintHex = zcashSeedFingerprintHex(seed);
  const { accountXpub, accountXprvHex } = deriveTransparentAccountKeys({
    seed,
    accountIndex,
    includeXprv: true,
  });
  if (!accountXprvHex) {
    throw new OneKeyLocalError('zcash: account xprv missing');
  }
  return {
    orchardSk: deriveZcashOrchardSpendingKey({ seed, accountIndex }),
    accountXprvHex,
    accountXpub,
    seedFingerprintHex,
  };
}

// Viewing-key setup: Orchard sk only; the transparent part comes from the
// stored account xpub, so no transparent secret leaves this function.
export function deriveZcashAccountViewingSecrets({
  seed,
  accountIndex,
}: {
  seed: Uint8Array;
  accountIndex: number;
}): IZcashAccountViewingSecrets {
  assertAccountIndex(accountIndex);
  const seedFingerprintHex = zcashSeedFingerprintHex(seed);
  const { accountXpub } = deriveTransparentAccountKeys({
    seed,
    accountIndex,
    includeXprv: false,
  });
  return {
    orchardSk: deriveZcashOrchardSpendingKey({ seed, accountIndex }),
    accountXpub,
    seedFingerprintHex,
  };
}
