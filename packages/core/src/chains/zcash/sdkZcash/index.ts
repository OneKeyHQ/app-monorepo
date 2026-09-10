import { bech32m } from 'bech32';
import bs58check from 'bs58check';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAddressValidation } from '@onekeyhq/shared/types/address';

import { validateBtcAddress } from '../../btc/sdkBtc';

import type { IBtcForkNetwork } from '../../btc/types';

// Zcash mainnet transparent address version prefixes (2 bytes each), unlike
// Bitcoin's single-byte version. This 2-byte prefix is the one part of Zcash
// transparent addresses the shared BTC pipeline cannot represent, so we bridge
// here at the encode/decode boundary (mirrors BCH's legacy<->cashaddr override).
const ZCASH_T1_PUBKEYHASH = Buffer.from([0x1c, 0xb8]); // t1... (P2PKH)
const ZCASH_T3_SCRIPTHASH = Buffer.from([0x1c, 0xbd]); // t3... (P2SH)

// Single-byte intermediate versions the shared BTC pipeline emits for the
// `zec` network entry (see sdkBtc/networks.ts). Kept in sync with that entry.
const BTC_INTERMEDIATE_P2PKH = 0x00;
const BTC_INTERMEDIATE_P2SH = 0x05;

export function isShieldedAddress(address: string): boolean {
  // Sapling (zs), Unified (u1), Sprout (zc) — not supported by the
  // transparent-only implementation.
  return /^(zs|u1|zc)/.test(address);
}

export function getZcashAccountIndexFromXpub(xpub: string): number | null {
  try {
    const payload = Buffer.from(bs58check.decode(xpub));
    const depth = payload[4];
    const childNumber = payload.readUInt32BE(9);
    if (depth !== 3 || (childNumber & 0x80_00_00_00) === 0) return null;
    return childNumber & 0x7f_ff_ff_ff;
  } catch {
    return null;
  }
}

// Zcash t-address -> the BTC-legacy intermediate the shared pipeline understands.
export function decodeAddress(address: string): string {
  if (isShieldedAddress(address)) {
    throw new OneKeyLocalError(
      'Zcash shielded addresses are not supported yet',
    );
  }
  const payload = Buffer.from(bs58check.decode(address));
  const prefix = payload.subarray(0, 2);
  const hash = payload.subarray(2);
  if (prefix.equals(ZCASH_T1_PUBKEYHASH)) {
    return bs58check.encode(
      Buffer.concat([Buffer.from([BTC_INTERMEDIATE_P2PKH]), hash]),
    );
  }
  if (prefix.equals(ZCASH_T3_SCRIPTHASH)) {
    return bs58check.encode(
      Buffer.concat([Buffer.from([BTC_INTERMEDIATE_P2SH]), hash]),
    );
  }
  throw new OneKeyLocalError(`Invalid Zcash transparent address: ${address}`);
}

const INVALID_ADDRESS: IAddressValidation = {
  isValid: false,
  normalizedAddress: '',
  displayAddress: '',
};

// Unified addresses (ZIP 316): bech32m, HRP "u" on mainnet. The payload is
// F4Jumbled, so receivers can't be inspected without reversing it -- checksum +
// HRP + the minimum jumbled length (48 bytes -> 77 five-bit words) is the
// full syntactic check; the wasm PCZT builder does the semantic one at send
// time. Sapling (zs) / Sprout (zc) destinations stay rejected: creating a
// Sapling output needs the removed Sapling prover.
const ZCASH_UA_HRP_MAIN = 'u';
const ZCASH_UA_MIN_WORDS = 77;
const ZCASH_UA_BECH32_LIMIT = 1024;

export function isValidUnifiedAddress(address: string): boolean {
  try {
    const decoded = bech32m.decode(address, ZCASH_UA_BECH32_LIMIT);
    return (
      decoded.prefix === ZCASH_UA_HRP_MAIN &&
      decoded.words.length >= ZCASH_UA_MIN_WORDS
    );
  } catch {
    return false;
  }
}

// Validates a Zcash transparent (t1/t3) address by decoding it to the
// BTC-legacy intermediate and reusing the BTC validator, or a unified (u1)
// address by bech32m syntax. Sapling/Sprout and malformed inputs are rejected.
export function validateZcashAddress({
  address,
  network,
}: {
  address: string;
  network: IBtcForkNetwork;
}): IAddressValidation {
  if (address.startsWith('u1')) {
    if (isValidUnifiedAddress(address)) {
      return {
        isValid: true,
        displayAddress: address,
        normalizedAddress: address,
      };
    }
    return INVALID_ADDRESS;
  }
  let intermediate: string;
  try {
    intermediate = decodeAddress(address); // throws for shielded / malformed
  } catch {
    return INVALID_ADDRESS;
  }
  const result = validateBtcAddress({ address: intermediate, network });
  if (!result.isValid) {
    return INVALID_ADDRESS;
  }
  return {
    isValid: true,
    encoding: result.encoding,
    displayAddress: address,
    normalizedAddress: address,
  };
}

// The BTC-legacy intermediate the shared pipeline emits -> Zcash t-address.
export function encodeAddress(address: string): string {
  if (address.startsWith('t1') || address.startsWith('t3')) {
    return address;
  }
  const payload = Buffer.from(bs58check.decode(address));
  const version = payload[0];
  const hash = payload.subarray(1);
  if (version === BTC_INTERMEDIATE_P2PKH) {
    return bs58check.encode(Buffer.concat([ZCASH_T1_PUBKEYHASH, hash]));
  }
  if (version === BTC_INTERMEDIATE_P2SH) {
    return bs58check.encode(Buffer.concat([ZCASH_T3_SCRIPTHASH, hash]));
  }
  throw new OneKeyLocalError(`Cannot encode Zcash address from: ${address}`);
}
