import emojiRegex from 'emoji-regex';

import { isAsciiAlphanumericWithSpaces } from '@onekeyhq/shared/src/utils/stringUtils';

export type IHardwareLabelValidationError = 'invalid' | 'tooLong';

export function getHardwareLabelValidationError({
  value,
  maxLength,
  asciiOnly,
  asciiAlphanumericWithSpacesOnly,
}: {
  value: string;
  maxLength: number;
  asciiOnly?: boolean;
  asciiAlphanumericWithSpacesOnly?: boolean;
}): IHardwareLabelValidationError | undefined {
  if (!value.length) {
    return undefined;
  }

  if (emojiRegex().test(value)) {
    return 'invalid';
  }

  if (
    asciiAlphanumericWithSpacesOnly &&
    !isAsciiAlphanumericWithSpaces(value)
  ) {
    return 'invalid';
  }

  // Trezor labels support printable ASCII, including punctuation.
  if (asciiOnly && /[^\x20-\x7E]/.test(value)) {
    return 'invalid';
  }

  if (Buffer.from(value, 'utf-8').length > maxLength) {
    return 'tooLong';
  }

  return undefined;
}
