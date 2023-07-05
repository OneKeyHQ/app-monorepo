import { Buffer } from 'buffer';

import {
  bytesToHex as bytesToHex0,
  hexToBytes,
  utf8ToBytes,
} from '@noble/hashes/utils';
import { isString } from 'lodash';

function toBuffer(
  data: Buffer | Uint8Array | string,
  // encoding of string data
  encoding: BufferEncoding = 'hex',
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

function textToHex(text: string, encoding: BufferEncoding = 'utf8'): string {
  return toBuffer(text, encoding || 'utf8').toString('hex');
}

function hexToText(hex: string, encoding: BufferEncoding = 'utf8'): string {
  return toBuffer(hex, 'hex').toString(encoding || 'utf8');
}

function bytesToHex(bytes: Buffer | Uint8Array | string): string {
  // input maybe hex string
  if (isString(bytes)) {
    return bytes;
  }
  return bytesToHex0(toBuffer(bytes));
}

export default {
  toBuffer,
  bytesToHex,
  hexToBytes,
  textToHex,
  hexToText,
  utf8ToBytes,
};
