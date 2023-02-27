/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  AddressTypes,
  base58,
  bech32,
  getAddressType,
  getPubKeyBlake2b224Hash,
  getShelleyAddressNetworkId,
  isValidBootstrapAddress,
  isValidShelleyAddress,
  packBaseAddress,
  packRewardAddress,
  // @ts-expect-error
} from 'cardano-crypto.js';

import { NetworkId } from '../types';

import { HARDENED_THRESHOLD } from './constants';

import type { Address, BIP32Path } from '../types';

export const encodeAddress = (address: Buffer): Address => {
  const addressType = getAddressType(address);
  if (addressType === AddressTypes.BOOTSTRAP) {
    return base58.encode(address);
  }
  const addressPrefixes: { [key: number]: string } = {
    [AddressTypes.BASE]: 'addr',
    [AddressTypes.POINTER]: 'addr',
    [AddressTypes.ENTERPRISE]: 'addr',
    [AddressTypes.REWARD]: 'stake',
  };
  const isTestnet =
    getShelleyAddressNetworkId(address) === NetworkId.TESTNET_OR_PREPROD;
  const addressPrefix = `${addressPrefixes[addressType]}${
    isTestnet ? '_test' : ''
  }`;
  return bech32.encode(addressPrefix, address);
};

export const xpub2pub = (xpub: Buffer) => xpub.slice(0, 32);

export const xpub2ChainCode = (xpub: Buffer) => xpub.slice(32, 64);

// takes xpubkey, converts it to pubkey and then to 28 byte blake2b encoded hash
const xpub2blake2b224Hash = (xpub: Buffer) =>
  getPubKeyBlake2b224Hash(xpub2pub(xpub));

export const isShelleyPath = (path: BIP32Path) =>
  path[0] - HARDENED_THRESHOLD === 1852;

export const stakingAddressFromXpub = (
  stakeXpub: Buffer,
  networkId: NetworkId,
): Address => {
  const addrBuffer: Buffer = packRewardAddress(
    xpub2blake2b224Hash(stakeXpub),
    networkId,
  );
  return encodeAddress(addrBuffer);
};

export const baseAddressFromXpub = (
  spendXpub: Buffer,
  stakeXpub: Buffer,
  networkId: NetworkId,
): Address => {
  const addrBuffer = packBaseAddress(
    xpub2blake2b224Hash(spendXpub),
    xpub2blake2b224Hash(stakeXpub),
    networkId,
  );
  return encodeAddress(addrBuffer);
};

export const validShelleyAddress = (address: string): boolean =>
  // Shelley era addr1 and addr_test1
  (address.startsWith('addr1') || address.startsWith('addr_test1')) &&
  isValidShelleyAddress(address);
export const validBootstrapAddress = (address: string): boolean =>
  // Byron era Ae2 and DdzFF
  (address.startsWith('Ae2') || address.startsWith('DdzFF')) &&
  isValidBootstrapAddress(address);
