import type { SubstrateAccountId } from '../sdk/types';

export interface SubstrateCompatAddress {
  getValue(): string;
  compare(other: SubstrateAccountId<this>): number;
  getBufferBytes(): Buffer;
  getHexBytes(): string;
}

export function isSubstrateCompatAddress(
  address: unknown,
): address is SubstrateCompatAddress {
  return (
    address instanceof Object &&
    'compare' in address &&
    'getBufferBytes' in address &&
    'getHexBytes' in address
  );
}
