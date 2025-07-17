/* eslint-disable no-restricted-syntax */
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
    throw new Error('Group size must be a positive number');
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
    throw new Error('Length must be a positive number');
  }
  if (!chars || chars.length === 0) {
    throw new Error('Character set cannot be empty');
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

export default {
  randomString,
  addSeparatorToString,
  randomStringCharsSet,
};
