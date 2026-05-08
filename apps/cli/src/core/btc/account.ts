import BigNumber from 'bignumber.js';

import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';
import { getSignerByImpl } from '../../signer';
import { assertAddressForChain } from '../address-utils';
import { fetchHistory, formatHistoryList } from '../history-fetcher';

import {
  getBtcAddressTypeInfo,
  listBtcAddressTypeInfos,
} from './address-types';

import type { BtcAddressType, IBtcAddressTypeInfo } from './address-types';
import type { ISigner } from '../../signer/types';
import type { IChainConfig } from '../chain-resolver';
import type {
  IFetchHistoryParams,
  IHistoryApiResponse,
  IHistoryItem,
} from '../history-fetcher';

interface IAccountResponse {
  address: string;
  balance?: string;
  balanceParsed?: string;
  nonce?: number;
}

export type IBtcDerivedAddress = Pick<
  IBtcAddressTypeInfo,
  'addressType' | 'label' | 'deriveType' | 'addressEncoding'
> & {
  address: string;
  path: string;
};

export interface IBtcDerivedBalanceItem extends IBtcDerivedAddress {
  balance: string;
  balanceRaw?: string;
}

export interface IBtcDerivedBalanceResult {
  chain: string;
  aggregate: {
    symbol: string;
    balance: string;
    contractAddress: '';
    isNative: true;
  };
  items: IBtcDerivedBalanceItem[];
}

export interface IBtcExternalBalanceResult {
  address: string;
  balance: string;
  balanceRaw?: string;
}

export interface IBtcDerivedHistoryAddressType {
  addressType: BtcAddressType;
  label: string;
  address: string;
  count: number;
}

export interface IBtcDerivedHistoryResult {
  chain: string;
  aggregate: true;
  items: IHistoryItem[];
  addressTypes: IBtcDerivedHistoryAddressType[];
}

function getBalanceDisplay(account: IAccountResponse): string {
  const balanceDisplay = account.balanceParsed ?? account.balance;
  if (balanceDisplay === null || balanceDisplay === undefined) {
    throw new AppError(
      ERROR_CODES.BIZ_UNKNOWN.code,
      'API response is missing balance data',
      'This may indicate an API contract change.',
    );
  }
  return balanceDisplay;
}

function getAddressTypeInfos(
  chainConfig: IChainConfig,
  addressType?: BtcAddressType,
): IBtcAddressTypeInfo[] {
  return addressType
    ? [getBtcAddressTypeInfo(chainConfig.impl, addressType)]
    : listBtcAddressTypeInfos(chainConfig.impl);
}

function sortHistoryItems(items: IHistoryItem[]): IHistoryItem[] {
  return items.slice().toSorted((a, b) => {
    const aTimestamp =
      typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : Number.NaN;
    const bTimestamp =
      typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : Number.NaN;

    if (Number.isNaN(aTimestamp) && Number.isNaN(bTimestamp)) return 0;
    if (Number.isNaN(aTimestamp)) return 1;
    if (Number.isNaN(bTimestamp)) return -1;
    return bTimestamp - aTimestamp;
  });
}

export async function deriveBtcAddress(
  chainConfig: IChainConfig,
  addressType: BtcAddressType,
): Promise<IBtcDerivedAddress> {
  const signer = await getSignerByImpl(chainConfig.impl);
  return deriveBtcAddressWithSigner(chainConfig, addressType, signer);
}

async function deriveBtcAddressWithSigner(
  chainConfig: IChainConfig,
  addressType: BtcAddressType,
  signer: ISigner,
): Promise<IBtcDerivedAddress> {
  const info = getBtcAddressTypeInfo(chainConfig.impl, addressType);
  const addressInfo = await signer.getAddress(chainConfig.networkId, {
    addressType,
  });

  return {
    addressType: info.addressType,
    label: info.label,
    deriveType: info.deriveType,
    addressEncoding: info.addressEncoding,
    address: addressInfo.address,
    path: info.path,
  };
}

