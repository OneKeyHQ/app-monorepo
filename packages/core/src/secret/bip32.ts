// eslint-disable-next-line max-classes-per-file
import BigNumber from 'bignumber.js';

import { hmacSHA512 } from './hash';

import type { BaseCurve, CurveForKD } from './curves';

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
  if (!Number.isInteger(index)) {
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

  generateMasterKeyFromSeed(seed: Buffer): IBip32ExtendedKey {
    const I: Buffer = hmacSHA512(this.key, seed);
    const IL: Buffer = I.slice(0, 32);
    const chainCode: Buffer = I.slice(32, 64);

    const parsedIL: BigNumber = parse256(IL);
    if (parsedIL.lt(this.curve.groupOrder) && !parsedIL.eq(BigInt_0)) {
      return { key: IL, chainCode };
    }
    return this.generateMasterKeyFromSeed(I);
  }

  N(extPriv: IBip32ExtendedKey): IBip32ExtendedKey {
    return {
      key: N(this.curve as BaseCurve, extPriv.key),
      chainCode: extPriv.chainCode,
    };
  }

  CKDPriv(parent: IBip32ExtendedKey, index: number): IBip32ExtendedKey {
    const data: Buffer = Buffer.alloc(37);

    data.fill(ser32(index), 33, 37);
    if (isHardenedIndex(index)) {
      data.fill(parent.key, 1, 33);
    } else {
      data.fill(this.curve.publicFromPrivate(parent.key), 0, 33);
    }

    for (;;) {
      const I: Buffer = hmacSHA512(parent.chainCode, data);
      const IR: Buffer = I.slice(32, 64);

      const parsedIL: BigNumber = parse256(I.slice(0, 32));
      const childKey: BigNumber = parsedIL
        .plus(parse256(parent.key))
        .mod(this.curve.groupOrder);
      if (parsedIL.lt(this.curve.groupOrder) && !childKey.eq(BigInt_0)) {
        return { key: ser256(childKey), chainCode: IR };
      }

      data[0] = 1;
      data.fill(IR, 1, 33);
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
      const I: Buffer = hmacSHA512(parent.chainCode, data);
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
    }
  }
}

class ED25519Bip32KeyDeriver implements IBip32KeyDeriver {
  // eslint-disable-next-line no-useless-constructor
  constructor(private key: Buffer, private curve: BaseCurve) {
    // noop
  }

  generateMasterKeyFromSeed(seed: Buffer): IBip32ExtendedKey {
    const I: Buffer = hmacSHA512(this.key, seed);
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

    const I: Buffer = hmacSHA512(parent.chainCode, data);
    return { key: I.slice(0, 32), chainCode: I.slice(32, 64) };
  }

  CKDPub(): IBip32ExtendedKey {
    // CKDPub(parent: ExtendedKey, index: number): ExtendedKey {
    throw Error('CKDPub is not supported for ed25519.');
  }
}

export { BaseBip32KeyDeriver, ED25519Bip32KeyDeriver, parse256, ser256 };
