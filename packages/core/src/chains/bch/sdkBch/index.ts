import {
  isCashAddress,
  isValidAddress,
  toCashAddress,
  toLegacyAddress,
} from 'bchaddrjs';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export function decodeAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new OneKeyLocalError(`Invalid address: ${address}`);
  }
  if (isCashAddress(address)) {
    return toLegacyAddress(address);
  }

  return address;
}

export function encodeAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new OneKeyLocalError(`Invalid address: ${address}`);
  }
  if (!isCashAddress(address)) {
    return toCashAddress(address);
  }
  return address;
}
