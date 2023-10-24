/* eslint-disable no-bitwise */
import { soliditySha3 } from 'web3-utils';

import { MoneroNetTypeEnum } from '../moneroUtil/moneroUtilTypes';

const fromHexString = (hexString: string) =>
  new Uint8Array(
    (hexString.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)),
  );
const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

const base58Encode = function (data: Uint8Array) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const ALPHABET_MAP: { [index: string]: any } = {};
  const BYTES_TO_LENGTHS = [0, 2, 3, 5, 6, 7, 9, 10, 11];
  const BASE = ALPHABET.length;

  // pre-compute lookup table
  for (let z = 0; z < ALPHABET.length; z += 1) {
    const x = ALPHABET.charAt(z);
    if (ALPHABET_MAP[x] !== undefined) throw new TypeError(`${x} is ambiguous`);
    ALPHABET_MAP[x] = z;
  }

  const encodePartial = (p: Uint8Array, pos: number) => {
    let len = 8;
    if (pos + len > p.length) len = p.length - pos;
    const digits = [0];
    for (let i = 0; i < len; i += 1) {
      let carry = p[pos + i];
      for (let j = 0; j < digits.length; j += 1) {
        carry += digits[j] << 8;
        digits[j] = carry % BASE;
        carry = (carry / BASE) | 0;
      }

      while (carry > 0) {
        digits.push(carry % BASE);
        carry = (carry / BASE) | 0;
      }
    }

    let res = '';
    for (let k = digits.length; k < BYTES_TO_LENGTHS[len]; k += 1)
      res += ALPHABET[0];
    for (let q = digits.length - 1; q >= 0; q -= 1) res += ALPHABET[digits[q]];
    return res;
  };

  let res = '';
  for (let i = 0; i < data.length; i += 8) {
    res += encodePartial(data, i);
  }
  return res;
};

export const cnFastHash = (data: Uint8Array) => {
  const str = Buffer.from(data).toString('hex');
  const hash = soliditySha3(`0x${str}`);
  return fromHexString(hash?.substr(2) ?? '');
};

export const pubKeysToAddress = (
  net: MoneroNetTypeEnum,
  isSubaddress: boolean,
  publicSpendKey: Uint8Array,
  publicViewKey: Uint8Array,
) => {
  let prefix = '';
  if (net === MoneroNetTypeEnum.MainNet) {
    prefix = '12';
    if (isSubaddress) prefix = '2A';
  } else if (net === MoneroNetTypeEnum.TestNet) {
    prefix = '35';
    if (isSubaddress) prefix = '3F';
  } else if (net === MoneroNetTypeEnum.StageNet) {
    prefix = '18';
    if (isSubaddress) prefix = '24';
  }

  let resHex =
    prefix + toHexString(publicSpendKey) + toHexString(publicViewKey);

  const checksum = cnFastHash(fromHexString(resHex));
  resHex += toHexString(checksum).substring(0, 8);
  return base58Encode(fromHexString(resHex));
};
