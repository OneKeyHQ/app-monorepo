/* eslint-disable no-bitwise */
/* cspell:ignore akat nukta virama */
import safeStringify from 'fast-safe-stringify';
import { Base64 } from 'js-base64';
import { isString } from 'lodash';
import isEmail from 'validator/lib/isEmail';

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

export const PROTOCOL_V2_DEVICE_LABEL_MAX_LENGTH = 14;

export function isPrintableASCIIString(value: string): boolean {
  return Boolean(value) && isPrintableASCII(Buffer.from(value, 'utf8'));
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

/**
 * Validate email address
 * Also rejects internationalized domain names (IDN) like 中文.com
 * because our email provider doesn't support them
 */
function isValidEmail(email: string): boolean {
  if (!email || !isString(email)) {
    return false;
  }
  if (!isEmail(email)) {
    return false;
  }
  // Check if domain contains only ASCII characters
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) {
    return false;
  }
  const domain = email.slice(atIndex + 1);
  // Reject IDN domains (non-ASCII characters)
  for (let i = 0; i < domain.length; i += 1) {
    if (domain.charCodeAt(i) > 127) {
      return false;
    }
  }
  return true;
}

const validatorUtils = {
  isEmail,
};

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

function stripLineBreaks(value: string) {
  return value.replace(/[\r\n]+/g, '');
}

// Combining marks render with no advance of their own and belong to the
// preceding character, so they must never be split from it or start a line.
// Hand-rolled ranges because Hermes lacks reliable \p{…} support.
const COMBINING_MARK_RANGES: readonly (readonly [number, number])[] = [
  [0x03_00, 0x03_6f], // Combining diacritical marks
  [0x09_00, 0x09_03], // Devanagari signs
  [0x09_3a, 0x09_3c], // Devanagari vowel signs, nukta
  [0x09_3e, 0x09_4f], // Devanagari vowel signs, virama
  [0x09_51, 0x09_57], // Devanagari stress signs
  [0x09_62, 0x09_63], // Devanagari vowel signs
  [0x09_81, 0x09_83], // Bengali signs
  [0x09_bc, 0x09_bc], // Bengali nukta
  [0x09_be, 0x09_cd], // Bengali vowel signs, virama
  [0x09_d7, 0x09_d7], // Bengali au length mark
  [0x09_e2, 0x09_e3], // Bengali vowel signs
  [0x0e_31, 0x0e_31], // Thai mai han-akat
  [0x0e_33, 0x0e_3a], // Thai sara am, vowel signs
  [0x0e_47, 0x0e_4e], // Thai tone marks
  [0x1a_b0, 0x1a_ff], // Combining diacritical marks extended
  [0x1d_c0, 0x1d_ff], // Combining diacritical marks supplement
  [0x20_0d, 0x20_0d], // Zero-width joiner
  [0x20_d0, 0x20_ff], // Combining marks for symbols
  [0x30_99, 0x30_9a], // Kana voiced sound marks
  [0xfe_00, 0xfe_0f], // Variation selectors
  [0xfe_20, 0xfe_2f], // Combining half marks
  [0x1_f3_fb, 0x1_f3_ff], // Emoji skin tone modifiers
];

// A virama joins the next consonant into a conjunct; a zero-width joiner joins
// the next character into an emoji sequence.
const JOINING_CODE_POINTS = new Set([0x09_4d, 0x09_cd, 0x20_0d]);

export function isCombiningMark(codePoint: number): boolean {
  return COMBINING_MARK_RANGES.some(
    ([start, end]) => codePoint >= start && codePoint <= end,
  );
}

function splitGraphemesByCodePoint(text: string): string[] {
  const graphemes: string[] = [];
  let joinNext = false;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (graphemes.length > 0 && (joinNext || isCombiningMark(codePoint))) {
      graphemes[graphemes.length - 1] += char;
    } else {
      graphemes.push(char);
    }
    joinNext = JOINING_CODE_POINTS.has(codePoint);
  }
  return graphemes;
}

// Splits text into user-perceived characters (grapheme clusters). Uses
// Intl.Segmenter where available; the fallback (Hermes without an intl
// polyfill) keeps combining marks, virama conjuncts and ZWJ sequences with
// their base character instead of splitting per code point.
export function splitGraphemes(text: string): string[] {
  try {
    const { Segmenter } = Intl as unknown as {
      Segmenter?: new (
        locale: string | undefined,
        options: { granularity: 'grapheme' },
      ) => { segment: (value: string) => Iterable<{ segment: string }> };
    };
    if (typeof Segmenter === 'function') {
      const segmenter = new Segmenter(undefined, { granularity: 'grapheme' });
      return Array.from(segmenter.segment(text), (item) => item.segment);
    }
  } catch {
    // Fall through to the code point fallback.
  }
  return splitGraphemesByCodePoint(text);
}

export default {
  STRINGIFY_REPLACER,
  generateUUID,
  validator: validatorUtils,
  isValidEmail,
  stableStringify,
  randomString,
  randomStringCharsSet,
  addSeparatorToString,
  equalsIgnoreCase,
  capitalizeWords,
  isPrintableASCII,
  isPrintableASCIIString,
  isUTF8,
  decodeJWT,
  stripLineBreaks,
  isCombiningMark,
  splitGraphemes,
};
