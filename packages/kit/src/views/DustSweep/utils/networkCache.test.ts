import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type { IDustSweepRouteParams } from '@onekeyhq/shared/types/swap/dustSweep';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import {
  beginDustSweepNetworksCacheWrite,
  getDustSweepNetworksCache,
  getDustSweepNetworksCacheRevision,
  invalidateDustSweepNetworksCache,
  setDustSweepNetworksCache,
} from './networkCache';

import type { IDustSweepNetworksResult } from './loadNetworks';

function result(): IDustSweepNetworksResult {
  return {
    networks: [
      {
        network: {
          networkId: 'evm--1',
          name: 'Ethereum',
          symbol: 'ETH',
        },
        accountId: 'account',
        address: '0xuser',
        nativeToken: {
          networkId: 'evm--1',
          contractAddress: '',
          isNative: true,
          symbol: 'ETH',
          decimals: 18,
          price: '2000',
        },
        tokens: [
          {
            key: 'evm--1:token',
            networkId: 'evm--1',
            contractAddress: '0xtoken',
            symbol: 'TOKEN',
            decimals: 18,
            amount: '1',
            valueUsd: '2',
            suspicious: false,
          },
        ],
        balanceUsd: '3',
      },
    ],
    partialError: true,
    providerInfo: {
      provider: 'SwapOKX',
      protocol: EProtocolOfExchange.SWAP,
      providerName: 'OKX',
      logo: 'https://example.com/okx.png',
    },
    failedNetworkIds: ['evm--56'],
    failedNetworks: [
      { networkId: 'evm--56', name: 'BNB Smart Chain', symbol: 'BNB' },
    ],
  };
}

let now = 0;
let sequence = 0;
let params: IDustSweepRouteParams;

