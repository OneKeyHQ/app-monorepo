import type {
  IAccountToken,
  IAggregateToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { buildNativeHomeAllNetworkPortfolioProjection } from './nativeHomeAllNetworkPortfolioProjection';

import type { INativeHomeAllNetworkTokenResponse } from './nativeHomeAllNetworkPortfolioProjection';

function buildFiat(fiatValue: string): ITokenFiat {
  return {
    balance: fiatValue === '0' ? '0' : '1',
    balanceParsed: fiatValue === '0' ? '0' : '1',
    currency: 'usd',
    fiatValue,
    price: 1,
  };
}

function buildToken(
  $key: string,
  symbol: string,
  networkId: string,
  overrides: Partial<IAccountToken> = {},
): IAccountToken {
  return {
    $key,
    address: '',
    decimals: 18,
    isNative: true,
    name: symbol,
    networkId,
    symbol,
    ...overrides,
  };
}

function buildResponse({
  accountId,
  networkId,
  tokens,
  fiatValues,
  mergeDeriveAssets = false,
  riskTokens = [],
}: {
  accountId: string;
  networkId: string;
  tokens: IAccountToken[];
  fiatValues: string[];
  mergeDeriveAssets?: boolean;
  riskTokens?: IAccountToken[];
}): INativeHomeAllNetworkTokenResponse {
  return {
    accountId,
    mergeDeriveAssets,
    networkId,
    tokens: {
      data: tokens,
      keys: tokens.map((token) => token.$key).join('_'),
      map: Object.fromEntries(
        tokens.map((token, index) => [
          token.$key,
          buildFiat(fiatValues[index] ?? '0'),
        ]),
      ),
    },
    smallBalanceTokens: { data: [], keys: '', map: {} },
    riskTokens: {
      data: riskTokens,
      keys: riskTokens.map((token) => token.$key).join('_'),
      map: Object.fromEntries(
        riskTokens.map((token) => [token.$key, buildFiat('1')]),
      ),
    },
  };
}

function buildAggregateConfig(commonSymbol: string, order: number) {
  return {
    commonSymbol,
    logoURI: '',
    name: commonSymbol,
    order,
  } as unknown as IAggregateToken;
}

describe('buildNativeHomeAllNetworkPortfolioProjection', () => {
  it('matches the Legacy rows projection for derive BTC and aggregate defaults', () => {
    const btcTaproot = buildToken('btc--0_taproot_native', 'BTC', 'btc--0', {
      mergeAssets: true,
    });
    const btcSegwit = buildToken('btc--0_segwit_native', 'BTC', 'btc--0', {
      mergeAssets: true,
    });
    const usdt = buildToken('evm--1_usdt', 'USDT', 'evm--1', {
      address: '0xUSDT',
      isNative: false,
    });
    const usdc = buildToken('evm--1_usdc', 'USDC', 'evm--1', {
      address: '0xUSDC',
      isNative: false,
    });
    const eth = buildToken('evm--1_native', 'ETH', 'evm--1');
    const sol = buildToken('sol--101_native', 'SOL', 'sol--101');
    const bnb = buildToken('evm--56_native', 'BNB', 'evm--56');

    const projection = buildNativeHomeAllNetworkPortfolioProjection({
      responses: [
        buildResponse({
          accountId: 'btc-taproot',
          networkId: 'btc--0',
          tokens: [btcTaproot],
          fiatValues: ['100'],
          mergeDeriveAssets: true,
        }),
        buildResponse({
          accountId: 'btc-segwit',
          networkId: 'btc--0',
          tokens: [btcSegwit],
          fiatValues: ['50'],
          mergeDeriveAssets: true,
        }),
        buildResponse({
          accountId: 'evm-account',
          networkId: 'evm--1',
          tokens: [usdt, usdc, eth],
          fiatValues: ['120', '110', '90'],
        }),
        buildResponse({
          accountId: 'sol-account',
          networkId: 'sol--101',
          tokens: [sol],
          fiatValues: ['80'],
        }),
        buildResponse({
          accountId: 'bnb-account',
          networkId: 'evm--56',
          tokens: [bnb],
          fiatValues: ['70'],
        }),
      ],
      aggregateTokenConfigMapRawData: {
        'btc--0_': buildAggregateConfig('BTC', 1),
        'evm--1_0xusdt': buildAggregateConfig('USDT', 2),
        'evm--1_0xusdc': buildAggregateConfig('USDC', 3),
        'evm--1_': buildAggregateConfig('ETH', 4),
        'sol--101_': buildAggregateConfig('SOL', 5),
        'evm--56_': buildAggregateConfig('BNB', 6),
      },
    });

    expect(projection.tokens.map((token) => token.symbol)).toEqual([
      'BTC',
      'USDT',
      'USDC',
      'ETH',
      'SOL',
      'BNB',
    ]);
    expect(
      projection.tokens.filter((token) => token.symbol === 'BTC'),
    ).toHaveLength(1);
    expect(projection.map.aggregate_BTC_?.fiatValue).toBe('150');
    expect(Object.keys(projection.map)).toEqual(
      projection.tokens.map((token) => token.$key),
    );
  });

  it('dedupes only canonical keys and keeps distinct owner identities', () => {
    const first = buildToken('custom-owner-1', 'CUSTOM', 'evm--1', {
      address: '0xCustom',
      isNative: false,
    });
    const second = buildToken('custom-owner-2', 'CUSTOM', 'evm--1', {
      address: '0xCustom',
      isNative: false,
    });

    const projection = buildNativeHomeAllNetworkPortfolioProjection({
      responses: [
        buildResponse({
          accountId: 'owner-1',
          networkId: 'evm--1',
          tokens: [first, second],
          fiatValues: ['2', '1'],
        }),
        buildResponse({
          accountId: 'owner-duplicate',
          networkId: 'evm--1',
          tokens: [first],
          fiatValues: ['2'],
        }),
      ],
    });

    expect(projection.tokens.map((token) => token.$key)).toEqual([
      'custom-owner-1',
      'custom-owner-2',
    ]);
  });

  it('uses the per-network merge flag for the first progressive response', () => {
    const firstBtc = buildToken('btc--0_taproot_native', 'BTC', 'btc--0', {
      mergeAssets: true,
    });
    const projection = buildNativeHomeAllNetworkPortfolioProjection({
      responses: [
        buildResponse({
          accountId: 'btc-taproot',
          networkId: 'btc--0',
          tokens: [firstBtc],
          fiatValues: ['100'],
          mergeDeriveAssets: true,
        }),
      ],
    });

    expect(projection.tokens.map((token) => token.$key)).toEqual([
      'btc--0_native',
    ]);
  });

  it('does not merge a row that lacks the row-level merge marker', () => {
    const unmarked = buildToken('btc--0_taproot_custom', 'CUSTOM', 'btc--0', {
      isNative: false,
      mergeAssets: false,
    });
    const projection = buildNativeHomeAllNetworkPortfolioProjection({
      responses: [
        buildResponse({
          accountId: 'btc-taproot',
          networkId: 'btc--0',
          tokens: [unmarked],
          fiatValues: ['1'],
          mergeDeriveAssets: true,
        }),
      ],
    });

    expect(projection.tokens.map((token) => token.$key)).toEqual([
      'btc--0_taproot_custom',
    ]);
  });

  it('keeps non-merge risk identities and merges risk only when configured', () => {
    const riskTaproot = buildToken('btc--0_taproot_risk', 'RISK', 'btc--0', {
      isNative: false,
      mergeAssets: true,
    });
    const riskSegwit = buildToken('btc--0_segwit_risk', 'RISK', 'btc--0', {
      isNative: false,
      mergeAssets: true,
    });
    const buildRiskResponses = (mergeDeriveAssets: boolean) => [
      buildResponse({
        accountId: 'btc-taproot',
        networkId: 'btc--0',
        tokens: [],
        fiatValues: [],
        riskTokens: [riskTaproot],
        mergeDeriveAssets,
      }),
      buildResponse({
        accountId: 'btc-segwit',
        networkId: 'btc--0',
        tokens: [],
        fiatValues: [],
        riskTokens: [riskSegwit],
        mergeDeriveAssets,
      }),
    ];

    const unmerged = buildNativeHomeAllNetworkPortfolioProjection({
      responses: buildRiskResponses(false),
    });
    expect(unmerged.riskTokens.map((token) => token.$key)).toEqual([
      'btc--0_taproot_risk',
      'btc--0_segwit_risk',
    ]);

    const merged = buildNativeHomeAllNetworkPortfolioProjection({
      responses: buildRiskResponses(true),
    });
    expect(merged.riskTokens.map((token) => token.$key)).toEqual([
      'btc--0_risk',
    ]);
    expect(merged.riskMap['btc--0_risk']?.fiatValue).toBe('2');
  });

  it('keeps high, small-balance, and risk maps scoped to their rows', () => {
    const high = buildToken('high', 'HIGH', 'evm--1');
    const small = buildToken('small', 'SMALL', 'evm--1');
    const risk = buildToken('risk', 'RISK', 'evm--1', {
      isNative: false,
    });
    const response = buildResponse({
      accountId: 'account',
      networkId: 'evm--1',
      tokens: [high],
      fiatValues: ['10'],
      riskTokens: [risk],
    });
    response.smallBalanceTokens = {
      data: [small],
      keys: small.$key,
      map: { [small.$key]: buildFiat('0.1') },
    };

    const projection = buildNativeHomeAllNetworkPortfolioProjection({
      responses: [response],
    });

    expect(Object.keys(projection.map)).toEqual(['high']);
    expect(Object.keys(projection.smallBalanceMap)).toEqual(['small']);
    expect(Object.keys(projection.riskMap)).toEqual(['risk']);
  });
});
