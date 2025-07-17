const hasHexPrefix = (str: string) =>
  str.startsWith('0x') || str.startsWith('0X');

const stripHexPrefix = (str: string) =>
  hasHexPrefix(str) ? str.slice(2) : str;

const addHexPrefix = (str: string): `0x${string}` =>
  hasHexPrefix(str) ? (str as `0x${string}`) : `0x${str}`;

function hexStringToUtf8String(hexString: string): string {
  const hex = hexString.replace('0x', '');

  try {
    const bytes = new Uint8Array(
      hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
    );

    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch (error) {
    return '';
  }
}

export default {
  addHexPrefix,
  stripHexPrefix,
  hasHexPrefix,
  hexStringToUtf8String,
};
