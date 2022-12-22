import { Buffer } from 'buffer';

import { isString } from 'lodash';

function toBuffer(
  data: Buffer | Uint8Array | string,
  // encoding of string data
  encoding:
    | 'hex'
    | 'utf8'
    | 'base64'
    | 'ascii'
    | 'utf-8'
    | 'utf16le'
    | 'ucs2'
    | 'ucs-2'
    | 'base64url'
    | 'latin1'
    | 'binary' = 'hex',
): Buffer {
  if (isString(data)) {
    // buffer from hex string in default
    return Buffer.from(data, encoding);
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }
  return data;
}

export default {
  toBuffer,
};
