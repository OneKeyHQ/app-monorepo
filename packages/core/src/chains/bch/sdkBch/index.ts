import {
  isCashAddress,
  isValidAddress,
  toCashAddress,
  toLegacyAddress,
} from 'bchaddrjs';

import { OneKeyPlainTextError } from '@onekeyhq/shared/src/errors';

export function decodeAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new OneKeyPlainTextError(`Invalid address: ${address}`);
  }
  if (isCashAddress(address)) {
    return toLegacyAddress(address);
  }

  return address;
}

export function encodeAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new OneKeyPlainTextError(`Invalid address: ${address}`);
  }
  if (!isCashAddress(address)) {
    return toCashAddress(address);
  }
  return address;
}