beforeEach(() => {
  now += 10 * 60 * 1000;
  sequence += 1;
  params = {
    walletId: `dust-cache-${sequence}`,
    accountId: 'account',
    indexedAccountId: 'indexed',
    entry: 'lowValueRow',
  };
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => jest.restoreAllMocks());

it('isolates every account scope while sharing data across entry points', () => {
  const data = result();
  setDustSweepNetworksCache(params, data);
  for (const changed of [
    { walletId: 'other-wallet' },
    { accountId: 'other-account' },
    { indexedAccountId: 'other-indexed' },
    { networkId: 'evm--1' },
  ])
    expect(
      getDustSweepNetworksCache({ ...params, ...changed }),
    ).toBeUndefined();
  expect(
    getDustSweepNetworksCache({ ...params, entry: 'tokenListHeader' }),
  ).toEqual(data);
});

it('keeps scope delimiters from colliding', () => {
  const first = { ...params, walletId: `${params.walletId}:a`, accountId: 'b' };
  const other = { ...params, accountId: 'a:b' };
  setDustSweepNetworksCache(first, result());
  expect(getDustSweepNetworksCache(other)).toBeUndefined();
});

it('copies the complete result on writes and reads', () => {
  const data = result();
  const expected = result();
  setDustSweepNetworksCache(params, data);
  data.networks[0].tokens[0].amount = '100';
  data.failedNetworkIds?.push('evm--10');
  const cached = getDustSweepNetworksCache(params);
  expect(cached).toEqual(expected);
  if (cached) {
    cached.networks[0].nativeToken.price = '1';
    cached.networks[0].tokens[0].amount = '200';
    cached.failedNetworks?.pop();
  }
  expect(getDustSweepNetworksCache(params)).toEqual(expected);
});

it('preserves an authoritative empty result as a cache hit', () => {
  const empty: IDustSweepNetworksResult = {
    networks: [],
    partialError: false,
  };
  setDustSweepNetworksCache(params, empty);
  expect(getDustSweepNetworksCache(params)).toEqual(empty);
});

it('expires five minutes after capture even when repeatedly read', () => {
  setDustSweepNetworksCache(params, result());
  now += 5 * 60 * 1000 - 1;
  expect(getDustSweepNetworksCache(params)).toBeDefined();
  now += 1;
  expect(getDustSweepNetworksCache(params)).toBeUndefined();
});

it('starts a new lifetime when a refreshed result replaces a snapshot', () => {
  setDustSweepNetworksCache(params, result());
  now += 4 * 60 * 1000;
  setDustSweepNetworksCache(params, { networks: [], partialError: false });
  now += 4 * 60 * 1000;
  expect(getDustSweepNetworksCache(params)?.networks).toEqual([]);
  now += 60 * 1000;
  expect(getDustSweepNetworksCache(params)).toBeUndefined();
});

it.each(['read', 'write'] as const)(
  'evicts the least recently used entry after a %s without exceeding sixteen scopes',
  (access) => {
    const scopes = Array.from({ length: 17 }, (_, index) => ({
      ...params,
      accountId: `account-${index}`,
    }));
    scopes
      .slice(0, 16)
      .forEach((scope) => setDustSweepNetworksCache(scope, result()));
    if (access === 'read') getDustSweepNetworksCache(scopes[0]);
    else setDustSweepNetworksCache(scopes[0], result());
    setDustSweepNetworksCache(scopes[16], result());
    expect(getDustSweepNetworksCache(scopes[1])).toBeUndefined();
    for (const scope of [scopes[0], ...scopes.slice(2)])
      expect(getDustSweepNetworksCache(scope)).toBeDefined();
  },
);

it('invalidates every scope for one wallet and advances only its revision', () => {
  const anotherScope = { ...params, networkId: 'evm--56' };
  const anotherWallet = { ...params, walletId: `${params.walletId}-other` };
  for (const scope of [params, anotherScope, anotherWallet])
    setDustSweepNetworksCache(scope, result());
  const revision = getDustSweepNetworksCacheRevision(params.walletId);
  const otherRevision = getDustSweepNetworksCacheRevision(
    anotherWallet.walletId,
  );
  invalidateDustSweepNetworksCache(params.walletId);
  expect(getDustSweepNetworksCache(params)).toBeUndefined();
  expect(getDustSweepNetworksCache(anotherScope)).toBeUndefined();
  expect(getDustSweepNetworksCache(anotherWallet)).toBeDefined();
  expect(getDustSweepNetworksCacheRevision(params.walletId)).toBe(revision + 1);
  expect(getDustSweepNetworksCacheRevision(anotherWallet.walletId)).toBe(
    otherRevision,
  );
  invalidateDustSweepNetworksCache(params.walletId);
  expect(getDustSweepNetworksCacheRevision(params.walletId)).toBe(revision + 2);
});

it('keeps invalidation revisions after cache expiry so old work stays obsolete', () => {
  const revision = getDustSweepNetworksCacheRevision(params.walletId);
  expect(revision).toBe(0);
  setDustSweepNetworksCache(params, result());
  invalidateDustSweepNetworksCache(params.walletId);
  setDustSweepNetworksCache(params, result());
  now += 5 * 60 * 1000;
  expect(getDustSweepNetworksCache(params)).toBeUndefined();
  expect(getDustSweepNetworksCacheRevision(params.walletId)).toBe(revision + 1);
});

it('invalidates cached owners even when no Dust page is mounted', () => {
  const data = result();
  const write = beginDustSweepNetworksCacheWrite(params);
  setDustSweepNetworksCache(params, data, write);
  appEventBus.emit(EAppEventBusNames.GlobalDeriveTypeUpdate, {
    networkImpl: 'evm',
  });
  expect(getDustSweepNetworksCache(params)).toBeUndefined();
  setDustSweepNetworksCache(params, data, write);
  expect(getDustSweepNetworksCache(params)).toBeUndefined();
});

it('only accepts the latest writer for the requested cache scope', () => {
  const old = beginDustSweepNetworksCacheWrite(params);
  const current = beginDustSweepNetworksCacheWrite(params);
  const data = result();
  setDustSweepNetworksCache(
    params,
    { networks: [], partialError: false },
    current,
  );
  setDustSweepNetworksCache(params, data, old);
  expect(getDustSweepNetworksCache(params)?.networks).toEqual([]);
  setDustSweepNetworksCache(
    { ...params, accountId: 'other-account' },
    data,
    current,
  );
  expect(
    getDustSweepNetworksCache({ ...params, accountId: 'other-account' }),
  ).toBeUndefined();
});
