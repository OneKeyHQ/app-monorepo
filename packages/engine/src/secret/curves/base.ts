import type BigNumber from 'bignumber.js';

export interface BaseCurve {
  transformPublicKey(publicKey: Buffer): Buffer;
  publicFromPrivate(privateKey: Buffer): Buffer;
  verify(publicKey: Buffer, digest: Buffer, signature: Buffer): boolean;
  sign(privateKey: Buffer, digest: Buffer): Buffer;
}

export interface CurveForKD extends BaseCurve {
  groupOrder: BigNumber;
  getChildPublicKey(IL: Buffer, parentPublicKey: Buffer): Buffer | null;
}
