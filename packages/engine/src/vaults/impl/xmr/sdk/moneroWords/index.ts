/* eslint-disable no-bitwise */
import {
  MONERO_WORDS_ENGLISH,
  MONERO_WORDS_ENGLISH_PREFIX_LENGTH,
} from './moneroWrods';

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

export function privateSpendKeyToWords(privateSpendKey: Uint8Array) {
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
