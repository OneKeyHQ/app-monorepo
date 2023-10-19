import { utils } from 'ethers';

import type { BytesLike } from 'ethers';

const ethersHexlify = (...args: Parameters<typeof utils.hexlify>) =>
  utils.hexlify.apply(utils.hexlify, args);

export const stripHexZeros = (
  ...args: Parameters<typeof utils.hexStripZeros>
) => utils.hexStripZeros.apply(utils.hexStripZeros, args);

export const isHexString = (...args: Parameters<typeof utils.isHexString>) =>
  utils.isHexString.apply(utils.isHexString, args);

export const hasHexPrefix = (str: string) =>
  str.startsWith('0x') || str.startsWith('0X');

export const stripHexPrefix = (str: string) =>
  hasHexPrefix(str) ? str.slice(2) : str;

export const addHexPrefix = (str: string) =>
  hasHexPrefix(str) ? str : `0x${str}`;

export const hexlify = (
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
