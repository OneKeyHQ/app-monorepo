import type { EAddressEncodings } from '@onekeyhq/core/src/types';

export type IAddressValidation = {
  isValid: boolean;
  normalizedAddress?: string;
  displayAddress?: string;
  encoding?: EAddressEncodings;
};
