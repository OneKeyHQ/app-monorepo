/* eslint-disable no-restricted-syntax */

import {
  bytesToHex as bytesToHex0,
  hexToBytes,
  utf8ToBytes as utf8ToBytes0,
} from '@noble/hashes/utils';
import { isString } from 'lodash';

import hexUtils from './hexUtils';

function toBuffer(
  data: Buffer | ArrayBuffer | Uint8Array | string,
  // encoding of string data
  encoding: BufferEncoding = 'hex',
): Buffer {
  if (isString(data)) {
    if (encoding === 'hex') {
      // eslint-disable-next-line no-param-reassign
      data = hexUtils.stripHexPrefix(data);
    }
    // buffer from hex string in default
    const buff = Buffer.from(data, encoding);
    if (buff.length === 0 && data.length > 0) {
      throw new Error(`data not matched to encoding: ${encoding}`);
    }
    return buff;
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }
  if (data instanceof ArrayBuffer) {
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
  const buff = toBuffer(bytes);
  return bytesToHex0(buff);
}

function bytesToUtf8(
  bytes: Buffer | Uint8Array,
  options: {
    checkIsValidUtf8?: boolean; // if true, throw error if the buffer is not valid utf-8
  } = {},
): string {
  const buffer = toBuffer(bytes);
  if (options?.checkIsValidUtf8) {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  }
  return buffer.toString('utf8');
}

function utf8ToBytes(text: string): Buffer {
  return toBuffer(utf8ToBytes0(text));
}

function bytesToText(
  bytes: Buffer | Uint8Array,
  encoding: BufferEncoding = 'utf8',
): string {
  return toBuffer(bytes).toString(encoding || 'utf8');
}

const bufferUtils = {
  toBuffer,
  bytesToHex,
  bytesToText,
  hexToBytes,
  textToHex,
  hexToText,
  utf8ToBytes,
  bytesToUtf8,
};

export default bufferUtils;
