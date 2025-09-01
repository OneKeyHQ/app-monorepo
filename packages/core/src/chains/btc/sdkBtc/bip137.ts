/* eslint-disable no-bitwise */
import { bech32 } from 'bech32';
import * as bs58check from 'bs58check';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const SIG_LEN = 65;
const HEADER_BASE = 27;

export function isBech32Address(addr: string): boolean {
  try {
    bech32.decode(addr);
    return true;
  } catch {
    return false;
  }
}

export function isP2SHAddress(addr: string): boolean {
  try {
    const version = bs58check.decode(addr)[0];
    return version === 5 || version === 196;
  } catch {
    return false;
  }
}

/**
 * Converts Electrum flag byte (0-15, without segwit flags)
 * to BIP137 flag byte (with segwit flags)
 *
 * - bech32(P2WPKH): flag |= 12 (8=segwit, 4=bech32)
 * - P2SH-P2WPKH: flag |= 8 (segwit in P2SH)
 * - Others (P2PKH): unchanged
 */
export function electrumToBip137Header(
  flagByte: number,
  address: string,
): number {
  if (!Number.isInteger(flagByte) || flagByte < 0 || flagByte > 15) {
    throw new RangeError('flagByte must be an integer in [0, 15].');
  }
  const recId = flagByte & 0b11;

  if (isBech32Address(address)) {
    return recId | 0b1100;
  }
  if (isP2SHAddress(address)) {
    return recId | 0b1000;
  }
  return flagByte;
}

/**
 * Normalizes Electrum signature (without segwit flags) to BIP137 format.
 * Returns unchanged if already BIP137 format.
 *
 * @param sigB64 Base64 encoded 65-byte signature (header + r||s)
 * @param address Used to infer segwit type (bech32 or P2SH)
 * @returns BIP137 normalized base64 signature
 */
export function normalizeElectrumToBip137(
  sigB64: string,
  address: string,
): string {
  const buf = Buffer.from(sigB64, 'base64');
  if (buf.length !== SIG_LEN) {
    throw new OneKeyLocalError('Invalid signature length');
  }

  const flag = buf[0] - HEADER_BASE;
  if (flag < 0 || flag > 15) {
    throw new OneKeyLocalError('Invalid signature header');
  }

  // Already BIP137 format
  if ((flag & 0b1000) !== 0) {
    return sigB64;
  }

  const newFlag = electrumToBip137Header(flag, address);
  const out = Buffer.from(buf);
  out[0] = HEADER_BASE + newFlag;
  return out.toString('base64');
}
