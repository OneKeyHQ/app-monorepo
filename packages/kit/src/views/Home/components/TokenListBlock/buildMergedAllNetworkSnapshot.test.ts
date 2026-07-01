/**
 * buildMergedAllNetworkSnapshot — pure merge/sort/split of all-network fetch
 * rounds. Extracted (P0) from `TokenListBlock.updateAllNetworksTokenList` so the
 * live consumer (L2 progressive paint) and the cold cache-seed (L1) share ONE
 * merge truth. Behavior must mirror the inline original exactly:
 *   merge-derive → $key dedup → sortTokensByFiatValue → zero-balance re-sort →
 *   high/low split at TOKEN_LIST_HIGH_VALUE_MAX.
 */
import BigNumber from 'bignumber.js';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { buildMergedAllNetworkSnapshot } from './buildMergedAllNetworkSnapshot';

import type { IAllNetworkSnapshotRound } from './buildMergedAllNetworkSnapshot';

function makeFiat(
  fiatValue: string,
  overrides: Partial<ITokenFiat> = {},
): ITokenFiat {
  return {
    balance: '0',
    balanceParsed: '0',
    fiatValue,
    price: 0,
    ...overrides,
  };
}

function makeToken(
  key: string,
  overrides: Partial<IAccountToken> = {},
): IAccountToken {
  return {
    $key: key,
    name: key,
    symbol: key,
    decimals: 18,
    address: `0x${key}`,
    isNative: false,
    ...overrides,
  } as IAccountToken;
}

function makeRound(
  over: Partial<IAllNetworkSnapshotRound>,
): IAllNetworkSnapshotRound {
  return {
    networkId: 'evm--1',
    accountId: 'acc1',
    tokens: { data: [], keys: '', map: {} },
    smallBalanceTokens: { data: [], keys: '', map: {} },
    riskTokens: { data: [], keys: '', map: {} },
    ...over,
  };
}

describe('buildMergedAllNetworkSnapshot', () => {
  it('sorts by fiat desc, pushes zero-balance last, and sums per-network worth', () => {
    const rounds: IAllNetworkSnapshotRound[] = [
      makeRound({
        networkId: 'evm--1',
        tokens: {
          data: [makeToken('a1'), makeToken('a2')],
          keys: 'ka',
          map: { a1: makeFiat('10'), a2: makeFiat('0') },
        },
      }),
      makeRound({
        networkId: 'evm--56',
        tokens: {
          data: [makeToken('b1')],
          keys: 'kb',
          map: { b1: makeFiat('5') },
        },
      }),
    ];

    const snap = buildMergedAllNetworkSnapshot({
      rounds,
      mergeDeriveAssetsByNetworkId: {},
      accountId: 'acc1',
    });

    expect(snap.orderedTokens.map((t) => t.$key)).toEqual(['a1', 'b1', 'a2']);
    expect(snap.smallBalanceTokens).toHaveLength(0);

    expect(
      new BigNumber(
        snap.accountsWorth[
          accountUtils.buildAccountValueKey({
            accountId: 'acc1',
            networkId: 'evm--1',
          })
        ],
      ).toNumber(),
    ).toBe(10);
    expect(
      new BigNumber(
        snap.accountsWorth[
          accountUtils.buildAccountValueKey({
            accountId: 'acc1',
            networkId: 'evm--56',
          })
        ],
      ).toNumber(),
    ).toBe(5);
    // non-others account: every round's worth folds into createAtNetworkWorth
    expect(new BigNumber(snap.createAtNetworkWorth).toNumber()).toBe(15);
  });

  it('dedups the same $key appearing across networks', () => {
    const rounds: IAllNetworkSnapshotRound[] = [
      makeRound({
        networkId: 'evm--1',
        tokens: {
          data: [makeToken('dup')],
          keys: 'k1',
          map: { dup: makeFiat('10') },
        },
      }),
      makeRound({
        networkId: 'evm--56',
        tokens: {
          data: [makeToken('dup')],
          keys: 'k2',
          map: { dup: makeFiat('10') },
        },
      }),
    ];

    const snap = buildMergedAllNetworkSnapshot({
      rounds,
      mergeDeriveAssetsByNetworkId: {},
      accountId: 'acc1',
    });

    expect(snap.orderedTokens.map((t) => t.$key)).toEqual(['dup']);
  });

  it('carries and sorts the risky slice', () => {
    const rounds: IAllNetworkSnapshotRound[] = [
      makeRound({
        riskTokens: {
          data: [makeToken('r2'), makeToken('r1')],
          keys: 'kr',
          map: { r1: makeFiat('9'), r2: makeFiat('3') },
        },
      }),
    ];

    const snap = buildMergedAllNetworkSnapshot({
      rounds,
      mergeDeriveAssetsByNetworkId: {},
      accountId: 'acc1',
    });

    expect(snap.riskyTokens.map((t) => t.$key)).toEqual(['r1', 'r2']);
    expect(snap.orderedTokens).toHaveLength(0);
  });

  it('collapses derive tokens when mergeDeriveAssets is enabled for the network', () => {
    const rounds: IAllNetworkSnapshotRound[] = [
      makeRound({
        networkId: 'btc--0',
        tokens: {
          data: [makeToken('btc--0_xpubabc_native', { mergeAssets: true })],
          keys: 'kbtc',
          map: { 'btc--0_xpubabc_native': makeFiat('7') },
        },
      }),
    ];

    const snap = buildMergedAllNetworkSnapshot({
      rounds,
      mergeDeriveAssetsByNetworkId: { 'btc--0': true },
      accountId: 'acc1',
    });

    // merge-derive rewrites `$key` to `${impl-chain}_${last}` => `btc--0_native`
    expect(snap.orderedTokens.map((t) => t.$key)).toEqual(['btc--0_native']);
  });

  it('per-round mergeDeriveAssets:true overrides an empty networkId map', () => {
    const rounds: IAllNetworkSnapshotRound[] = [
      makeRound({
        networkId: 'btc--0',
        mergeDeriveAssets: true,
        tokens: {
          data: [makeToken('btc--0_xpubabc_native', { mergeAssets: true })],
          keys: 'kbtc',
          map: { 'btc--0_xpubabc_native': makeFiat('7') },
        },
      }),
    ];

    const snap = buildMergedAllNetworkSnapshot({
      rounds,
      mergeDeriveAssetsByNetworkId: {}, // empty → only the per-round flag drives it
      accountId: 'acc1',
    });

    expect(snap.orderedTokens.map((t) => t.$key)).toEqual(['btc--0_native']);
  });

  it('per-round mergeDeriveAssets:false prevents merge even when the map says true', () => {
    const rounds: IAllNetworkSnapshotRound[] = [
      makeRound({
        networkId: 'btc--0',
        mergeDeriveAssets: false,
        tokens: {
          data: [makeToken('btc--0_xpubabc_native', { mergeAssets: true })],
          keys: 'kbtc',
          map: { 'btc--0_xpubabc_native': makeFiat('7') },
        },
      }),
    ];

    const snap = buildMergedAllNetworkSnapshot({
      rounds,
      mergeDeriveAssetsByNetworkId: { 'btc--0': true }, // map says true; round overrides to false
      accountId: 'acc1',
    });

    // not merged → keeps the raw per-derive `$key`
    expect(snap.orderedTokens.map((t) => t.$key)).toEqual([
      'btc--0_xpubabc_native',
    ]);
  });
});
