import emojiRegex from 'emoji-regex';

import { isPrintableASCIIString } from '@onekeyhq/shared/src/utils/stringUtils';

export type IHardwareLabelValidationError = 'invalid' | 'tooLong';

export function getHardwareLabelValidationError({
  value,
  maxLength,
  asciiOnly,
}: {
  value: string;
  maxLength: number;
  asciiOnly?: boolean;
}): IHardwareLabelValidationError | undefined {
  if (!value.length) {
    return undefined;
  }

  if (emojiRegex().test(value)) {
    return 'invalid';
  }

  // Printable-ASCII hardware labels support punctuation.
  if (asciiOnly && !isPrintableASCIIString(value)) {
    return 'invalid';
  }

  if (Buffer.from(value, 'utf-8').length > maxLength) {
    return 'tooLong';
  }

  return undefined;
}
