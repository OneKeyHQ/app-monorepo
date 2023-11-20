import type BigNumber from 'bignumber.js';

export interface IBaseCurve {
  transformPublicKey(publicKey: Buffer): Buffer; // uncompressPublicKey or compressPublicKey
  publicFromPrivate(privateKey: Buffer): Buffer;
  verify(publicKey: Buffer, digest: Buffer, signature: Buffer): boolean;
  sign(privateKey: Buffer, digest: Buffer): Buffer;
}

export interface ICurveForKD extends IBaseCurve {
  groupOrder: BigNumber;
  getChildPublicKey(IL: Buffer, parentPublicKey: Buffer): Buffer | null;
}
