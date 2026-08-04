import {
  ETokenSelectorSyntheticRowType,
  buildCrossNetworkSearchListData,
  extractCrossNetworkSearchQuery,
  isTokenSelectorSyntheticRow,
} from './tokenSelectorCrossNetworkUtils';

import type { ITokenSelectorListRow } from './tokenSelectorCrossNetworkUtils';
import type { IServerNetwork } from '../../types';
import type { IAccountToken } from '../../types/token';

function buildTestToken(params: Partial<IAccountToken>): IAccountToken {
  return {
    $key: params.$key ?? 'token',
    address: params.address ?? '0x0',
    decimals: params.decimals ?? 6,
    isNative: params.isNative ?? false,
    name: params.name ?? 'USD Coin',
    symbol: params.symbol ?? 'USDC',
    ...params,
  };
}

const CURRENT_NETWORK_ID = 'evm--1';

const ethUsdc = buildTestToken({ $key: 'eth-usdc', networkId: 'evm--1' });
const ethUsdt = buildTestToken({
  $key: 'eth-usdt',
  symbol: 'USDT',
  networkId: 'evm--1',
});
const tronUsdt = buildTestToken({
  $key: 'tron-usdt',
  symbol: 'USDT',
  networkId: 'tron--0x2b6653dc',
});
const solUsdc = buildTestToken({ $key: 'sol-usdc', networkId: 'sol--101' });

function rowTypes(rows: ITokenSelectorListRow[]) {
  return rows.map((row) =>
    isTokenSelectorSyntheticRow(row) ? row.syntheticRowType : row.$key,
  );
}

describe('buildCrossNetworkSearchListData', () => {
  test('both sections populated: current header + tokens, then other header + tokens, input order preserved', () => {
    const rows = buildCrossNetworkSearchListData({
      tokens: [tronUsdt, ethUsdc, solUsdc, ethUsdt],
      currentNetworkId: CURRENT_NETWORK_ID,
    });
    expect(rowTypes(rows)).toEqual([
      ETokenSelectorSyntheticRowType.CurrentNetworkHeader,
      'eth-usdc',
      'eth-usdt',
      ETokenSelectorSyntheticRowType.OtherNetworksHeader,
      'tron-usdt',
      'sol-usdc',
    ]);
  });

  test('current section empty: collapsed no-match row instead of current header', () => {
    const rows = buildCrossNetworkSearchListData({
      tokens: [tronUsdt, solUsdc],
      currentNetworkId: CURRENT_NETWORK_ID,
    });
    expect(rowTypes(rows)).toEqual([
      ETokenSelectorSyntheticRowType.CurrentNetworkNoMatch,
      ETokenSelectorSyntheticRowType.OtherNetworksHeader,
      'tron-usdt',
      'sol-usdc',
    ]);
  });

  test('other section empty without error: current section only, no other header', () => {
    const rows = buildCrossNetworkSearchListData({
      tokens: [ethUsdc, ethUsdt],
      currentNetworkId: CURRENT_NETWORK_ID,
    });
    expect(rowTypes(rows)).toEqual([
      ETokenSelectorSyntheticRowType.CurrentNetworkHeader,
      'eth-usdc',
      'eth-usdt',
    ]);
  });

  test('other section empty with search error: inline error row under other header', () => {
    const rows = buildCrossNetworkSearchListData({
      tokens: [ethUsdc],
      currentNetworkId: CURRENT_NETWORK_ID,
      hasSearchError: true,
    });
    expect(rowTypes(rows)).toEqual([
      ETokenSelectorSyntheticRowType.CurrentNetworkHeader,
      'eth-usdc',
      ETokenSelectorSyntheticRowType.OtherNetworksHeader,
      ETokenSelectorSyntheticRowType.OtherNetworksSearchError,
    ]);
  });

  test('both sections empty: returns [] so ListEmptyComponent owns the state, even on error', () => {
    expect(
      buildCrossNetworkSearchListData({
        tokens: [],
        currentNetworkId: CURRENT_NETWORK_ID,
      }),
    ).toEqual([]);
    expect(
      buildCrossNetworkSearchListData({
        tokens: [],
        currentNetworkId: CURRENT_NETWORK_ID,
        hasSearchError: true,
      }),
    ).toEqual([]);
  });

  test('synthetic row keys are stable, distinct, and type-discriminable from tokens', () => {
    const rows = buildCrossNetworkSearchListData({
      tokens: [ethUsdc, tronUsdt],
      currentNetworkId: CURRENT_NETWORK_ID,
    });
    const syntheticRows = rows.filter(isTokenSelectorSyntheticRow);
    expect(syntheticRows).toHaveLength(2);
    expect(new Set(syntheticRows.map((row) => row.$key)).size).toBe(2);
    const rerun = buildCrossNetworkSearchListData({
      tokens: [ethUsdc, tronUsdt],
      currentNetworkId: CURRENT_NETWORK_ID,
    });
    expect(
      rerun.filter(isTokenSelectorSyntheticRow).map((r) => r.$key),
    ).toEqual(syntheticRows.map((r) => r.$key));
    expect(isTokenSelectorSyntheticRow(ethUsdc)).toBe(false);
  });

  test('tokens without networkId fall into the other-networks section (defensive)', () => {
    const noNetworkToken = buildTestToken({ $key: 'no-network' });
    const rows = buildCrossNetworkSearchListData({
      tokens: [ethUsdc, noNetworkToken],
      currentNetworkId: CURRENT_NETWORK_ID,
    });
    expect(rowTypes(rows)).toEqual([
      ETokenSelectorSyntheticRowType.CurrentNetworkHeader,
      'eth-usdc',
      ETokenSelectorSyntheticRowType.OtherNetworksHeader,
      'no-network',
    ]);
  });
});

