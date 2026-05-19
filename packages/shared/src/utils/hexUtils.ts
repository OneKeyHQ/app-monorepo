// Import specific @ethersproject sub-packages instead of the full 'ethers'
// barrel to avoid pulling 126 modules into the common startup bundle.
import {
  hexlify as ethersHexlifyFn,
  isHexString as ethersIsHexString,
  hexStripZeros,
} from '@ethersproject/bytes';
import { toUtf8Bytes } from '@ethersproject/strings';

import type { BytesLike } from '@ethersproject/bytes';

const ethersHexlify = (...args: Parameters<typeof ethersHexlifyFn>) =>
  ethersHexlifyFn.apply(ethersHexlifyFn, args);

const stripHexZeros = (...args: Parameters<typeof hexStripZeros>) =>
  hexStripZeros.apply(hexStripZeros, args);

const hasHexPrefix = (str: string) =>
  str.startsWith('0x') || str.startsWith('0X');

const stripHexPrefix = (str: string) =>
  hasHexPrefix(str) ? str.slice(2) : str;

const addHexPrefix = (str: string): `0x${string}` =>
  hasHexPrefix(str) ? (str as `0x${string}`) : `0x${str}`;

const hexlify = (
  value: BytesLike | string | number | bigint,
  options?: {
    hexPad?: 'left' | 'right' | null;
    removeZeros?: boolean;
    noPrefix?: boolean;
  },
): string => {
  let result = ethersHexlify(value, { hexPad: options?.hexPad });
  if (options?.removeZeros) {
    result = stripHexZeros(result);
  }
  if (options?.noPrefix) {
    result = stripHexPrefix(result);
  }
  return result;
};

function isHexString(value: string, length?: number): boolean {
  return ethersIsHexString(addHexPrefix(value), length);
}

function hexStringToUtf8String(hexString: string): string {
  const hex = hexString.replace('0x', '');

  try {
    const bytes = new Uint8Array(
      hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
    );

    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch (_error) {
    return '';
  }
}

function stringToUtf8Bytes(str: string): Buffer {
  return Buffer.from(toUtf8Bytes(str));
}

function utf8StringToHexString(utf8String: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(utf8String);
  return ethersHexlifyFn(bytes);
}

export default {
  stripHexZeros,
  hexlify,
  addHexPrefix,
  stripHexPrefix,
  hasHexPrefix,
  isHexString,
  hexStringToUtf8String,
  utf8StringToHexString,
  stringToUtf8Bytes,
};
