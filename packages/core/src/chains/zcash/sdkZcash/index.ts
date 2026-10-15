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

// ZIP-320 TEX address: a P2PKH hash that accepts only transparent inputs.
// Returns the hash, or null when the address is not a mainnet TEX.
function decodeZcashTexHash(address: string): Buffer | null {
  if (!address.startsWith('tex1')) return null;
  try {
    const { prefix, words } = bech32m.decode(address, 1000);
    const hash = Buffer.from(bech32m.fromWords(words));
    return prefix === 'tex' && hash.length === 20 ? hash : null;
  } catch {
    return null;
  }
}

export function isZcashTexAddress(address: string): boolean {
  return decodeZcashTexHash(address) !== null;
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

// Transparent validation does not load WASM. Unified receivers are validated
// by the stateless keys SDK before entering the send flow.
export function validateZcashTransparentAddress({
  address,
  network,
}: {
  address: string;
  network: IBtcForkNetwork;
}): IAddressValidation {
  if (isZcashTexAddress(address)) {
    return {
      isValid: true,
      displayAddress: address,
      normalizedAddress: address,
    };
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

// The output script a transparent address is paid with, as hex; null for an
// address with no transparent output (shielded, unified). TEX addresses carry
// a P2PKH hash and are paid like t1.
export function zcashTransparentScriptForAddress(
  address: string,
): string | null {
  try {
    if (address.startsWith('tex1')) {
      const hash = decodeZcashTexHash(address);
      return hash ? `76a914${hash.toString('hex')}88ac` : null;
    }
    const payload = Buffer.from(bs58check.decode(address));
    const prefix = payload.subarray(0, 2);
    const hash = payload.subarray(2).toString('hex');
    if (payload.length !== 22) return null;
    if (prefix.equals(ZCASH_T1_PUBKEYHASH)) return `76a914${hash}88ac`;
    if (prefix.equals(ZCASH_T3_SCRIPTHASH)) return `a914${hash}87`;
    return null;
  } catch {
    return null;
  }
}