describe('extractCrossNetworkSearchQuery', () => {
  // Field values mirror packages/shared/src/config/presetNetworks.ts — in
  // particular Base carries symbol 'ETH', which is what makes "eth base"
  // resolvable (see the alias-collision test below).
  const networks = [
    {
      id: 'evm--1',
      name: 'Ethereum',
      symbol: 'ETH',
      code: 'eth',
      shortcode: 'eth',
      shortname: 'ETH',
    },
    {
      id: 'evm--8453',
      name: 'Base',
      symbol: 'ETH',
      code: 'base',
      shortcode: 'base',
      shortname: 'Base',
    },
    {
      id: 'tron--0x2b6653dc',
      name: 'Tron',
      symbol: 'TRX',
      code: 'trx',
      shortcode: 'trx',
      shortname: 'TRX',
    },
    {
      id: 'sol--101',
      name: 'Solana',
      symbol: 'SOL',
      code: 'sol',
      shortcode: 'sol',
      shortname: 'SOL',
    },
    {
      id: 'onekeyall--0',
      name: 'All Networks',
      code: 'onekeyall',
      shortcode: 'onekeyall',
      shortname: 'All Networks',
      isAllNetworks: true,
    },
  ] as IServerNetwork[];

  test('strips an exact network keyword and scopes to that network', () => {
    expect(
      extractCrossNetworkSearchQuery({ keywords: 'usdt trx', networks }),
    ).toEqual({ networkId: 'tron--0x2b6653dc', keywords: 'usdt' });
    expect(
      extractCrossNetworkSearchQuery({ keywords: 'sol bonk', networks }),
    ).toEqual({ networkId: 'sol--101', keywords: 'bonk' });
    expect(
      extractCrossNetworkSearchQuery({ keywords: 'usdt tron', networks }),
    ).toEqual({ networkId: 'tron--0x2b6653dc', keywords: 'usdt' });
  });

  test('single-word queries are never extracted', () => {
    expect(
      extractCrossNetworkSearchQuery({ keywords: 'trx', networks }),
    ).toEqual({ keywords: 'trx' });
    expect(
      extractCrossNetworkSearchQuery({ keywords: 'usdt', networks }),
    ).toEqual({ keywords: 'usdt' });
  });

  test('token/network alias collision resolves to the unambiguous network', () => {
    // "eth" names Ethereum but is also Ethereum's own symbol, so it is the
    // TOKEN term; "base" can only be a network (Base's symbol is ETH).
    expect(
      extractCrossNetworkSearchQuery({ keywords: 'eth base', networks }),
    ).toEqual({ networkId: 'evm--8453', keywords: 'eth' });
    // Same shape with the words reversed.
    expect(
      extractCrossNetworkSearchQuery({ keywords: 'base eth', networks }),
    ).toEqual({ networkId: 'evm--8453', keywords: 'eth' });
    // Two aliases of one network: the non-symbol one wins, the other stays as
    // the token term.
    expect(
      extractCrossNetworkSearchQuery({ keywords: 'tron trx', networks }),
    ).toEqual({ networkId: 'tron--0x2b6653dc', keywords: 'trx' });
  });

  test('no extraction when every network word is also a token symbol', () => {
    expect(
      extractCrossNetworkSearchQuery({ keywords: 'eth sol', networks }),
    ).toEqual({ keywords: 'eth sol' });
  });

  test('no extraction when stripping would leave nothing', () => {
    expect(
      extractCrossNetworkSearchQuery({ keywords: 'trx trx', networks }),
    ).toEqual({ keywords: 'trx trx' });
  });

  test('all-networks pseudo network never matches; partial words never match', () => {
    expect(
      extractCrossNetworkSearchQuery({ keywords: 'usdt onekeyall', networks }),
    ).toEqual({ keywords: 'usdt onekeyall' });
    expect(
      extractCrossNetworkSearchQuery({ keywords: 'usdt tro', networks }),
    ).toEqual({ keywords: 'usdt tro' });
  });

  test('case-insensitive and whitespace-tolerant', () => {
    expect(
      extractCrossNetworkSearchQuery({ keywords: '  USDT   TRX  ', networks }),
    ).toEqual({ networkId: 'tron--0x2b6653dc', keywords: 'usdt' });
  });
});
