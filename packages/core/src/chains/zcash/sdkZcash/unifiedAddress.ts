import { jubjub, jubjub_groupHash, pallas } from '@noble/curves/misc';
import { blake2b } from '@noble/hashes/blake2b';
import { bech32m } from 'bech32';
import { decode as decodeCompactSize, encodingLength } from 'varuint-bitcoin';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// ZIP-316 permits bounded consumers supporting at least 256 decoded bytes.
// This limit also bounds work on each address-input change.
const MAX_UNIFIED_BYTES = 1024;
const MAX_UNIFIED_CHARACTERS = 8 + Math.ceil((MAX_UNIFIED_BYTES * 8) / 5);
const RECEIVER_LENGTHS = [20, 20, 43, 43];

function invalidAddress(): never {
  throw new OneKeyLocalError('Invalid Zcash Unified Address');
}

// ZIP-316 F4Jumble inverse. Hashing and point decoding use existing libraries.
function unjumble(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 48 || bytes.length > MAX_UNIFIED_BYTES) invalidAddress();
  const decoded = Uint8Array.from(bytes);
  const left = decoded.subarray(
    0,
    Math.min(64, Math.floor(decoded.length / 2)),
  );
  const right = decoded.subarray(left.length);
  for (const round of [1, 0]) {
    const h = blake2b(right, {
      dkLen: left.length,
      personalization: Buffer.concat([
        Buffer.from('UA_F4Jumble_H'),
        Buffer.from([round, 0, 0]),
      ]),
    });
    for (let i = 0; i < left.length; i += 1) left[i] ^= h[i];
    for (let offset = 0; offset < right.length; offset += 64) {
      const block = offset / 64;
      const g = blake2b(left, {
        dkLen: 64,
        personalization: Buffer.concat([
          Buffer.from('UA_F4Jumble_G'),
          Buffer.from([round, block & 0xff, block >>> 8]),
        ]),
      });
      for (let i = 0; i < Math.min(64, right.length - offset); i += 1)
        right[offset + i] ^= g[i];
    }
  }
  return decoded;
}

function validateOrchardReceiver(receiver: Uint8Array) {
  // Orchard encodes x little-endian with y's parity in the high bit.
  // Convert that public point to SEC1 for the existing Pallas decoder.
  const x = Uint8Array.from(receiver.subarray(11));
  const parity = x[31] >>> 7;
  x[31] &= 0x7f;
  if (x.every((byte) => byte === 0) && parity === 0) invalidAddress();
  const point = pallas.Point.fromHex(
    Uint8Array.from([2 + parity, ...x.toReversed()]),
  );
  point.assertValidity();
}

function validateSaplingReceiver(receiver: Uint8Array) {
  jubjub_groupHash(receiver.subarray(0, 11), Buffer.from('Zcash_gd'));
  const point = jubjub.Point.fromHex(receiver.subarray(11));
  if (point.equals(jubjub.Point.ZERO) || !point.isTorsionFree())
    invalidAddress();
}

export function isSupportedZcashUnifiedAddress(address: string): boolean {
  try {
    if (
      address.length > MAX_UNIFIED_CHARACTERS ||
      !address.startsWith('u1') ||
      address !== address.toLowerCase()
    )
      return false;
    const { prefix, words } = bech32m.decode(address, MAX_UNIFIED_CHARACTERS);
    if (prefix !== 'u') return false;
    const decoded = unjumble(Uint8Array.from(bech32m.fromWords(words)));
    const padding = Buffer.alloc(16);
    padding[0] = 0x75;
    if (!Buffer.from(decoded.subarray(-16)).equals(padding)) return false;
    const payload = decoded.subarray(0, -16);
    let offset = 0;
    const readCompactSize = () => {
      const { numberValue, bytes } = decodeCompactSize(payload, offset);
      if (
        numberValue === null ||
        numberValue > 0x2_00_00_00 ||
        encodingLength(numberValue) !== bytes
      )
        invalidAddress();
      offset += bytes;
      return numberValue;
    };
    let previousType = -1;
    let hasTransparent = false;
    let hasOrchard = false;
    while (offset < payload.length) {
      const type = readCompactSize();
      const length = readCompactSize();
      if (type <= previousType || offset + length > payload.length)
        return false;
      previousType = type;
      if (type < RECEIVER_LENGTHS.length && length !== RECEIVER_LENGTHS[type])
        return false;
      const receiver = payload.subarray(offset, offset + length);
      offset += length;
      if (type === 0 || type === 1) {
        if (hasTransparent) return false;
        hasTransparent = true;
      } else if (type === 2) {
        validateSaplingReceiver(receiver);
      } else if (type === 3) {
        validateOrchardReceiver(receiver);
        hasOrchard = true;
      } else if (type >= 0xe0 && type <= 0xfc) {
        // Revision-zero addresses cannot contain MUST-understand metadata.
        return false;
      }
    }
    // The shipped builder pays Unified recipients through Orchard only.
    return hasOrchard;
  } catch {
    return false;
  }
}
