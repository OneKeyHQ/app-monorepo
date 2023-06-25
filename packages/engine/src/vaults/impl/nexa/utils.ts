/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { InvalidAddressError } from 'bchaddrjs';
import bs58check from 'bs58check';
import { decode, encode } from 'nexaaddrjs';

import type { Verifier } from '../../../proxy';

export function verifyNexaAddress(address: string) {
  try {
    decode(address);
    return {
      isValid: true,
      normalizedAddress: address,
    };
  } catch (error) {
    return {
      isValid: false,
    };
  }
}
