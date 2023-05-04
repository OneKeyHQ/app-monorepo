import { sha256 } from '@noble/hashes/sha256';

import ecc from '../vaults/utils/btcForkChain/provider/nobleSecp256k1Wrapper';

const TAGGED_HASH_PREFIXES = {
  TapLeaf: Buffer.from([
    174, 234, 143, 220, 66, 8, 152, 49, 5, 115, 75, 88, 8, 29, 30, 38, 56, 211,
    95, 28, 181, 64, 8, 212, 211, 87, 202, 3, 190, 120, 233, 238, 174, 234, 143,
    220, 66, 8, 152, 49, 5, 115, 75, 88, 8, 29, 30, 38, 56, 211, 95, 28, 181,
    64, 8, 212, 211, 87, 202, 3, 190, 120, 233, 238,
  ]),
  TapBranch: Buffer.from([
    25, 65, 161, 242, 229, 110, 185, 95, 162, 169, 241, 148, 190, 92, 1, 247,
    33, 111, 51, 237, 130, 176, 145, 70, 52, 144, 208, 91, 245, 22, 160, 21, 25,
    65, 161, 242, 229, 110, 185, 95, 162, 169, 241, 148, 190, 92, 1, 247, 33,
    111, 51, 237, 130, 176, 145, 70, 52, 144, 208, 91, 245, 22, 160, 21,
  ]),
  TapSighash: Buffer.from([
    244, 10, 72, 223, 75, 42, 112, 200, 180, 146, 75, 242, 101, 70, 97, 237, 61,
    149, 253, 102, 163, 19, 235, 135, 35, 117, 151, 198, 40, 228, 160, 49, 244,
    10, 72, 223, 75, 42, 112, 200, 180, 146, 75, 242, 101, 70, 97, 237, 61, 149,
    253, 102, 163, 19, 235, 135, 35, 117, 151, 198, 40, 228, 160, 49,
  ]),
  TapTweak: Buffer.from([
    232, 15, 225, 99, 156, 156, 160, 80, 227, 175, 27, 57, 193, 67, 198, 62, 66,
    156, 188, 235, 21, 217, 64, 251, 181, 197, 161, 244, 175, 87, 197, 233, 232,
    15, 225, 99, 156, 156, 160, 80, 227, 175, 27, 57, 193, 67, 198, 62, 66, 156,
    188, 235, 21, 217, 64, 251, 181, 197, 161, 244, 175, 87, 197, 233,
  ]),
};

function taggedHash(prefix: string, data: Buffer): Buffer {
  // @ts-ignore
  const tagged: Buffer = TAGGED_HASH_PREFIXES[prefix];

  const hash = sha256.create();
  hash.update(tagged);
  hash.update(data);
  return Buffer.from(hash.digest());
}

export function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer {
  return taggedHash('TapTweak', Buffer.concat(h ? [pubKey, h] : [pubKey]));
}

export function tweakPublicKey(
  pubKey: Buffer,
  h: Buffer | undefined = undefined,
): { parity: number; x: Uint8Array } | null {
  if (!Buffer.isBuffer(pubKey)) return null;
  if (pubKey.length !== 32) return null;
  if (h && h.length !== 32) return null;

  const tweakHash = tapTweakHash(pubKey, h);
  // @ts-expect-error
  const res: { parity: number; xOnlyPubkey: Uint8Array } =
    ecc.xOnlyPointAddTweak(pubKey, tweakHash);
  if (!res || res.xOnlyPubkey === null) return null;

  return {
    parity: res.parity,
    x: Buffer.from(res.xOnlyPubkey),
  };
}
