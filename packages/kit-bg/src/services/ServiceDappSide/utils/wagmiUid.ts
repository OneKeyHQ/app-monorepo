const size = 256;
let index = size;
let buffer: string;

export function uid(length = 11) {
  if (!buffer || index + length > size * 2) {
    buffer = '';
    index = 0;
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < size; i++) {
      // eslint-disable-next-line no-bitwise
      buffer += ((256 + Math.random() * 256) | 0).toString(16).substring(1);
    }
  }
  // eslint-disable-next-line no-plusplus
  return buffer.substring(index, index++ + length);
}
