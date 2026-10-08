import emojiRegex from 'emoji-regex';

import { isPrintableASCIIString } from '@onekeyhq/shared/src/utils/stringUtils';

export type IHardwareLabelValidationError = 'invalid' | 'tooLong';

export function normalizeHardwareLabelValue(
  value: string,
  trimOuterWhitespace?: boolean,
) {
  return trimOuterWhitespace ? value.trim() : value;
}

export function getHardwareLabelValidationError({
  value,
  maxLength,
  asciiOnly,
  trimOuterWhitespace,
}: {
  value: string;
  maxLength: number;
  asciiOnly?: boolean;
  trimOuterWhitespace?: boolean;
}): IHardwareLabelValidationError | undefined {
  const normalizedValue = normalizeHardwareLabelValue(
    value,
    trimOuterWhitespace,
  );

  if (!normalizedValue.length) {
    return undefined;
  }

  if (emojiRegex().test(normalizedValue)) {
    return 'invalid';
  }

  // Printable-ASCII hardware labels support punctuation.
  if (asciiOnly && !isPrintableASCIIString(normalizedValue)) {
    return 'invalid';
  }

  if (Buffer.from(normalizedValue, 'utf-8').length > maxLength) {
    return 'tooLong';
  }

  return undefined;
}
