import {
  isCashAddress,
  isValidAddress,
  toCashAddress,
  toLegacyAddress,
} from 'bchaddrjs';

export function decodeAddress(address: string): string {
  if (
    !isValidAddress(address) ||
    (isCashAddress(address) && !address.startsWith('bitcoincash:'))
  ) {
    throw new Error(`Invalid address: ${address}`);
  }
  if (isCashAddress(address)) {
    return toLegacyAddress(address);
  }

  return address;
}

export function encodeAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  if (!isCashAddress(address)) {
    return toCashAddress(address);
  }
  return address;
}
