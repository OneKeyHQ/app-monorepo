// cspell:ignore stagenet
import { keccak_256 as keccak256 } from '@noble/hashes/sha3';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IXmrDerivedAccount } from './sdkXmrRuntime/address';

const XMR_BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
// Characters that encode a block of 0..8 bytes (Monero base58 works in 8-byte blocks).
const XMR_ENCODED_BLOCK_SIZES = [0, 2, 3, 5, 6, 7, 9, 10, 11];
const XMR_FULL_BLOCK_CHARS = 11;
// Primary-address tags on mainnet, testnet and stagenet.
const XMR_PRIMARY_ADDRESS_TAGS = new Set([18, 53, 24]);
// Tag, spend public key, view public key, checksum.
const XMR_PRIMARY_ADDRESS_BYTES = 1 + 32 + 32 + 4;
// Integrated-address tags on mainnet, testnet and stagenet.
const XMR_INTEGRATED_ADDRESS_TAGS = new Set([19, 54, 25]);
// Tag, spend public key, view public key, payment ID, checksum.
const XMR_INTEGRATED_ADDRESS_BYTES = 1 + 32 + 32 + 8 + 4;

function decodeXmrBase58(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let start = 0; start < text.length; start += XMR_FULL_BLOCK_CHARS) {
    const block = text.slice(start, start + XMR_FULL_BLOCK_CHARS);
    const size = XMR_ENCODED_BLOCK_SIZES.indexOf(block.length);
    if (size < 0) {
      throw new OneKeyLocalError('xmr: invalid address encoding');
    }
    let value = 0n;
    for (let i = 0; i < block.length; i += 1) {
      const digit = XMR_BASE58_ALPHABET.indexOf(block[i]);
      if (digit < 0) {
        throw new OneKeyLocalError('xmr: invalid address encoding');
      }
      value = value * 58n + BigInt(digit);
    }
    const decoded = new Array<number>(size);
    for (let i = size - 1; i >= 0; i -= 1) {
      decoded[i] = Number(value % 256n);
      value /= 256n;
    }
    if (value !== 0n) {
      throw new OneKeyLocalError('xmr: invalid address encoding');
    }
    bytes.push(...decoded);
  }
  return Uint8Array.from(bytes);
}

// The last 4 bytes are the Keccak-256 prefix of the rest.
function hasValidXmrChecksum(raw: Uint8Array): boolean {
  const body = raw.length - 4;
  const checksum = keccak256(raw.subarray(0, body)).subarray(0, 4);
  return checksum.every((byte, i) => byte === raw[body + i]);
}

// Spend public key of a primary address, after checking the address checksum.
export function getXmrSpendPublicKeyFromAddress(address: string): string {
  const raw = decodeXmrBase58(address);
  if (
    raw.length !== XMR_PRIMARY_ADDRESS_BYTES ||
    !XMR_PRIMARY_ADDRESS_TAGS.has(raw[0])
  ) {
    throw new OneKeyLocalError('xmr: not a primary address');
  }
  if (!hasValidXmrChecksum(raw)) {
    throw new OneKeyLocalError('xmr: invalid address checksum');
  }
  return Buffer.from(raw.subarray(1, 33)).toString('hex');
}

// Hex payment ID of an integrated address; undefined for any other address, or an all-zero ID.
export function getXmrIntegratedAddressPaymentId(
  address: string,
): string | undefined {
  let raw: Uint8Array;
  try {
    raw = decodeXmrBase58(address);
  } catch {
    return undefined;
  }
  if (
    raw.length !== XMR_INTEGRATED_ADDRESS_BYTES ||
    !XMR_INTEGRATED_ADDRESS_TAGS.has(raw[0]) ||
    !hasValidXmrChecksum(raw)
  ) {
    return undefined;
  }
  const paymentId = raw.subarray(65, 73);
  return paymentId.some((byte) => byte !== 0)
    ? Buffer.from(paymentId).toString('hex')
    : undefined;
}

export type IXmrViewingKeyPair = Pick<
  IXmrDerivedAccount,
  'spendPublicKeyHex' | 'viewPrivateKeyHex'
>;

export function parseXmrViewingKeyPair(stored: string): IXmrViewingKeyPair {
  const match = /^([\da-f]{64}):([\da-f]{64})$/i.exec(stored);
  if (!match) {
    throw new OneKeyLocalError('xmr: invalid stored viewing material');
  }
  return {
    spendPublicKeyHex: match[1].toLowerCase(),
    viewPrivateKeyHex: match[2].toLowerCase(),
  };
}

export function serializeXmrViewingKeyPair(pair: IXmrViewingKeyPair): string {
  const parsed = parseXmrViewingKeyPair(
    `${pair.spendPublicKeyHex}:${pair.viewPrivateKeyHex}`,
  );
  return `${parsed.spendPublicKeyHex}:${parsed.viewPrivateKeyHex}`;
}
