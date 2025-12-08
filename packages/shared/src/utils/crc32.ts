/* eslint-disable no-bitwise */

const makeCRCTable = function () {
  let c;
  const crcTable = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
};

export const crc32 = (str: string) => {
  const crcTable = makeCRCTable();
  let crc = 0 ^ -1;

  for (let i = 0; i < str.length; i += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xff];
  }

  return (crc ^ -1) >>> 0;
};
