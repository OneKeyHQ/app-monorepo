import uuid from 'react-native-uuid';

export function generateUUID() {
  return uuid.v4() as string;
}

export const uidForWagmi = (function () {
  const size = 256;
  let index = size;
  let buffer: string;
  return function (length = 11): string {
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
  };
})();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function noopObject(..._: any[]) {
  return null;
}
