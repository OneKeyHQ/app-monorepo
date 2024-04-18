/* eslint-disable no-param-reassign */
/* eslint-disable no-bitwise */

export function encodeVarInt(number: number) {
  const result = [];
  do {
    let byte = number & 0x7f;
    number >>>= 7;
    if (number !== 0) {
      byte |= 0x80;
    }
    result.push(byte);
  } while (number !== 0);
  return result.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function encodeVarIntLittleEndian(number: number) {
  const result = [];
  do {
    let byte = number & 0x7f;
    number >>>= 7;
    if (number !== 0) {
      byte |= 0x80;
    }
    result.push(byte);
  } while (number !== 0);
  return result
    .reverse()
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
