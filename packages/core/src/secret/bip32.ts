/* eslint-disable spellcheck/spell-checker */
// eslint-disable-next-line max-classes-per-file
import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { hmacSHA512, hmacSHA512Sync } from './hash';

import type { BaseCurve, CurveForKD } from './curves';

export type IBip32ExtendedKeySerialized = {
  key: string;
  chainCode: string;
};
export type IBip32ExtendedKey = {
  key: Buffer;
  chainCode: Buffer;
};
// eslint-disable-next-line @typescript-eslint/naming-convention,camelcase
const BigInt_0 = new BigNumber(0);

function serNum(p: BigNumber, bits: 32 | 256): Buffer {
  if (p.lt(BigInt_0) || p.gte(new BigNumber(2).pow(bits))) {
    throw Error('Overflowed.');
  }

  const size = bits / 8;
  return Buffer.from(p.toString(16).padStart(size * 2, '0'), 'hex');
}

function ser32(index: number): Buffer {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
    throw Error('Invalid index.');
  }

  return serNum(new BigNumber(index), 32);
}

function ser256(p: BigNumber): Buffer {
  return serNum(p, 256);
}

function parse256(seq: Buffer): BigNumber {
  // eslint-disable-next-line eqeqeq
  if (seq.length != 32) {
    throw Error('Invalid sequence');
  }
  return new BigNumber(`0x${seq.toString('hex')}`);
}

function isHardenedIndex(index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= 2 ** 32) {
    throw Error('Invalid index.');
  }
  return index >= 2 ** 31;
}

function N(curve: BaseCurve, privateKey: Buffer): Buffer {
  const msgHash: Buffer = Buffer.from('Hello OneKey');
  const publicKey: Buffer = curve.publicFromPrivate(privateKey);

  if (!curve.verify(publicKey, msgHash, curve.sign(privateKey, msgHash))) {
    throw Error('Failed to generate public key from private.');
  }

  return publicKey;
}

export interface IBip32KeyDeriver {
  generateMasterKeyFromSeed(seed: Buffer): IBip32ExtendedKey;
  generateMasterKeyFromSeedAsync(seed: Buffer): Promise<IBip32ExtendedKey>;
  N(extPriv: IBip32ExtendedKey): IBip32ExtendedKey;
  CKDPriv(parent: IBip32ExtendedKey, index: number): IBip32ExtendedKey;
  CKDPub(parent: IBip32ExtendedKey, index: number): IBip32ExtendedKey;
}

class BaseBip32KeyDeriver implements IBip32KeyDeriver {
  /* NOTE: The retrying in key generation (in both master key generation
   * and CKD functions) doesn't follow BIP-0032 but SLIP-0010. */

  // eslint-disable-next-line no-useless-constructor
  constructor(private key: Buffer, private curve: CurveForKD) {
    // noop
  }

  /**
   * Generate master key from seed according to BIP32 specification.
   *
   * BIP32 Requirements for Master Key Generation:
   * 1. Deterministic: Same seed must generate same master key
   * 2. No retry mechanism: Must throw error if generated key is invalid
   * 3. One-to-one mapping: One seed can only map to one master key
   *
   * Reference implementations:
   * 1. bitcoinjs/bip32:
   *    https://github.com/bitcoinjs/bip32/blob/master/ts-src/bip32.ts
   *    ```typescript
   *    function fromSeed(seed: Buffer): BIP32Interface {
   *      let I = hmacSHA512(MASTER_SECRET, seed)
   *      let IL = I.slice(0, 32)
   *      if (ki.compareTo(curve.n) >= 0 || ki.equals(BigInteger.ZERO))
   *        throw new Error('Invalid master key')
   *      return new BIP32(ki, IR)
   *    }
   *    ```
   *
   * 2. trezor-firmware:
   *    https://github.com/trezor/trezor-firmware/blob/master/crypto/bip32.c
   *    ```c
   *    if (!check_private_key(I)) {
   *      return 0; // Return error directly
   *    }
   *    ```
   *
   * @param seed The seed buffer to generate master key from
   * @throws Error when generated key is invalid
   */
  generateMasterKeyFromSeed(seed: Buffer): IBip32ExtendedKey {
    const I: Buffer = hmacSHA512Sync(this.key, seed);
    const IL: Buffer = I.slice(0, 32);
    const chainCode: Buffer = I.slice(32, 64);

    const parsedIL: BigNumber = parse256(IL);

    // Validate the generated key:
    // 1. Must be less than curve's order (groupOrder)
    // 2. Must not be zero
    if (parsedIL.lt(this.curve.groupOrder) && !parsedIL.eq(BigInt_0)) {
      return { key: IL, chainCode };
    }

    // Throw error immediately instead of retrying
    // This ensures deterministic relationship between seed and master key
    throw new OneKeyLocalError('Invalid master key generated from seed');
  }

  async generateMasterKeyFromSeedAsync(
    seed: Buffer,
  ): Promise<IBip32ExtendedKey> {
    const I: Buffer = await hmacSHA512(this.key, seed);
    const IL: Buffer = I.slice(0, 32);
    const chainCode: Buffer = I.slice(32, 64);

    const parsedIL: BigNumber = parse256(IL);

    // Validate the generated key:
    // 1. Must be less than curve's order (groupOrder)
    // 2. Must not be zero
    if (parsedIL.lt(this.curve.groupOrder) && !parsedIL.eq(BigInt_0)) {
      return { key: IL, chainCode };
    }

    // Throw error immediately instead of retrying
    // This ensures deterministic relationship between seed and master key
    throw new OneKeyLocalError('Invalid master key generated from seed');
  }

