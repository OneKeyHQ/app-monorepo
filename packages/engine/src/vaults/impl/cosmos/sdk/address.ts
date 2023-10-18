import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { bech32 } from 'bech32';

import type { ChainInfo } from '../../../utils/btcForkChain/types';

const secp256k1PubkeyToRawAddress = (pubkey: Uint8Array): Uint8Array => {
  if (pubkey.length !== 33) {
    throw new Error(
      `Invalid Secp256k1 pubkey length (compressed): ${pubkey.length}`,
    );
  }

  return ripemd160(sha256(pubkey));
};

const ed25519PubkeyToRawAddress = (pubkey: Uint8Array): Uint8Array => {
  if (pubkey.length !== 32) {
    throw new Error(`Invalid Ed25519 pubkey length: ${pubkey.length}`);
  }

  return sha256(pubkey).slice(0, 20);
};

export const pubkeyToBaseAddress = (
  curve: ChainInfo['curve'],
  pubkey: Uint8Array,
): string => {
  const digest =
    curve === 'secp256k1'
      ? secp256k1PubkeyToRawAddress(pubkey)
      : ed25519PubkeyToRawAddress(pubkey);
  return bytesToHex(digest);
};

export const pubkeyToAddress = (
  curve: ChainInfo['curve'],
  prefix: string,
  pubkey: Uint8Array,
): string => {
  const digest = pubkeyToBaseAddress(curve, pubkey);
  return bech32.encode(prefix, bech32.toWords(hexToBytes(digest)));
};

export const baseAddressToAddress = (
  prefix: string,
  baseAddress: string,
): string => bech32.encode(prefix, bech32.toWords(hexToBytes(baseAddress)));

export const isValidAddress = (
  input: string,
  requiredPrefix: string,
): boolean => {
  try {
    const { prefix, words } = bech32.decode(input);
    if (prefix !== requiredPrefix) {
      return false;
    }
    const data = bech32.fromWords(words);
    return data.length === 20;
  } catch {
    return false;
  }
};

export const isValidContractAddress = (
  input: string,
  requiredPrefix: string,
): boolean => {
  try {
    const { prefix, words } = bech32.decode(input);
    if (prefix !== requiredPrefix) {
      return false;
    }
    const data = bech32.fromWords(words);

    // example: juno 32 length
    // example: terra 20 length
    return data.length === 32 || data.length === 20;
  } catch {
    return false;
  }
};
