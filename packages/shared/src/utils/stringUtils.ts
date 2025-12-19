/* eslint-disable no-bitwise */
import safeStringify from 'fast-safe-stringify';
import { Base64 } from 'js-base64';
import { isString } from 'lodash';
import validator from 'validator';

import { OneKeyLocalError } from '../errors';

import { generateUUID } from './miscUtils';

export function equalsIgnoreCase(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  return a?.toUpperCase() === b?.toUpperCase();
}

const STRINGIFY_REPLACER = {
  bufferToHex: (key: string, value: any) => {
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      return value.toString('hex');
    }
    // Handle serialized Buffer objects with {data: number[], type: "Buffer"}
    if (
      value &&
      typeof value === 'object' &&
      'type' in value &&
      'data' in value
    ) {
      const valueLikeBuffer = value as {
        type: 'Buffer';
        data: number[];
      };
      if (
        valueLikeBuffer &&
        valueLikeBuffer.type === 'Buffer' &&
        valueLikeBuffer.data &&
        Array.isArray(valueLikeBuffer.data) &&
        valueLikeBuffer.data.every((item) => typeof item === 'number')
      ) {
        return Buffer.from(valueLikeBuffer.data).toString('hex');
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value;
  },
};

export function stableStringify(
  value: any,
  replacer?: ((key: string, value: any) => any) | null,
  space?: string | number,
  options?: { depthLimit: number | undefined; edgesLimit: number | undefined },
): string {
  return safeStringify.stableStringify(
    value,
    replacer ?? undefined,
    space,
    options,
  );
}

// capitalizeWords("hello world") => "Hello World"
export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (match) => match.toUpperCase());
}

export function isPrintableASCII(buffer: Buffer): boolean {
  return (
    buffer && buffer.every((element) => element >= 0x20 && element <= 0x7e)
  );
}

export function isUTF8(buf: Buffer): boolean {
  if (!buf) return false;

  const len = buf.length;
  let i = 0;

  while (i < len) {
    if ((buf[i] & 0x80) === 0x00) {
      // 0xxxxxxx
      // eslint-disable-next-line no-plusplus
      i++;
    } else if ((buf[i] & 0xe0) === 0xc0) {
      // 110xxxxx 10xxxxxx
      if (
        i + 1 === len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i] & 0xfe) === 0xc0 // overlong
      ) {
        return false;
      }

      i += 2;
    } else if ((buf[i] & 0xf0) === 0xe0) {
      // 1110xxxx 10xxxxxx 10xxxxxx
      if (
        i + 2 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i] === 0xe0 && (buf[i + 1] & 0xe0) === 0x80) || // overlong
        (buf[i] === 0xed && (buf[i + 1] & 0xe0) === 0xa0) // surrogate (U+D800 - U+DFFF)
      ) {
        return false;
      }

      i += 3;
    } else if ((buf[i] & 0xf8) === 0xf0) {
      // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
      if (
        i + 3 >= len ||
        (buf[i + 1] & 0xc0) !== 0x80 ||
        (buf[i + 2] & 0xc0) !== 0x80 ||
        (buf[i + 3] & 0xc0) !== 0x80 ||
        (buf[i] === 0xf0 && (buf[i + 1] & 0xf0) === 0x80) || // overlong
        (buf[i] === 0xf4 && buf[i + 1] > 0x8f) ||
        buf[i] > 0xf4 // > U+10FFFF
      ) {
        return false;
      }

      i += 4;
    } else {
      return false;
    }
  }

  return true;
}

function isValidEmail(email: string): boolean {
  if (!email || !isString(email)) {
    return false;
  }
  return validator.isEmail(email);
}

function addSeparatorToString({
  str,
  groupSize,
  separator = '-',
}: {
  str: string;
  groupSize: number;
  separator?: string;
}): string {
  // Input validation
  if (!str) {
    return str;
  }
  if (groupSize <= 0) {
    throw new OneKeyLocalError('Group size must be a positive number');
  }

  const segments = [];
  for (let i = 0; i < str.length; i += groupSize) {
    segments.push(str.slice(i, i + groupSize));
  }
  return segments.join(separator);
}

const randomStringCharsSet = {
  base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
  base58UpperCase: '123456789ABCDEFGHJKLMNPQRSTUVWXYZ',
  base58LowerCase: '123456789abcdefghijkmnopqrstuvwxyz',
  numberAndLetter:
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numberOnly: '0123456789',
  letterOnly: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  letterUpperCase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  letterLowerCase: 'abcdefghijklmnopqrstuvwxyz',
};

function randomString(
  length: number,
  options: {
    chars?: string;
    groupSeparator?: string;
    groupSize?: number;
  } = {},
): string {
  const {
    chars = randomStringCharsSet.numberAndLetter,
    groupSeparator = '-',
    groupSize,
  } = options;

  // Input validation
  if (length <= 0) {
    throw new OneKeyLocalError('Length must be a positive number');
  }
  if (!chars || chars.length === 0) {
    throw new OneKeyLocalError('Character set cannot be empty');
  }

  let result = '';
  const charsLength = chars.length;

  // Calculate the maximum value that ensures uniform distribution
  const maxValidValue = Math.floor(256 / charsLength) * charsLength - 1;

  // Performance optimization: batch random byte generation
  const batchSize = Math.min(length, 256);
  let remainingLength = length;

  while (remainingLength > 0) {
    const currentBatchSize = Math.min(remainingLength, batchSize);
    const randomBytes = crypto.getRandomValues(
      new Uint8Array(currentBatchSize * 2),
    ); // Generate extra bytes for rejection sampling
    let usedBytes = 0;
    let processedCount = 0;

    while (
      processedCount < currentBatchSize &&
      usedBytes < randomBytes.length
    ) {
      const randomByte = randomBytes[usedBytes];
      usedBytes += 1;

      // Apply rejection sampling
      if (randomByte <= maxValidValue) {
        const randomIndex = randomByte % charsLength;
        result += chars[randomIndex];
        processedCount += 1;
      }
    }

    // Fallback for edge cases where rejection rate is very high
    while (processedCount < currentBatchSize) {
      const singleByte = crypto.getRandomValues(new Uint8Array(1))[0];
      if (singleByte <= maxValidValue) {
        const randomIndex = singleByte % charsLength;
        result += chars[randomIndex];
        processedCount += 1;
      }
    }

    remainingLength -= currentBatchSize;
  }

  // Add separators if specified
  if (groupSize && groupSize > 0) {
    result = addSeparatorToString({
      str: result,
      groupSize,
      separator: groupSeparator,
    });
  }

  return result;
}

/**
 * Decode JWT token payload
 * JWT format: header.payload.signature
 * Payload is base64url encoded JSON
 */
function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Get payload part (second part)
    const payload = parts[1];

    // Convert base64url to base64
    // Replace '-' with '+', '_' with '/', and add padding if needed
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    if (padding) {
      base64 += '='.repeat(4 - padding);
    }

    // Decode base64 to string
    const decoded = Base64.decode(base64);

    // Parse JSON
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

export default {
  STRINGIFY_REPLACER,
  generateUUID,
  validator,
  isValidEmail,
  stableStringify,
  randomString,
  randomStringCharsSet,
  addSeparatorToString,
  equalsIgnoreCase,
  capitalizeWords,
  isPrintableASCII,
  isUTF8,
  decodeJWT,
};
