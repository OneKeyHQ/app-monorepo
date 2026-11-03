import { blake2b } from '@noble/hashes/blake2b';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// ZIP-32 Orchard derivation (hardened-only). Background only: never import
// this from sdkZcash/impl, which is bundled into the carrier Worker.

export const ZCASH_COIN_TYPE = 133;
const ZIP32_PURPOSE = 32;
const HARDENED = 0x80_00_00_00;

const ORCHARD_MASTER_PERSONAL = Buffer.from('ZcashIP32Orchard', 'ascii');
const PRF_EXPAND_PERSONAL = Buffer.from('Zcash_ExpandSeed', 'ascii');
const SEED_FP_PERSONAL = Buffer.from('Zcash_HD_Seed_FP', 'ascii');
const ORCHARD_CHILD_DOMAIN = 0x81;

export type IZip32OrchardKey = {
  sk: Uint8Array; // 32 bytes
  chainCode: Uint8Array; // 32 bytes
};

function assertSeedLength(seed: Uint8Array) {
  if (seed.length < 32 || seed.length > 252) {
    throw new OneKeyLocalError('zcash: ZIP-32 seed must be 32..252 bytes');
  }
}

function splitAndWipe(i: Uint8Array): IZip32OrchardKey {
  try {
    return { sk: i.slice(0, 32), chainCode: i.slice(32, 64) };
  } finally {
    i.fill(0);
  }
}

export function wipeZip32OrchardKey(key: IZip32OrchardKey) {
  key.sk.fill(0);
  key.chainCode.fill(0);
}

export function zip32OrchardMaster(seed: Uint8Array): IZip32OrchardKey {
  assertSeedLength(seed);
  return splitAndWipe(
    blake2b(seed, { dkLen: 64, personalization: ORCHARD_MASTER_PERSONAL }),
  );
}

// I = PRF^expand(c_par, [0x81] || sk_par || LE32(i)); i includes the
// hardened bit.
export function zip32OrchardHardenedChild(
  parent: IZip32OrchardKey,
  index: number,
): IZip32OrchardKey {
  if (!Number.isInteger(index) || index < 0 || index >= HARDENED) {
    throw new OneKeyLocalError('zcash: invalid ZIP-32 child index');
  }
  const indexLe = new Uint8Array(4);
  new DataView(indexLe.buffer).setUint32(0, (index | HARDENED) >>> 0, true);
  const h = blake2b.create({
    dkLen: 64,
    personalization: PRF_EXPAND_PERSONAL,
  });
  h.update(parent.chainCode);
  h.update(Uint8Array.of(ORCHARD_CHILD_DOMAIN));
  h.update(parent.sk);
  h.update(indexLe);
  return splitAndWipe(h.digest());
}

export function zip32OrchardDerivePath(
  seed: Uint8Array,
  path: number[],
): IZip32OrchardKey {
  let key = zip32OrchardMaster(seed);
  for (const index of path) {
    const child = zip32OrchardHardenedChild(key, index);
    wipeZip32OrchardKey(key);
    key = child;
  }
  return key;
}

// Orchard account spending key at m/32'/133'/account'. Rust validates the
// final key (SpendingKey::from_bytes) and fails closed.
export function deriveZcashOrchardSpendingKey({
  seed,
  accountIndex,
}: {
  seed: Uint8Array;
  accountIndex: number;
}): Uint8Array {
  const key = zip32OrchardDerivePath(seed, [
    ZIP32_PURPOSE,
    ZCASH_COIN_TYPE,
    accountIndex,
  ]);
  try {
    return key.sk.slice();
  } finally {
    wipeZip32OrchardKey(key);
  }
}

// ZIP-32 seed fingerprint: BLAKE2b-256("Zcash_HD_Seed_FP", [len] || seed).
export function zcashSeedFingerprintHex(seed: Uint8Array): string {
  assertSeedLength(seed);
  const h = blake2b.create({ dkLen: 32, personalization: SEED_FP_PERSONAL });
  h.update(Uint8Array.of(seed.length));
  h.update(seed);
  return Buffer.from(h.digest()).toString('hex');
}
