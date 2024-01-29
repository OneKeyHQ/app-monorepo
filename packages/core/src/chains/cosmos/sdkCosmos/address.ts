import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import bech32 from 'bech32';

import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { IAddressValidation } from '@onekeyhq/shared/types/address';
import type { ICurveName } from '../../../types';

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
  curve: ICurveName,
  pubkey: Uint8Array,
): string => {
  const digest =
    curve === 'secp256k1'
      ? secp256k1PubkeyToRawAddress(pubkey)
      : ed25519PubkeyToRawAddress(pubkey);
  return bytesToHex(digest);
};

export const pubkeyToAddress = (
  curve: ICurveName,
  prefix: string,
  pubkey: Uint8Array,
): string => {
  const digest = pubkeyToBaseAddress(curve, pubkey);
  return bech32.encode(prefix, bech32.toWords(hexToBytes(digest)));
};

export function pubkeyToAddressDetail({
  curve,
  publicKey,
  addressPrefix,
}: {
  curve: ICurveName;
  publicKey: string;
  addressPrefix: string | undefined;
}) {
  const pubKeyBuffer = bufferUtils.hexToBytes(publicKey);
  const baseAddress = pubkeyToBaseAddress(curve, pubKeyBuffer);
  const address = baseAddressToAddress(
    checkIsDefined(addressPrefix || ''),
    baseAddress,
  );
  return {
    baseAddress,
    address,
  };
}

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

export async function validateCosmosAddress({
  address,
  addressPrefix,
}: {
  address: string;
  addressPrefix: string;
}): Promise<IAddressValidation> {
  const isValid = isValidAddress(address, addressPrefix);
  if (isValid) {
    return Promise.resolve({
      isValid: true,
      normalizedAddress: address,
      displayAddress: address,
    });
  }
  return {
    isValid: false,
    normalizedAddress: '',
    displayAddress: '',
  };
}

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
