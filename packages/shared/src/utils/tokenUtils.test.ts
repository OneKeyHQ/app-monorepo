/*
yarn test packages/shared/src/utils/tokenUtils.test.ts
*/
import { ENetworkStatus, type IServerNetwork } from '../../types';

import {
  buildTokenSearchKeywordQueries,
  calculateAccountTokensValue,
  calculateAccountTotalValue,
  flattenAggregateTokensMap,
  getFilteredTokenBySearchKey,
  mergeDeriveTokenListMap,
  nestAggregateTokensMap,
} from './tokenUtils';

import type { IAccountToken, ITokenFiat } from '../../types/token';

describe('buildTokenSearchKeywordQueries', () => {
  test('adds ether fallback for multi-word eth network searches', () => {
    expect(buildTokenSearchKeywordQueries('shib eth')).toEqual([
      'shib eth',
      'shib ether',
    ]);
  });

  test('does not expand single eth searches or embedded eth token names', () => {
    expect(buildTokenSearchKeywordQueries('eth')).toEqual(['eth']);
    expect(buildTokenSearchKeywordQueries('weth')).toEqual(['weth']);
    expect(buildTokenSearchKeywordQueries('shib ethw')).toEqual(['shib ethw']);
  });
});

function buildTestNetwork({
  id,
  name,
  code,
  shortname,
}: {
  id: string;
  name: string;
  code: string;
  shortname: string;
}): IServerNetwork {
  return {
    id,
    impl: code,
    chainId: id,
    name,
    code,
    shortname,
    shortcode: shortname,
    symbol: code.toUpperCase(),
    logoURI: '',
    decimals: 18,
    feeMeta: {
      symbol: code.toUpperCase(),
      decimals: 18,
    },
    defaultEnabled: true,
    status: ENetworkStatus.LISTED,
    isTestnet: false,
  };
}

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

describe('getFilteredTokenBySearchKey — aggregate token network search', () => {
  const aggregateUsdc = buildTestToken({
    $key: 'aggregate_USDC_',
    address: 'aggregate_USDC_',
    networkId: 'aggregate',
    isAggregateToken: true,
    commonSymbol: 'USDC',
  });
  const ethereumUsdc = buildTestToken({
    $key: 'eth-usdc',
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    networkId: 'evm--1',
  });
  const baseUsdc = buildTestToken({
    $key: 'base-usdc',
    address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    networkId: 'evm--8453',
  });
  const aggregateTokenListMap = {
    [aggregateUsdc.$key]: {
      tokens: [ethereumUsdc, baseUsdc],
    },
  };
  const networksMap = {
    'evm--1': buildTestNetwork({
      id: 'evm--1',
      name: 'Ethereum',
      code: 'eth',
      shortname: 'ETH',
    }),
    'evm--8453': buildTestNetwork({
      id: 'evm--8453',
      name: 'Base',
      code: 'base',
      shortname: 'Base',
    }),
  };

  test('keeps symbol-only aggregate token search grouped', () => {
    expect(
      getFilteredTokenBySearchKey({
        tokens: [aggregateUsdc],
        searchKey: 'usdc',
        aggregateTokenListMap,
        networksMap,
        enableNetworkSearch: true,
      }),
    ).toEqual([aggregateUsdc]);
  });

  test('returns the network-specific token when search includes token and network keywords', () => {
    expect(
      getFilteredTokenBySearchKey({
        tokens: [aggregateUsdc],
        searchKey: 'usdc eth',
        aggregateTokenListMap,
        networksMap,
        enableNetworkSearch: true,
      }),
    ).toEqual([ethereumUsdc]);
  });
});

describe('calculateAccountTotalValue — tray case (no filters)', () => {
  test('sums all token values + deFi when no filters passed', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: {
          'acct-1_evm--1': '100',
          'acct-1_evm--56': '50',
        },
        deFiNetWorth: 25,
      }),
    ).toBe('175');
  });

  test('handles string tokensValue + deFi', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: '100',
        deFiNetWorth: '25.5',
      }),
    ).toBe('125.5');
  });

  test('returns undefined when both inputs absent', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: undefined,
        deFiNetWorth: undefined,
      }),
    ).toBeUndefined();
  });

  test('tokens-only when deFi is 0 / undefined', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: '100',
        deFiNetWorth: 0,
      }),
    ).toBe('100');
    expect(
      calculateAccountTotalValue({
        tokensValue: '100',
        deFiNetWorth: undefined,
      }),
    ).toBe('100');
  });
});

describe('calculateAccountTotalValue — single network (accountId + networkId)', () => {
  test('picks the specific networkId entry + deFi for that network', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: {
          'acct-1_evm--1': '100',
          'acct-1_evm--56': '50',
        },
        deFiNetWorth: 25,
        accountId: 'acct-1',
        networkId: 'evm--1',
      }),
    ).toBe('125');
  });

  test('returns undefined when both the picked token entry and deFi are absent', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: { 'other-acct_evm--1': '100' },
        deFiNetWorth: undefined,
        accountId: 'acct-1',
        networkId: 'evm--1',
      }),
    ).toBeUndefined();
  });

  test('returns deFi only when token entry absent but deFi present', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: { 'other-acct_evm--1': '100' },
        deFiNetWorth: 25,
        accountId: 'acct-1',
        networkId: 'evm--1',
      }),
    ).toBe('25');
  });
});

