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

export function integerToLittleEndianHex({
  number,
  bytes,
}: {
  number: number;
  bytes: number;
}) {
  let hexString: string = number.toString(16);
  if (hexString.length % 2 !== 0) {
    hexString = `0${hexString}`;
  }
  while (hexString.length / 2 < bytes) {
    hexString = `00${hexString}`;
  }
  const littleEndianHex: string = (hexString.match(/.{2}/g) ?? [])
    .reverse()
    .join('');
  return littleEndianHex;
}
