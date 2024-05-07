import { baseDecode, baseEncode } from 'borsh';

import { EAddressEncodings } from '@onekeyhq/core/src/types';
import type { IAddressValidation } from '@onekeyhq/shared/types/address';

export { baseDecode, baseEncode };

const IMPLICIT_ACCOUNT_PATTERN = /^[a-z\d]{64}$/;
const REGISTER_ACCOUNT_PATTERN =
  /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export function verifyNearAddress(address: string): IAddressValidation {
  let encoding: EAddressEncodings | undefined;
  if (IMPLICIT_ACCOUNT_PATTERN.test(address)) {
    encoding = EAddressEncodings.IMPLICIT_ACCOUNT;
  } else if (REGISTER_ACCOUNT_PATTERN.test(address)) {
    return {
      isValid: true,
      normalizedAddress: address,
      displayAddress: address,
      encoding: EAddressEncodings.REGISTER_ACCOUNT,
    };
  } else if (address.includes(':')) {
    const [prefix, encoded] = address.split(':');
    try {
      if (
        prefix === 'ed25519' &&
        Buffer.from(baseDecode(encoded)).length === 32
      ) {
        encoding = EAddressEncodings.ENCODED_PUBKEY;
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
    normalizedAddress: '',
    displayAddress: '',
  };
}
