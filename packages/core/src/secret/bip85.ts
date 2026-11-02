import { wordlists } from 'bip39';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { BaseBip32KeyDeriver } from './bip32';
import { entropyToMnemonic } from './bip39';
import { secp256k1 } from './curves';
import { hmacSHA512Sync } from './hash';

import type { IBip32ExtendedKey } from './bip32';

const HARDENED_OFFSET = 0x80_00_00_00;
const BIP85_ENTROPY_HMAC_KEY = Buffer.from('bip-entropy-from-k', 'ascii');

export const BIP85_PURPOSE = 83_696_968;

/**
 * BIP-85 application number of OneKey Lightning: the ASCII bytes of "OKLN"
 * read as one integer. Changing it moves every user to a different Lightning
 * account, so it is frozen once the first mainnet user exists.
 */
export const LIGHTNING_SPARK_BIP85_APP = 1_330_334_798;

/**
 * Spec v1 path m/83696968'/1330334798'/0'/12'/0' (English, 12 words,
 * index 0). Every index is hardened.
 */
export const LIGHTNING_SPARK_BIP85_PATH: readonly number[] = [
  BIP85_PURPOSE,
  LIGHTNING_SPARK_BIP85_APP,
  0,
  12,
  0,
];

const secp256k1Deriver = new BaseBip32KeyDeriver(
  Buffer.from('Bitcoin seed'),
  secp256k1,
);

export function generateSecp256k1MasterKeyFromSeed(
  seed: Buffer,
): IBip32ExtendedKey {
  return secp256k1Deriver.generateMasterKeyFromSeed(seed);
}

/**
 * Derives a fully hardened secp256k1 path. `path` holds unhardened index
 * values. Intermediate nodes are zeroed; the caller owns `root` and the
 * returned node.
 */
export function deriveSecp256k1HardenedPath(
  root: IBip32ExtendedKey,
  path: readonly number[],
): IBip32ExtendedKey {
  let node = root;
  for (const index of path) {
    if (!Number.isInteger(index) || index < 0 || index >= HARDENED_OFFSET) {
      throw new OneKeyLocalError('Invalid BIP-85 path index');
    }
    const next = secp256k1Deriver.CKDPriv(node, index + HARDENED_OFFSET);
    if (node !== root) {
      node.key.fill(0);
      node.chainCode.fill(0);
    }
    node = next;
  }
  return node;
}

/**
 * BIP-85: k is the private key at the fully hardened `path` below `root`, and
 * the entropy is HMAC-SHA512(key = "bip-entropy-from-k", msg = k).
 * `path` holds unhardened index values; each one is hardened here.
 * The caller owns both returned buffers and must fill(0) them after use.
 */
export function deriveBip85({
  root,
  path,
}: {
  root: IBip32ExtendedKey;
  path: readonly number[];
}): { derivedKey: Buffer; entropy: Buffer } {
  if (path.length === 0) {
    throw new OneKeyLocalError('Empty BIP-85 path');
  }
  const node = deriveSecp256k1HardenedPath(root, path);
  node.chainCode.fill(0);
  return {
    derivedKey: node.key,
    entropy: hmacSHA512Sync(BIP85_ENTROPY_HMAC_KEY, node.key),
  };
}

/**
 * Derives the Lightning (Spark) child mnemonic from a wallet's BIP39 seed
 * (mnemonic plus passphrase, already stretched): BIP-85 at
 * LIGHTNING_SPARK_BIP85_PATH, first 16 bytes, English wordlist. The child is
 * always 12 words whatever the parent length, and is used with an empty
 * passphrase. It must never be shown, exported or persisted.
 */
export function deriveLightningSparkChildMnemonic({
  seed,
}: {
  seed: Buffer;
}): string {
  const root = generateSecp256k1MasterKeyFromSeed(seed);
  let derivedKey: Buffer | undefined;
  let entropy: Buffer | undefined;
  try {
    ({ derivedKey, entropy } = deriveBip85({
      root,
      path: LIGHTNING_SPARK_BIP85_PATH,
    }));
    return entropyToMnemonic(entropy.subarray(0, 16), wordlists.english);
  } finally {
    root.key.fill(0);
    root.chainCode.fill(0);
    derivedKey?.fill(0);
    entropy?.fill(0);
  }
}