async function deriveBtcAddresses(
  chainConfig: IChainConfig,
  addressType?: BtcAddressType,
): Promise<IBtcDerivedAddress[]> {
  const signer = await getSignerByImpl(chainConfig.impl);
  const addresses: IBtcDerivedAddress[] = [];

  for (const info of getAddressTypeInfos(chainConfig, addressType)) {
    addresses.push(
      await deriveBtcAddressWithSigner(chainConfig, info.addressType, signer),
    );
  }

  return addresses;
}

export async function fetchBtcExternalAddressBalance(
  chainConfig: IChainConfig,
  addressInput: string,
): Promise<IBtcExternalBalanceResult> {
  const address = assertAddressForChain(chainConfig, addressInput);
  const account = await apiClient.get<IAccountResponse>(
    'wallet',
    '/wallet/v1/account/get-account',
    {
      networkId: chainConfig.networkId,
      accountAddress: address,
      withNetWorth: true,
    },
  );

  return {
    address,
    balance: getBalanceDisplay(account),
    ...(account.balance ? { balanceRaw: account.balance } : {}),
  };
}

export async function fetchBtcDerivedBalances(
  chainConfig: IChainConfig,
  addressType?: BtcAddressType,
): Promise<IBtcDerivedBalanceResult> {
  const addresses = await deriveBtcAddresses(chainConfig, addressType);

  const items = await Promise.all(
    addresses.map(async (addressInfo) => {
      const account = await apiClient.get<IAccountResponse>(
        'wallet',
        '/wallet/v1/account/get-account',
        {
          networkId: chainConfig.networkId,
          accountAddress: addressInfo.address,
          withNetWorth: true,
        },
      );

      return {
        ...addressInfo,
        balance: getBalanceDisplay(account),
        ...(account.balance ? { balanceRaw: account.balance } : {}),
      };
    }),
  );

  const total = items.reduce(
    (acc, item) => acc.plus(item.balance || '0'),
    new BigNumber(0),
  );

  return {
    chain: chainConfig.impl,
    aggregate: {
      symbol: chainConfig.nativeSymbol,
      balance: total.toFixed(),
      contractAddress: '',
      isNative: true,
    },
    items,
  };
}

export async function fetchBtcExternalAddressHistory(
  chainConfig: IChainConfig,
  params: Omit<IFetchHistoryParams, 'networkId' | 'accountAddress'> & {
    addressInput: string;
    detail: boolean;
  },
): Promise<{
  address: string;
  response: IHistoryApiResponse;
  items: IHistoryItem[];
}> {
  const address = assertAddressForChain(chainConfig, params.addressInput);
  const response = await fetchHistory({
    networkId: chainConfig.networkId,
    accountAddress: address,
    tokenAddress: params.tokenAddress,
    limit: params.limit,
  });
  return {
    address,
    response,
    items: formatHistoryList(response, params.detail),
  };
}

export async function fetchBtcDerivedHistory(
  chainConfig: IChainConfig,
  params: {
    addressType?: BtcAddressType;
    limit: number;
    detail: boolean;
  },
): Promise<IBtcDerivedHistoryResult> {
  const addresses = await deriveBtcAddresses(chainConfig, params.addressType);

  const perAddress = await Promise.all(
    addresses.map(async (addressInfo) => {
      const response = await fetchHistory({
        networkId: chainConfig.networkId,
        accountAddress: addressInfo.address,
        tokenAddress: undefined,
        limit: params.limit,
      });
      const items = formatHistoryList(response, params.detail).map((item) =>
        params.detail
          ? { ...item, networkName: chainConfig.nativeSymbol }
          : item,
      );

      return {
        addressInfo,
        items,
      };
    }),
  );

  return {
    chain: chainConfig.impl,
    aggregate: true,
    items: sortHistoryItems(perAddress.flatMap((entry) => entry.items)).slice(
      0,
      params.limit,
    ),
    // Count is fetched per address type, not the post-limit visible count.
    addressTypes: perAddress.map((entry) => ({
      addressType: entry.addressInfo.addressType,
      label: entry.addressInfo.label,
      address: entry.addressInfo.address,
      count: entry.items.length,
    })),
  };
}
