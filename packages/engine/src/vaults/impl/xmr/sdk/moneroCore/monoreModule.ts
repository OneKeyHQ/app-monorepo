/* eslint-disable no-bitwise */

import { MoneroNetTypeEnum } from './moneroCoreTypes';
import {
  MONERO_WORDS_ENGLISH,
  MONERO_WORDS_ENGLISH_PREFIX_LENGTH,
} from './moneroWrods';

import type { MoneroCoreInstance } from './moneroCoreTypes';

const fromHexString = (hexString: string) =>
  new Uint8Array(
    (hexString.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)),
  );
const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

const makeCRCTable = function () {
  let c;
  const crcTable = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
};

const crc32 = (str: string) => {
  const crcTable = makeCRCTable();
  let crc = 0 ^ -1;

  for (let i = 0; i < str.length; i += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xff];
  }

  return (crc ^ -1) >>> 0;
};

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

class MoneroModule {
  core: MoneroCoreInstance;

  constructor(core: MoneroCoreInstance) {
    this.core = core;
  }

  scReduce32(data: Uint8Array) {
    const dataLen = data.length * data.BYTES_PER_ELEMENT;
    const dataPtr = this.core._malloc(dataLen);
    const dataHeap = new Uint8Array(this.core.HEAPU8.buffer, dataPtr, dataLen);
    dataHeap.set(data);
    this.core.ccall('sc_reduce32', null, ['number'], [dataHeap.byteOffset]);
    const res = new Uint8Array(dataHeap);
    this.core._free(dataHeap.byteOffset);
    return res;
  }

  privateKeyToPublicKey(data: Uint8Array) {
    const outLen = data.length * data.BYTES_PER_ELEMENT;
    const outPtr = this.core._malloc(outLen);
    const outHeap = new Uint8Array(this.core.HEAPU8.buffer, outPtr, outLen);
    const ok = this.core.ccall(
      'secret_key_to_public_key',
      'boolean',
      ['array', 'number'],
      [data, outHeap.byteOffset],
    );
    let res = null;
    if (ok) res = new Uint8Array(outHeap);
    this.core._free(outHeap.byteOffset);
    return res;
  }

  cnFastHash(data: Uint8Array) {
    const outLen = 32;
    const outPtr = this.core._malloc(outLen);
    const outHeap = new Uint8Array(this.core.HEAPU8.buffer, outPtr, outLen);
    this.core.ccall(
      'cn_fast_hash',
      null,
      ['array', 'number', 'number'],
      [data, data.length * data.BYTES_PER_ELEMENT, outHeap.byteOffset],
    );
    const res = new Uint8Array(outHeap);
    this.core._free(outHeap.byteOffset);
    return res;
  }

  hashToScalar(data: Uint8Array) {
    return this.scReduce32(this.cnFastHash(data));
  }

  getSubaddressPrivateKey(data: Uint8Array, major: number, minor: number) {
    const outLen = 32;
    const outPtr = this.core._malloc(outLen);
    const outHeap = new Uint8Array(this.core.HEAPU8.buffer, outPtr, outLen);
    this.core.ccall(
      'get_subaddress_secret_key',
      null,
      ['array', 'number', 'number', 'number'],
      [data, major, minor, outHeap.byteOffset],
    );
    const res = new Uint8Array(outHeap);
    this.core._free(outHeap.byteOffset);
    return res;
  }

  scAdd(x: Uint8Array, y: Uint8Array) {
    const outLen = 32;
    const outPtr = this.core._malloc(outLen);
    const outHeap = new Uint8Array(this.core.HEAPU8.buffer, outPtr, outLen);
    this.core.ccall(
      'sc_add',
      null,
      ['number', 'array', 'array'],
      [outHeap.byteOffset, x, y],
    );
    const res = new Uint8Array(outHeap);
    this.core._free(outHeap.byteOffset);
    return res;
  }

  scalarmultKey(x: Uint8Array, y: Uint8Array) {
    const outLen = 32;
    const outPtr = this.core._malloc(outLen);
    const outHeap = new Uint8Array(this.core.HEAPU8.buffer, outPtr, outLen);
    const ok = this.core.ccall(
      'scalarmultKey',
      'boolean',
      ['number', 'array', 'array'],
      [outHeap.byteOffset, x, y],
    );
    let res = null;
    if (ok) res = new Uint8Array(outHeap);
    this.core._free(outHeap.byteOffset);
    return res;
  }

  pubKeysToAddress(
    net: MoneroNetTypeEnum,
    isSubaddress: boolean,
    publicSpendKey: Uint8Array,
    publicViewKey: Uint8Array,
  ) {
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

    const checksum = this.cnFastHash(fromHexString(resHex));
    resHex += toHexString(checksum).substring(0, 8);
    return base58Encode(fromHexString(resHex));
  }

  privateSpendKeyToWords(privateSpendKey: Uint8Array) {
    const seed = [];
    let forChecksum = '';
    for (let i = 0; i < 32; i += 4) {
      let w0 = 0;
      for (let j = 3; j >= 0; j -= 1) w0 = w0 * 256 + privateSpendKey[i + j];
      const w1 = w0 % MONERO_WORDS_ENGLISH.length;
      const w2 =
        (((w0 / MONERO_WORDS_ENGLISH.length) | 0) + w1) %
        MONERO_WORDS_ENGLISH.length;
      const w3 =
        (((((w0 / MONERO_WORDS_ENGLISH.length) | 0) /
          MONERO_WORDS_ENGLISH.length) |
          0) +
          w2) %
        MONERO_WORDS_ENGLISH.length;
      seed.push(MONERO_WORDS_ENGLISH[w1]);
      seed.push(MONERO_WORDS_ENGLISH[w2]);
      seed.push(MONERO_WORDS_ENGLISH[w3]);
      forChecksum += MONERO_WORDS_ENGLISH[w1].substring(
        0,
        MONERO_WORDS_ENGLISH_PREFIX_LENGTH,
      );
      forChecksum += MONERO_WORDS_ENGLISH[w2].substring(
        0,
        MONERO_WORDS_ENGLISH_PREFIX_LENGTH,
      );
      forChecksum += MONERO_WORDS_ENGLISH[w3].substring(
        0,
        MONERO_WORDS_ENGLISH_PREFIX_LENGTH,
      );
    }
    seed.push(seed[crc32(forChecksum) % 24]);
    return seed.join(' ');
  }
}

export { MoneroModule };