describe('calculateAccountTotalValue — mergeDeriveAssetsEnabled branch', () => {
  test('sums entries whose key suffix matches networkId; does NOT add deFi', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: {
          'x_taproot_btc--0': '10',
          'x_segwit_btc--0': '20',
          'x_legacy_btc--0': '30',
          'x_default_evm--1': '1000',
        },
        deFiNetWorth: 999, // ignored by merge-derive branch
        mergeDeriveAssetsEnabled: true,
        networkId: 'btc--0',
      }),
    ).toBe('60');
  });

  test('returns undefined when no entry matches and deFi absent', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: { 'x_default_evm--1': '1000' },
        deFiNetWorth: undefined,
        mergeDeriveAssetsEnabled: true,
        networkId: 'btc--0',
      }),
    ).toBeUndefined();
  });

  test('returns undefined when no entry matches even if deFiNetWorth is explicit 0', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: { 'x_default_evm--1': '1000' },
        deFiNetWorth: 0, // explicit 0, not undefined
        mergeDeriveAssetsEnabled: true,
        networkId: 'btc--0',
      }),
    ).toBeUndefined();
  });
});

describe('calculateAccountTotalValue — wallet-scoped derive matching branch', () => {
  const enabled = [{ id: 'evm--1' }, { id: 'evm--56' }];
  const networkInfoMap = {
    'evm--1': { deriveType: 'default', mergeDeriveAssetsEnabled: false },
    'evm--56': { deriveType: 'default', mergeDeriveAssetsEnabled: false },
  };

  test('sums only entries matching walletId + compatible network + deriveType, plus deFi', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: {
          // matches: hd-1, evm--1, default
          'hd-1--path--default_evm--1': '100',
          // matches: hd-1, evm--56, default
          'hd-1--path--default_evm--56': '50',
          // wrong wallet
          'hd-2--path--default_evm--1': '9999',
          // incompatible network
          'hd-1--path--default_sol--101': '9999',
          // wrong deriveType (BIP86 is in allowlist but networkInfo expects 'default')
          'hd-1--path--BIP86_evm--1': '9999',
        },
        deFiNetWorth: 25,
        walletId: 'hd-1',
        enabledNetworksCompatibleWithWalletId: enabled,
        networkInfoMap,
      }),
    ).toBe('175');
  });

  test('resolves idSuffix via suffixToDeriveType when normalizeDeriveType fails (Kaspa KaspaOrg → kaspaOfficial)', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: {
          "hd-1--m/44'/111111'/0'/0/0--KaspaOrg_kaspa--kaspa": '38',
        },
        deFiNetWorth: 0,
        walletId: 'hd-1',
        enabledNetworksCompatibleWithWalletId: [{ id: 'kaspa--kaspa' }],
        networkInfoMap: {
          'kaspa--kaspa': {
            deriveType: 'kaspaOfficial',
            mergeDeriveAssetsEnabled: false,
            // cspell:ignore kaspaorg
            suffixToDeriveType: { kaspaorg: 'kaspaOfficial' },
          },
        },
      }),
    ).toBe('38');
  });

  test('normalizes unknown deriveType to "default" per allowlist (regression: AccountValue parity)', () => {
    // Original AccountValue.tsx used accountUtils.normalizeDeriveType(_deriveType) ?? 'default'.
    // normalizeDeriveType validates against an allowlist and returns undefined for unknown values,
    // which then falls back to 'default'. Without this normalization, garbage deriveType strings
    // would silently exclude entries that the original behavior included.
    expect(
      calculateAccountTotalValue({
        tokensValue: {
          // Key has unknown deriveType "garbage" — must normalize to "default" to match networkInfo
          'hd-1--path--garbage_evm--1': '100',
        },
        deFiNetWorth: 0,
        walletId: 'hd-1',
        enabledNetworksCompatibleWithWalletId: [{ id: 'evm--1' }],
        networkInfoMap: {
          'evm--1': { deriveType: 'default', mergeDeriveAssetsEnabled: false },
        },
      }),
    ).toBe('100');
  });
});

