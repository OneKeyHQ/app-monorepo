import { jubjub, jubjub_groupHash, pallas } from '@noble/curves/misc';
import { blake2b } from '@noble/hashes/blake2b';
import { bech32m } from 'bech32';
import bs58check from 'bs58check';
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
    // oxlint-disable-next-line unicorn/no-array-reverse -- Hermes lacks TypedArray.toReversed.
    Uint8Array.from([2 + parity, ...Buffer.from(x).reverse()]),
  );
  point.assertValidity();
}

function validateSaplingReceiver(receiver: Uint8Array) {
  jubjub_groupHash(receiver.subarray(0, 11), Buffer.from('Zcash_gd'));
  const point = jubjub.Point.fromHex(receiver.subarray(11));
  if (point.equals(jubjub.Point.ZERO) || !point.isTorsionFree())
    invalidAddress();
}

// Each receiver by its type, in address order; undefined unless the address is payable here.
function decodeSupportedZcashUnifiedAddress(
  address: string,
): Map<number, Uint8Array> | undefined {
  try {
    if (
      address.length > MAX_UNIFIED_CHARACTERS ||
      !address.startsWith('u1') ||
      address !== address.toLowerCase()
    )
      return undefined;
    const { prefix, words } = bech32m.decode(address, MAX_UNIFIED_CHARACTERS);
    if (prefix !== 'u') return undefined;
    const decoded = unjumble(Uint8Array.from(bech32m.fromWords(words)));
    const padding = Buffer.alloc(16);
    padding[0] = 0x75;
    if (!Buffer.from(decoded.subarray(-16)).equals(padding)) return undefined;
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
    const receivers = new Map<number, Uint8Array>();
    while (offset < payload.length) {
      const type = readCompactSize();
      const length = readCompactSize();
      if (type <= previousType || offset + length > payload.length)
        return undefined;
      previousType = type;
      if (type < RECEIVER_LENGTHS.length && length !== RECEIVER_LENGTHS[type])
        return undefined;
      const receiver = payload.subarray(offset, offset + length);
      offset += length;
      if (type === 0 || type === 1) {
        if (hasTransparent) return undefined;
        hasTransparent = true;
      } else if (type === 2) {
        validateSaplingReceiver(receiver);
      } else if (type === 3) {
        validateOrchardReceiver(receiver);
        hasOrchard = true;
      } else if (type >= 0xe0 && type <= 0xfc) {
        // Revision-zero addresses cannot contain MUST-understand metadata.
        return undefined;
      }
      receivers.set(type, receiver);
    }
    // Only a Unified address with an Orchard receiver is payable.
    return hasOrchard ? receivers : undefined;
  } catch {
    return undefined;
  }
}

export function getSupportedZcashUnifiedAddressReceiverTypes(
  address: string,
): number[] | undefined {
  const receivers = decodeSupportedZcashUnifiedAddress(address);
  return receivers ? [...receivers.keys()] : undefined;
}

// A shielded payment goes to one Orchard receiver; the wallet reads back only that receiver, so two
// addresses holding it are one recipient.
export function isSameZcashOrchardRecipient(a: string, b: string): boolean {
  if (a === b) return true;
  const orchardA = decodeSupportedZcashUnifiedAddress(a)?.get(3);
  const orchardB = decodeSupportedZcashUnifiedAddress(b)?.get(3);
  // The apps' Buffer polyfill compares only Buffers, unlike Node's.
  return (
    !!orchardA &&
    !!orchardB &&
    Buffer.from(orchardA).equals(Buffer.from(orchardB))
  );
}

// Transparent receiver type codes and the t-address prefix each encodes to (t1 P2PKH, t3 P2SH).
const TRANSPARENT_RECEIVER_PREFIXES: [number, number[]][] = [
  [0, [0x1c, 0xb8]],
  [1, [0x1c, 0xbd]],
];

// The t-address a Unified address carries, if it has a transparent receiver.
export function getZcashUnifiedAddressTransparentReceiver(
  address: string,
): string | undefined {
  const receivers = decodeSupportedZcashUnifiedAddress(address);
  if (!receivers) return undefined;
  for (const [type, prefix] of TRANSPARENT_RECEIVER_PREFIXES) {
    const hash = receivers.get(type);
    if (hash) {
      return bs58check.encode(
        Buffer.concat([Buffer.from(prefix), Buffer.from(hash)]),
      );
    }
  }
  return undefined;
}

export function isSupportedZcashUnifiedAddress(address: string): boolean {
  return getSupportedZcashUnifiedAddressReceiverTypes(address) !== undefined;
}
