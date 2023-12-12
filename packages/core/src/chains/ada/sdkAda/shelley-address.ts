/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

// @ts-expect-error
import { derivePrivate, toPublic } from 'cardano-crypto.js';

import { baseAddressFromXpub, stakingAddressFromXpub } from './addresses';
import { getRootKey, toBip32StringPath } from './bip32';
import { DERIVATION_SCHEME, HARDENED_THRESHOLD } from './constants';

import { ICoreHdCredentialEncryptHex } from '../../../types';
import type { EAdaNetworkId, IAdaBIP32Path } from '../types';

const shelleyPath = (account: number): IAdaBIP32Path => [
  HARDENED_THRESHOLD + 1852,
  HARDENED_THRESHOLD + 1815,
  HARDENED_THRESHOLD + account,
  0,
  0,
];

const shelleyStakeAccountPath = (account: number): IAdaBIP32Path => [
  HARDENED_THRESHOLD + 1852,
  HARDENED_THRESHOLD + 1815,
  HARDENED_THRESHOLD + account,
  2, // "staking key chain"
  0,
];

export const derivePath = (paths: IAdaBIP32Path, rootKey: Buffer) =>
  paths.reduce(
    (prev, path) => derivePrivate(prev, path, DERIVATION_SCHEME),
    rootKey,
  );

/**
 * Get account xpub equal to Trezor Xpub
 * @param paths 1852'/1815'/H(accountIndex)
 * @param rootKey privateKey
 * @returns hex
 */
export const deriveAccountXpub = (
  paths: IAdaBIP32Path,
  rootKey: Buffer,
): string => {
  const accountKey = derivePath(paths, rootKey);
  return accountKey.slice(64).toString('hex');
};

/**
 * Get UTXO or Stake Xpub
 * @param paths 1852'/1815'/H(accountIndex)/0 or 2/ 0
 * @param rootKey privateKey
 * @returns Buffer
 */
export const deriveXpub = (paths: IAdaBIP32Path, rootKey: Buffer): Buffer => {
  const deriveSecret = derivePath(paths, rootKey);
  return toPublic(deriveSecret.slice(0, 64));
};

export type IAdaStakingAddressInfo = {
  path: IAdaBIP32Path;
  address: string;
};
export function ShelleyStakingAccountProvider(
  accountIndex: number,
  rootKey: Buffer,
  networkId: EAdaNetworkId,
): IAdaStakingAddressInfo {
  const pathStake = shelleyStakeAccountPath(accountIndex);
  const stakeXpub = deriveXpub(pathStake, rootKey);

  return {
    path: pathStake,
    address: stakingAddressFromXpub(stakeXpub, networkId),
  };
}

export type IAdaBaseAddressInfo = {
  path: string;
  address: string;
  xpub: string;
};
export function ShelleyBaseAddressProvider(
  accountIndex: number,
  rootKey: Buffer,
  networkId: EAdaNetworkId,
): IAdaBaseAddressInfo {
  const pathSpend = shelleyPath(accountIndex);
  const spendXpub = deriveXpub(pathSpend, rootKey);

  const pathStake = shelleyStakeAccountPath(accountIndex);
  const stakeXpub = deriveXpub(pathStake, rootKey);

  const xpub = deriveAccountXpub(pathSpend.slice(0, 3), rootKey);

  return {
    path: toBip32StringPath(pathSpend),
    address: baseAddressFromXpub(spendXpub, stakeXpub, networkId),
    xpub,
  };
}

export const batchGetShelleyAddressByRootKey = (
  rootKey: Buffer,
  indexes: number[],
  networkId: EAdaNetworkId,
) =>
  indexes.map((accountIndex) => ({
    baseAddress: ShelleyBaseAddressProvider(accountIndex, rootKey, networkId),
    stakingAddress: ShelleyStakingAccountProvider(
      accountIndex,
      rootKey,
      networkId,
    ),
  }));

export const batchGetShelleyAddresses = async (
  hdCredential: ICoreHdCredentialEncryptHex,
  password: string,
  indexes: number[],
  networkId: EAdaNetworkId,
) => {
  const rootKey = await getRootKey(password, hdCredential);
  return batchGetShelleyAddressByRootKey(rootKey, indexes, networkId);
};