  N(extPriv: IBip32ExtendedKey): IBip32ExtendedKey {
    return {
      key: N(this.curve as BaseCurve, extPriv.key),
      chainCode: extPriv.chainCode,
    };
  }

  /**
   * Derive child key according to BIP32 specification (CKDPriv).
   *
   * BIP32 Requirements for Child Key Derivation:
   * 1. Retry allowed: Must retry with modified data when generated child key is invalid
   * 2. Retry mechanism: Specific data modification process (data[0] = 1 + use new IR)
   * 3. Compatibility: All implementations must follow the same retry mechanism
   *
   * Reference implementations:
   * 1. bitcoinjs/bip32:
   *    ```typescript
   *    while (true) {
   *      if (IL.compare(curve.n) < 0 && !ki.isZero()) {
   *        return new BIP32(ki, IR);
   *      }
   *      data = Buffer.concat([Buffer.alloc(1, 1), IR, ser32(index)]);
   *      I = hmacSHA512(chainCode, data);
   *    }
   *    ```
   *
   * 2. trezor-firmware:
   *    ```c
   *    for (;;) {
   *      if (bn_is_less(&k, &order) && !bn_is_zero(&k)) {
   *        break;
   *      }
   *      data[0] = 1;
   *      memcpy(data + 1, I + 32, 32);
   *    }
   *    ```
   *
   * Validation conditions:
   * 1. parsedIL < groupOrder: Ensure private key is within valid curve range
   * 2. childKey != 0: Ensure generated child key is not zero
   *
   * @param parent Parent key to derive from
   * @param index Child key index
   */
  CKDPriv(parent: IBip32ExtendedKey, index: number): IBip32ExtendedKey {
    // Initialize derivation data
    const data: Buffer = Buffer.alloc(37);

    data.fill(ser32(index), 33, 37);
    if (isHardenedIndex(index)) {
      data.fill(parent.key, 1, 33);
    } else {
      data.fill(this.curve.publicFromPrivate(parent.key), 0, 33);
    }

    // BIP32 specified derivation process
    // Includes retry mechanism until valid child key is generated
    for (;;) {
      const I: Buffer = hmacSHA512Sync(parent.chainCode, data);
      const IR: Buffer = I.slice(32, 64);

      const parsedIL: BigNumber = parse256(I.slice(0, 32));
      const childKey: BigNumber = parsedIL
        .plus(parse256(parent.key))
        .mod(this.curve.groupOrder);

      // Validate generated child key
      if (parsedIL.lt(this.curve.groupOrder) && !childKey.eq(BigInt_0)) {
        return { key: ser256(childKey), chainCode: IR };
      }

      // Modify data for retry as specified in BIP32:
      // 1. Set first byte to 1
      // 2. Fill subsequent bytes with newly generated IR
      data[0] = 1;
      data.fill(IR, 1, 33);
      // Continue loop until valid child key is generated
      // https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#private-parent-key--private-child-key
    }
  }

  CKDPub(parent: IBip32ExtendedKey, index: number): IBip32ExtendedKey {
    if (isHardenedIndex(index)) {
      throw Error(`Can't derive public key for index ${index}.`);
    }

    const data: Buffer = Buffer.alloc(37);
    data.fill(parent.key, 0, 33);
    data.fill(ser32(index), 33, 37);

    for (;;) {
      const I: Buffer = hmacSHA512Sync(parent.chainCode, data);
      const IL: Buffer = I.slice(0, 32);
      const IR: Buffer = I.slice(32, 64);

      const childKey: Buffer | null = this.curve.getChildPublicKey(
        IL,
        parent.key,
      );
      if (childKey !== null) {
        return { key: childKey, chainCode: IR };
      }

      data[0] = 1;
      data.fill(IR, 1, 33);
      // https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#public-parent-key--public-child-key
    }
  }
}

class ED25519Bip32KeyDeriver implements IBip32KeyDeriver {
  // eslint-disable-next-line no-useless-constructor
  constructor(private key: Buffer, private curve: BaseCurve) {
    // noop
  }

  generateMasterKeyFromSeed(seed: Buffer): IBip32ExtendedKey {
    const I: Buffer = hmacSHA512Sync(this.key, seed);
    return { key: I.slice(0, 32), chainCode: I.slice(32, 64) };
  }

  async generateMasterKeyFromSeedAsync(
    seed: Buffer,
  ): Promise<IBip32ExtendedKey> {
    const I: Buffer = await hmacSHA512(this.key, seed);
    return { key: I.slice(0, 32), chainCode: I.slice(32, 64) };
  }

  N(extPriv: IBip32ExtendedKey): IBip32ExtendedKey {
    return { key: N(this.curve, extPriv.key), chainCode: extPriv.chainCode };
  }

  CKDPriv(parent: IBip32ExtendedKey, index: number): IBip32ExtendedKey {
    if (!isHardenedIndex(index)) {
      throw Error('Only hardened CKDPriv is supported for ed25519.');
    }
    const data: Buffer = Buffer.alloc(37);
    data.fill(parent.key, 1, 33);
    data.fill(ser32(index), 33, 37);

    const I: Buffer = hmacSHA512Sync(parent.chainCode, data);
    return { key: I.slice(0, 32), chainCode: I.slice(32, 64) };
  }

  CKDPub(_parent: IBip32ExtendedKey, _index: number): IBip32ExtendedKey {
    // CKDPub(parent: ExtendedKey, index: number): ExtendedKey {
    throw Error('CKDPub is not supported for ed25519.');
  }
}

export { BaseBip32KeyDeriver, ED25519Bip32KeyDeriver, parse256, ser256 };
