import type BN from 'bn.js';

export function getBufferFromBN(
  r: BN,
  endian?: BN.Endianness,
  length?: number,
): Buffer {
  try {
    return r.toBuffer(endian, length);
  } catch (error) {
    return r.toArrayLike(Buffer, endian, length);
  }
}