describe('calculateAccountTokensValue', () => {
  const baseWorthMeta = {
    createAtNetworkWorth: '0',
    accountId: 'acct-1',
    initialized: true,
  };

  test('All Networks: sums all map entries', () => {
    expect(
      calculateAccountTokensValue({
        accountId: 'acct-1',
        networkId: 'onekeyall--0',
        tokensWorth: {
          ...baseWorthMeta,
          worth: {
            'acct-1_evm--1': '100',
            'acct-1_evm--195': '0',
            'acct-1_evm--56': '50',
          },
        },
        mergeDeriveAssetsEnabled: false,
      }),
    ).toBe('150');
  });

  test('All Networks: returns "0" when worth is empty', () => {
    expect(
      calculateAccountTokensValue({
        accountId: 'acct-1',
        networkId: 'onekeyall--0',
        tokensWorth: {
          ...baseWorthMeta,
          worth: {},
        },
        mergeDeriveAssetsEnabled: false,
      }),
    ).toBe('0');
  });

  test('Single network: returns the value at the current network key', () => {
    expect(
      calculateAccountTokensValue({
        accountId: 'acct-1',
        networkId: 'evm--1',
        tokensWorth: {
          ...baseWorthMeta,
          worth: {
            'acct-1_evm--1': '42.5',
          },
        },
        mergeDeriveAssetsEnabled: false,
      }),
    ).toBe('42.5');
  });

  test('Single network: falls back to the first map value when current key is absent', () => {
    expect(
      calculateAccountTokensValue({
        accountId: 'acct-1',
        networkId: 'evm--195',
        tokensWorth: {
          ...baseWorthMeta,
          worth: {
            'acct-1_evm--1': '100',
          },
        },
        mergeDeriveAssetsEnabled: false,
      }),
    ).toBe('100');
  });

  test('mergeDeriveAssetsEnabled: sums all derive-keyed entries', () => {
    expect(
      calculateAccountTokensValue({
        accountId: 'acct-1',
        networkId: 'evm--1',
        tokensWorth: {
          ...baseWorthMeta,
          worth: {
            'acct-1_evm--1--default': '100',
            'acct-1_evm--1--ledgerlive': '25',
          },
        },
        mergeDeriveAssetsEnabled: true,
      }),
    ).toBe('125');
  });
});

describe('mergeDeriveTokenListMap — fiatValue unavailable handling', () => {
  const buildEntry = (fiatValue: string | null | undefined) => ({
    balance: '0',
    balanceParsed: '0',
    fiatValue,
    price: '0',
    price24h: '0',
  });

  test('keeps fiatValue unavailable when every derive participant is unavailable', () => {
    const targetMap = {
      // groupDeriveKey shape: `${prefix}_${suffix}` (first and last segments).
      'acct-1_evm--1': buildEntry(null) as any,
    };
    const sourceMap = {
      'acct-1_default_evm--1': buildEntry(undefined) as any,
    };

    const merged = mergeDeriveTokenListMap({
      sourceMap,
      targetMap,
      mergeDeriveAssets: true,
    });

    // fiatValue must remain unavailable (not written as '0') so the display
    // layer keeps rendering '--' instead of a misleading $0.
    expect(merged['acct-1_evm--1'].fiatValue).toBeNull();
  });

  test('writes partial sum when at least one derive participant is valid', () => {
    const targetMap = {
      'acct-1_evm--1': buildEntry(null) as any,
    };
    const sourceMap = {
      'acct-1_default_evm--1': buildEntry('12.5') as any,
    };

    const merged = mergeDeriveTokenListMap({
      sourceMap,
      targetMap,
      mergeDeriveAssets: true,
    });

    expect(merged['acct-1_evm--1'].fiatValue).toBe('12.5');
  });
});

describe('nest+flatten aggregateTokenMap — token selector seam (PR-6)', () => {
  // The token-selector self-fetch returns a FLAT per-network `aggregateTokenMap`
  // ($key -> ITokenFiat). The selector reproduces the home semantics by nesting
  // the response (keyed by networkId) then re-flattening, so the aggregate
  // ($key) row resolves the SAME summed fiat the home
  // `flattenAggregateTokensMapAtom` leaf reads.
  it('single-network response yields the aggregate $key fiat the leaf reads', () => {
    const responseAggregateTokenMap: Record<string, ITokenFiat> = {
      'eth-agg': {
        balance: '1000000000000000000',
        balanceParsed: '1',
        fiatValue: '3000',
        price: 3000,
        price24h: 1.5,
        currency: 'usd',
      },
    };

    const flattened = flattenAggregateTokensMap(
      nestAggregateTokensMap({
        aggregateTokenMap: responseAggregateTokenMap,
        networkId: 'evm--1',
      }),
    );

    expect(flattened['eth-agg']).toBeDefined();
    expect(flattened['eth-agg'].balanceParsed).toBe('1');
    expect(flattened['eth-agg'].fiatValue).toBe('3000');
    expect(flattened['eth-agg'].price).toBe(3000);
    expect(flattened['eth-agg'].price24h).toBe(1.5);
    expect(flattened['eth-agg'].currency).toBe('usd');
  });

  it('empty response flattens to an empty map (selector reset path)', () => {
    expect(
      flattenAggregateTokensMap(
        nestAggregateTokensMap({
          aggregateTokenMap: {},
          networkId: 'evm--1',
        }),
      ),
    ).toEqual({});
  });
});
