import { Address } from '@kaspa/core-lib';

import type { PublicKey } from '@kaspa/core-lib';

export enum AddressType {
  PayToPublicKey = 'pubkey',
  PayToScriptHash = 'scripthash',
}

export function addressFromPublicKeyBuffer(
  pubKey: Buffer,
  chainId: string,
): string {
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
  return Address.fromPublicKeyBuffer(pubKey, chainId).toString();
}

export function addressFromPublicKey(
  pubKey: PublicKey,
  chainId: string,
): string {
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
  return Address.fromPublicKey(pubKey, chainId).toString();
}

export function fromString(
  address: string,
  chainId: string,
  addressType: AddressType = AddressType.PayToPublicKey,
): Address {
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
  return Address.fromString(address, chainId, addressType);
}

export function isValidAddress(
  address: string,
  chainId: string,
  addressType: AddressType = AddressType.PayToPublicKey,
): boolean {
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
  return Address.isValid(address, chainId, addressType);
}
