import { baseDecode } from 'borsh';

import type { AddressValidation } from '@onekeyhq/engine/src/types/provider';

import { IMPLICIT_ACCOUNT_PATTERN, REGISTER_ACCOUNT_PATTERN } from './constant';

export const verifyAddress = (address: string): AddressValidation => {
  let encoding: string | undefined;
  if (IMPLICIT_ACCOUNT_PATTERN.test(address)) {
    encoding = 'IMPLICIT_ACCOUNT';
  } else if (REGISTER_ACCOUNT_PATTERN.test(address)) {
    return {
      isValid: true,
      normalizedAddress: address,
      displayAddress: address,
      encoding: 'REGISTER_ACCOUNT',
    };
  } else if (address.includes(':')) {
    const [prefix, encoded] = address.split(':');
    try {
      if (
        prefix === 'ed25519' &&
        Buffer.from(baseDecode(encoded)).length === 32
      ) {
        encoding = 'ENCODED_PUBKEY';
      }
    } catch (e) {
      // ignored
    }
  }

  if (encoding) {
    return {
      isValid: true,
      normalizedAddress: address,
      displayAddress: address,
      encoding,
    };
  }
  return {
    isValid: false,
  };
};
