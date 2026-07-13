/*
yarn test packages/shared/src/utils/tokenUtils.test.ts
*/
import { ENetworkStatus, type IServerNetwork } from '../../types';

import {
  buildSelectorTokenListFromResponses,
  buildTokenSearchKeywordQueries,
  calculateAccountTokensValue,
  calculateAccountTotalValue,
  flattenAggregateTokensMap,
  getFilteredTokenBySearchKey,
  mergeDeriveTokenListMap,
  nestAggregateTokensMap,
} from './tokenUtils';

import type {
  IAccountToken,
  IAggregateToken,
  IFetchAccountTokensResp,
  ITokenFiat,
} from '../../types/token';

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

  // Symbol/chain-name collision (ETH ≈ Ethereum, same for SOL/TRX/BNB/POL):
  // a single keyword hitting a sub's token fields AND its network at once is
  // NOT an explicit network qualifier — the aggregate row must stay grouped.
  const aggregateEth = buildTestToken({
    $key: 'aggregate_ETH_',
    address: 'aggregate_ETH_',
    networkId: 'aggregate',
    isAggregateToken: true,
    symbol: 'ETH',
    name: 'Ethereum',
    commonSymbol: 'ETH',
  });
  const ethereumEth = buildTestToken({
    $key: 'eth-native',
    address: '',
    networkId: 'evm--1',
    symbol: 'ETH',
    name: 'Ethereum',
    isNative: true,
  });
  const baseEth = buildTestToken({
    $key: 'base-native',
    address: '',
    networkId: 'evm--8453',
    symbol: 'ETH',
    name: 'Ethereum',
    isNative: true,
  });
  const ethAggregateTokenListMap = {
    [aggregateEth.$key]: {
      tokens: [ethereumEth, baseEth],
    },
  };

  test('keeps the aggregate grouped when a single keyword hits both the symbol and a chain name', () => {
    expect(
      getFilteredTokenBySearchKey({
        tokens: [aggregateEth],
        searchKey: 'eth',
        aggregateTokenListMap: ethAggregateTokenListMap,
        networksMap,
        enableNetworkSearch: true,
      }),
    ).toEqual([aggregateEth]);
  });

  test('still ungroups on an explicit network qualifier beyond the symbol match', () => {
    expect(
      getFilteredTokenBySearchKey({
        tokens: [aggregateEth],
        searchKey: 'eth base',
        aggregateTokenListMap: ethAggregateTokenListMap,
        networksMap,
        enableNetworkSearch: true,
      }),
    ).toEqual([baseEth]);
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

describe('buildSelectorTokenListFromResponses — token selector self-fetch merge', () => {
  const buildFiat = (fiatValue: string, balanceParsed = '1'): ITokenFiat => ({
    balance: balanceParsed,
    balanceParsed,
    fiatValue,
    price: 1,
    price24h: 0,
    currency: 'usd',
  });

  const buildResp = ({
    networkId,
    tokens,
    smallBalanceTokens = [],
    tokensMap = {},
    smallBalanceTokensMap = {},
    aggregateTokenMap,
  }: {
    networkId?: string;
    tokens: IAccountToken[];
    smallBalanceTokens?: IAccountToken[];
    tokensMap?: Record<string, ITokenFiat>;
    smallBalanceTokensMap?: Record<string, ITokenFiat>;
    aggregateTokenMap?: Record<string, ITokenFiat>;
  }): IFetchAccountTokensResp => ({
    networkId,
    tokens: { data: tokens, keys: '', map: tokensMap },
    smallBalanceTokens: {
      data: smallBalanceTokens,
      keys: '',
      map: smallBalanceTokensMap,
    },
    riskTokens: { data: [], keys: '', map: {} },
    aggregateTokenMap,
  });

  it('single response reproduces the legacy single-network selector shape', () => {
    const eth = buildTestToken({ $key: 'evm--1_0xeth', networkId: 'evm--1' });
    const dust = buildTestToken({ $key: 'evm--1_0xdust', networkId: 'evm--1' });
    const r = buildResp({
      networkId: 'evm--1',
      tokens: [eth],
      smallBalanceTokens: [dust],
      tokensMap: { 'evm--1_0xeth': buildFiat('3000') },
      smallBalanceTokensMap: { 'evm--1_0xdust': buildFiat('0.01') },
      aggregateTokenMap: { 'eth-agg': buildFiat('3000') },
    });

    const merged = buildSelectorTokenListFromResponses({ responses: [r] });

    expect(merged.tokens).toEqual([eth]);
    expect(merged.smallBalanceTokens).toEqual([dust]);
    expect(merged.tokenListMap).toEqual({
      'evm--1_0xeth': buildFiat('3000'),
      'evm--1_0xdust': buildFiat('0.01'),
    });
    expect(merged.aggregateTokenFiatMap['eth-agg'].fiatValue).toBe('3000');
  });

  it('multi-network responses concat sub-tokens and dedupe aggregate rows by $key', () => {
    const usdtAggEth = buildTestToken({
      $key: 'usdt-agg',
      symbol: 'USDT',
      isAggregateToken: true,
    });
    const usdtAggTron = buildTestToken({
      $key: 'usdt-agg',
      symbol: 'USDT',
      isAggregateToken: true,
    });
    const ethNative = buildTestToken({
      $key: 'evm--1_native',
      networkId: 'evm--1',
      isNative: true,
    });
    const trxNative = buildTestToken({
      $key: 'tron--0x2b6653dc_native',
      networkId: 'tron--0x2b6653dc',
      isNative: true,
    });

    const merged = buildSelectorTokenListFromResponses({
      responses: [
        buildResp({
          networkId: 'evm--1',
          tokens: [ethNative, usdtAggEth],
          tokensMap: { 'evm--1_native': buildFiat('3000') },
          aggregateTokenMap: { 'usdt-agg': buildFiat('100') },
        }),
        buildResp({
          networkId: 'tron--0x2b6653dc',
          tokens: [trxNative, usdtAggTron],
          tokensMap: { 'tron--0x2b6653dc_native': buildFiat('5000') },
          aggregateTokenMap: { 'usdt-agg': buildFiat('25') },
        }),
      ],
    });

    // The aggregate common row appears ONCE (first response wins); per-network
    // sub-token rows all survive.
    expect(merged.tokens.filter((t) => t.$key === 'usdt-agg')).toHaveLength(1);
    // Multi-network merge re-sorts by fiat value (network-grouped concat order
    // would be eth, usdt-agg, trx); the aggregate row sorts by its SUMMED fiat
    // (100 + 25 = 125).
    expect(merged.tokens.map((t) => t.$key)).toEqual([
      'tron--0x2b6653dc_native',
      'evm--1_native',
      'usdt-agg',
    ]);
    // Sub-token fiat maps union across networks.
    expect(Object.keys(merged.tokenListMap).toSorted()).toEqual([
      'evm--1_native',
      'tron--0x2b6653dc_native',
    ]);
    // Aggregate fiat sums across the per-network flat maps (home
    // `flattenAggregateTokensMapAtom` semantics).
    expect(merged.aggregateTokenFiatMap['usdt-agg'].fiatValue).toBe('125');
    expect(merged.aggregateTokenFiatMap['usdt-agg'].balanceParsed).toBe('2');
  });

  it('single response keeps the server-provided order verbatim (no re-sort)', () => {
    const lowValueFirst = buildTestToken({
      $key: 'evm--1_0xlow',
      networkId: 'evm--1',
    });
    const highValueSecond = buildTestToken({
      $key: 'evm--1_0xhigh',
      networkId: 'evm--1',
    });
    const merged = buildSelectorTokenListFromResponses({
      responses: [
        buildResp({
          networkId: 'evm--1',
          tokens: [lowValueFirst, highValueSecond],
          tokensMap: {
            'evm--1_0xlow': buildFiat('1'),
            'evm--1_0xhigh': buildFiat('9999'),
          },
        }),
      ],
    });

    expect(merged.tokens.map((t) => t.$key)).toEqual([
      'evm--1_0xlow',
      'evm--1_0xhigh',
    ]);
  });

  it('aggregate rows dedupe across tokens and smallBalanceTokens buckets', () => {
    const agg = buildTestToken({ $key: 'usdc-agg', isAggregateToken: true });
    const merged = buildSelectorTokenListFromResponses({
      responses: [
        buildResp({ networkId: 'evm--1', tokens: [agg] }),
        buildResp({
          networkId: 'evm--10',
          tokens: [],
          smallBalanceTokens: [agg],
        }),
      ],
    });

    expect(merged.tokens).toHaveLength(1);
    expect(merged.smallBalanceTokens).toHaveLength(0);
  });

  it('multi-network merge globally sorts across the high/low buckets (home parity)', () => {
    // Network A classifies a $5 asset as high-value; network B classifies a $50
    // asset as a small balance. The selector renders `tokens` ++
    // `smallBalanceTokens` verbatim, so a per-bucket sort would strand B's $50
    // BELOW A's $5. Home (`buildMergedAllNetworkSnapshot`) merges both buckets,
    // value-sorts once, then re-splits — the $50 must lead.
    const aHigh = buildTestToken({ $key: 'evm--1_0xa', networkId: 'evm--1' });
    const bSmall = buildTestToken({
      $key: 'evm--56_0xb',
      networkId: 'evm--56',
    });
    const merged = buildSelectorTokenListFromResponses({
      responses: [
        buildResp({
          networkId: 'evm--1',
          tokens: [aHigh],
          tokensMap: { 'evm--1_0xa': buildFiat('5') },
        }),
        buildResp({
          networkId: 'evm--56',
          tokens: [],
          smallBalanceTokens: [bSmall],
          smallBalanceTokensMap: { 'evm--56_0xb': buildFiat('50') },
        }),
      ],
    });

    // Combined display = tokens ++ smallBalanceTokens; the $50 small-balance row
    // now leads the $5 high-value row.
    expect(
      merged.tokens.concat(merged.smallBalanceTokens).map((t) => t.$key),
    ).toEqual(['evm--56_0xb', 'evm--1_0xa']);
  });

  it('multi-network merge pushes zero-balance rows to the tail by order', () => {
    // Two zero-value rows plus one priced row: the priced row leads, and the
    // two zero rows fall to the tail ordered by their `order` field (home
    // parity) rather than the network-grouped arrival order.
    const priced = buildTestToken({ $key: 'evm--1_0xp', networkId: 'evm--1' });
    const zeroLate = buildTestToken({
      $key: 'evm--1_0xz2',
      networkId: 'evm--1',
      order: 2,
    });
    const zeroEarly = buildTestToken({
      $key: 'evm--56_0xz1',
      networkId: 'evm--56',
      order: 1,
    });
    const merged = buildSelectorTokenListFromResponses({
      responses: [
        buildResp({
          networkId: 'evm--1',
          tokens: [priced, zeroLate],
          tokensMap: {
            'evm--1_0xp': buildFiat('10'),
            'evm--1_0xz2': buildFiat('0'),
          },
        }),
        buildResp({
          networkId: 'evm--56',
          tokens: [zeroEarly],
          tokensMap: { 'evm--56_0xz1': buildFiat('0') },
        }),
      ],
    });

    expect(
      merged.tokens.concat(merged.smallBalanceTokens).map((t) => t.$key),
    ).toEqual(['evm--1_0xp', 'evm--56_0xz1', 'evm--1_0xz2']);
  });

  it('all-networks raw member rows fold into ONE aggregate row via the config map', () => {
    const buildAggregateConfig = (params: {
      commonSymbol: string;
      order?: number;
    }) =>
      ({
        commonSymbol: params.commonSymbol,
        order: params.order ?? 1,
        name: params.commonSymbol,
        logoURI: '',
      }) as unknown as IAggregateToken;

    const ethUsdt = buildTestToken({
      $key: 'evm--1_usdt_key',
      address: '0xTetherAddr',
      networkId: 'evm--1',
      symbol: 'USDT',
      accountId: 'acc-eth',
      networkName: 'Ethereum',
    });
    const tronUsdt = buildTestToken({
      $key: 'tron_usdt_key',
      address: 'TUsdtAddr',
      networkId: 'tron--0x2b6653dc',
      symbol: 'USDT',
      accountId: 'acc-tron',
      networkName: 'Tron',
    });
    const ethNative = buildTestToken({
      $key: 'evm--1_native',
      networkId: 'evm--1',
      isNative: true,
    });

    const merged = buildSelectorTokenListFromResponses({
      responses: [
        buildResp({
          networkId: 'evm--1',
          tokens: [ethNative, ethUsdt],
          tokensMap: {
            'evm--1_native': buildFiat('10'),
            'evm--1_usdt_key': buildFiat('100'),
          },
        }),
        buildResp({
          networkId: 'tron--0x2b6653dc',
          tokens: [tronUsdt],
          tokensMap: { tron_usdt_key: buildFiat('25') },
        }),
      ],
      // Config keys are `${networkId}_${tokenAddress.toLowerCase()}`.
      aggregateTokenConfigMapRawData: {
        'evm--1_0xtetheraddr': buildAggregateConfig({ commonSymbol: 'USDT' }),
        'tron--0x2b6653dc_tusdtaddr': buildAggregateConfig({
          commonSymbol: 'USDT',
        }),
      },
    });

    // Member rows fold out of the list into ONE common row, sorted by the
    // SUMMED aggregate fiat (125 > 10).
    expect(merged.tokens.map((t) => t.$key)).toEqual([
      'aggregate_USDT_',
      'evm--1_native',
    ]);
    const aggregateRow = merged.tokens.find(
      (t) => t.$key === 'aggregate_USDT_',
    );
    expect(aggregateRow?.isAggregateToken).toBe(true);
    // Sub-token member list accumulates across networks (drives the
    // AggregateTokenSelector sub-page).
    expect(
      merged.aggregateTokenListMap.aggregate_USDT_.tokens.map((t) => t.$key),
    ).toEqual(['evm--1_usdt_key', 'tron_usdt_key']);
    // Aggregate fiat sums per-network member fiat; member fiat stays in the
    // flat map for checkIsOnlyOneTokenHasBalance.
    expect(merged.aggregateTokenFiatMap.aggregate_USDT_.fiatValue).toBe('125');
    expect(merged.tokenListMap['evm--1_usdt_key'].fiatValue).toBe('100');
  });

  it('single all-networks response still value-sorts client-folded aggregate rows', () => {
    // All-networks mode with exactly ONE enabled network: the fan-out yields a
    // single response, but folded aggregate common rows are appended after the
    // loop — they must re-sort by summed fiat instead of sinking to the tail.
    const ethUsdt = buildTestToken({
      $key: 'evm--1_usdt_key',
      address: '0xTetherAddr',
      networkId: 'evm--1',
      symbol: 'USDT',
      accountId: 'acc-eth',
      networkName: 'Ethereum',
    });
    const ethNative = buildTestToken({
      $key: 'evm--1_native',
      networkId: 'evm--1',
      isNative: true,
    });

    const merged = buildSelectorTokenListFromResponses({
      responses: [
        buildResp({
          networkId: 'evm--1',
          tokens: [ethNative, ethUsdt],
          tokensMap: {
            'evm--1_native': buildFiat('10'),
            'evm--1_usdt_key': buildFiat('100'),
          },
        }),
      ],
      aggregateTokenConfigMapRawData: {
        'evm--1_0xtetheraddr': {
          commonSymbol: 'USDT',
          order: 1,
          name: 'USDT',
          logoURI: '',
        } as unknown as IAggregateToken,
      },
    });

    // Without the re-sort the folded row would trail ethNative verbatim.
    expect(merged.tokens.map((t) => t.$key)).toEqual([
      'aggregate_USDT_',
      'evm--1_native',
    ]);
    expect(merged.aggregateTokenFiatMap.aggregate_USDT_.fiatValue).toBe('100');
  });

  it('single all-networks response globally re-splits a low-value folded aggregate across the high/low buckets', () => {
    // Regression: a client-folded aggregate common row is appended to the HIGH
    // bucket (`tokens`) after the loop regardless of its summed value. If the
    // single-response path only value-sorts WITHIN each bucket, a low-value
    // folded aggregate stays stranded in the high bucket ahead of a
    // higher-value small-balance token — and TokenListView renders
    // `tokens ++ smallBalanceTokens` as a plain concat, so it would show a
    // cheaper aggregate above a pricier asset. The fold case must fall through
    // to the global concat -> sort -> re-split (home's all-networks merge).
    const ethUsdt = buildTestToken({
      $key: 'evm--1_usdt_key',
      address: '0xTetherAddr',
      networkId: 'evm--1',
      symbol: 'USDT',
      accountId: 'acc-eth',
      networkName: 'Ethereum',
    });
    const ethDust = buildTestToken({
      $key: 'evm--1_0xdust',
      networkId: 'evm--1',
    });

    const merged = buildSelectorTokenListFromResponses({
      responses: [
        buildResp({
          networkId: 'evm--1',
          // Server split: the aggregate member sits in the HIGH bucket (fiat 5)
          // while a plain token worth 50 sits in the small-balance bucket — the
          // exact incoherence a client fold can leave behind.
          tokens: [ethUsdt],
          smallBalanceTokens: [ethDust],
          tokensMap: { 'evm--1_usdt_key': buildFiat('5') },
          smallBalanceTokensMap: { 'evm--1_0xdust': buildFiat('50') },
        }),
      ],
      aggregateTokenConfigMapRawData: {
        'evm--1_0xtetheraddr': {
          commonSymbol: 'USDT',
          order: 1,
          name: 'USDT',
          logoURI: '',
        } as unknown as IAggregateToken,
      },
    });

    // The RENDERED order (tokens ++ smallBalanceTokens) is globally fiat-desc:
    // the 50-value plain token precedes the 5-value folded aggregate.
    expect(
      [...merged.tokens, ...merged.smallBalanceTokens].map((t) => t.$key),
    ).toEqual(['evm--1_0xdust', 'aggregate_USDT_']);
    expect(merged.aggregateTokenFiatMap.aggregate_USDT_.fiatValue).toBe('5');
  });

  it('same-network derive-account responses merge into one group row (BTC-like)', () => {
    const taprootBtc = buildTestToken({
      $key: 'acct-1_taproot_btc--0',
      networkId: 'btc--0',
      symbol: 'BTC',
      isNative: true,
      mergeAssets: true,
    });
    const segwitBtc = buildTestToken({
      $key: 'acct-1_segwit_btc--0',
      networkId: 'btc--0',
      symbol: 'BTC',
      isNative: true,
      mergeAssets: true,
    });
    const ethNative = buildTestToken({
      $key: 'evm--1_native',
      networkId: 'evm--1',
      isNative: true,
    });

    const merged = buildSelectorTokenListFromResponses({
      responses: [
        buildResp({
          networkId: 'btc--0',
          tokens: [taprootBtc],
          tokensMap: { 'acct-1_taproot_btc--0': buildFiat('100') },
        }),
        buildResp({
          networkId: 'btc--0',
          tokens: [segwitBtc],
          tokensMap: { 'acct-1_segwit_btc--0': buildFiat('50') },
        }),
        buildResp({
          networkId: 'evm--1',
          tokens: [ethNative],
          tokensMap: { 'evm--1_native': buildFiat('10') },
        }),
      ],
    });

    // Both derive slices collapse into ONE row keyed by the `first_last`
    // group key; group fiat sums (150 > 10 so BTC sorts first).
    expect(merged.tokens.map((t) => t.$key)).toEqual([
      'acct-1_btc--0',
      'evm--1_native',
    ]);
    expect(merged.tokenListMap['acct-1_btc--0'].fiatValue).toBe('150');
  });

  it('single-response mergeAssets rows still rewrite to the home group `$key`', () => {
    // All-networks fan-out that yields exactly ONE response (one enabled
    // merge-derive network with a single derive account): the derive `$key`
    // rewrite must still run so the selector matches home. A count-based gate
    // (`responses.length > 1`) would skip it and leave `acct-1_taproot_btc--0`
    // instead of the grouped `acct-1_btc--0`.
    const taprootBtc = buildTestToken({
      $key: 'acct-1_taproot_btc--0',
      networkId: 'btc--0',
      symbol: 'BTC',
      isNative: true,
      mergeAssets: true,
    });

    const merged = buildSelectorTokenListFromResponses({
      responses: [
        buildResp({
          networkId: 'btc--0',
          tokens: [taprootBtc],
          tokensMap: { 'acct-1_taproot_btc--0': buildFiat('100') },
        }),
      ],
    });

    expect(merged.tokens.map((t) => t.$key)).toEqual(['acct-1_btc--0']);
    expect(merged.tokenListMap['acct-1_btc--0'].fiatValue).toBe('100');
  });

  it('responses without aggregateTokenMap or networkId yield an empty aggregate fiat map', () => {
    const merged = buildSelectorTokenListFromResponses({
      responses: [
        buildResp({
          tokens: [buildTestToken({ $key: 'evm--1_0xa', networkId: 'evm--1' })],
        }),
      ],
    });

    expect(merged.aggregateTokenFiatMap).toEqual({});
  });
});
