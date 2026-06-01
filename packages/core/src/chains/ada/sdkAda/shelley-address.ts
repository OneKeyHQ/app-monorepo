/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

// @ts-expect-error
import { derivePrivate, toPublic } from 'cardano-crypto.js';

import type { IHdCredentialDecryptCacheParams } from '@onekeyhq/core/src/secret';
import type { ICoreHdCredentialEncryptHex } from '@onekeyhq/core/src/types';

import { EAdaNetworkId, type IAdaBIP32Path } from '../types';

import { baseAddressFromXpub, stakingAddressFromXpub } from './addresses';
import { getRootKey, getRootKeyFromMnemonic, toBip32StringPath } from './bip32';
import { DERIVATION_SCHEME, HARDENED_THRESHOLD } from './constants';

import type { IAdaRootKeyPerfTraceEvent } from './bip32';

export type IAdaShelleyAddressPerfTraceEvent =
  | IAdaRootKeyPerfTraceEvent
  | {
      durationMs: number;
      metadata?: Record<string, boolean | number | string | undefined>;
      name: 'batchGetShelleyAddressByRootKey' | 'getRootKey.total';
    };

export type IAdaShelleyAddressPerfTrace = {
  onEvent: (event: IAdaShelleyAddressPerfTraceEvent) => void;
};

type IAdaShelleyAddressOptions = IHdCredentialDecryptCacheParams & {
  perfTrace?: IAdaShelleyAddressPerfTrace;
};

export type IAdaBatchGetShelleyAddressByRootKeyHexParams = {
  indexes: number[];
  networkId?: EAdaNetworkId;
  rootKeyHex: string;
};

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

const shelleyAccountPath = (account: number): IAdaBIP32Path => [
  HARDENED_THRESHOLD + 1852,
  HARDENED_THRESHOLD + 1815,
  HARDENED_THRESHOLD + account,
];

const shelleySpendPathSuffix = (): IAdaBIP32Path => [0, 0];

const shelleyStakePathSuffix = (): IAdaBIP32Path => [2, 0];

export const derivePath = (paths: IAdaBIP32Path, parentKey: Buffer) =>
  paths.reduce(
    (prev, path) => derivePrivate(prev, path, DERIVATION_SCHEME),
    parentKey,
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

const deriveShelleyAddressInfo = (
  accountIndex: number,
  rootKey: Buffer,
  networkId: EAdaNetworkId,
) => {
  const accountPath = shelleyAccountPath(accountIndex);
  const accountKey = derivePath(accountPath, rootKey);
  const pathSpend: IAdaBIP32Path = [
    ...accountPath,
    ...shelleySpendPathSuffix(),
  ];
  const pathStake: IAdaBIP32Path = [
    ...accountPath,
    ...shelleyStakePathSuffix(),
  ];
  const spendKey = derivePath(shelleySpendPathSuffix(), accountKey);
  const stakeKey = derivePath(shelleyStakePathSuffix(), accountKey);
  const spendXpub = toPublic(spendKey.slice(0, 64));
  const stakeXpub = toPublic(stakeKey.slice(0, 64));

  return {
    baseAddress: {
      path: toBip32StringPath(pathSpend),
      address: baseAddressFromXpub(spendXpub, stakeXpub, networkId),
      xpub: accountKey.slice(64).toString('hex'),
    },
    stakingAddress: {
      path: pathStake,
      address: stakingAddressFromXpub(stakeXpub, networkId),
    },
  };
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

export type IAdaShelleyAddressInfo = {
  baseAddress: IAdaBaseAddressInfo;
  stakingAddress: IAdaStakingAddressInfo;
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
): IAdaShelleyAddressInfo[] =>
  indexes.map((accountIndex) =>
    deriveShelleyAddressInfo(accountIndex, rootKey, networkId),
  );

export const batchGetShelleyAddressByRootKeyHex = ({
  indexes,
  networkId = EAdaNetworkId.MAINNET,
  rootKeyHex,
}: IAdaBatchGetShelleyAddressByRootKeyHexParams): IAdaShelleyAddressInfo[] =>
  batchGetShelleyAddressByRootKey(
    Buffer.from(rootKeyHex, 'hex'),
    indexes,
    networkId,
  );

export const batchGetShelleyAddresses = async (
  hdCredential: ICoreHdCredentialEncryptHex,
  password: string,
  indexes: number[],
  networkId: EAdaNetworkId,
  options?: IAdaShelleyAddressOptions,
) => {
  const rootKeyStart = Date.now();
  const rootKey = await getRootKey(password, hdCredential, options);
  options?.perfTrace?.onEvent({
    durationMs: Date.now() - rootKeyStart,
    metadata: {
      indexes: indexes.length,
      networkId,
    },
    name: 'getRootKey.total',
  });
  const deriveStart = Date.now();
  const result = batchGetShelleyAddressByRootKey(rootKey, indexes, networkId);
  options?.perfTrace?.onEvent({
    durationMs: Date.now() - deriveStart,
    metadata: {
      indexes: indexes.length,
      networkId,
    },
    name: 'batchGetShelleyAddressByRootKey',
  });
  return result;
};

export const batchGetShelleyAddressesByMnemonic = async (
  mnemonic: string,
  indexes: number[],
  networkId: EAdaNetworkId,
  options?: Pick<IAdaShelleyAddressOptions, 'perfTrace'>,
) => {
  const rootKeyStart = Date.now();
  const rootKey = await getRootKeyFromMnemonic(mnemonic, options);
  options?.perfTrace?.onEvent({
    durationMs: Date.now() - rootKeyStart,
    metadata: {
      indexes: indexes.length,
      networkId,
    },
    name: 'getRootKey.total',
  });
  const deriveStart = Date.now();
  const result = batchGetShelleyAddressByRootKey(rootKey, indexes, networkId);
  options?.perfTrace?.onEvent({
    durationMs: Date.now() - deriveStart,
    metadata: {
      indexes: indexes.length,
      networkId,
    },
    name: 'batchGetShelleyAddressByRootKey',
  });
  return result;
};
