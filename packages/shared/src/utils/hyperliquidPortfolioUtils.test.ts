import { EHyperLiquidAbstractionMode } from '../../types/hyperliquid';
import {
  PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS,
  PERPS_HL_PORTFOLIO_SNAPSHOT_MAX_AGE_MS,
} from '../consts/perpCache';

import {
  aggregateClearinghouseStates,
  assembleHyperliquidSnapshot,
  buildSpotPriceMap,
  getActivePerpAssetPositions,
  getActivePerpPositionsUnrealizedPnl,
  isHyperliquidPortfolioSnapshotFresh,
  isUnifiedPortfolioMode,
  spotBalancesNeedPriceRefresh,
  spotHasPositiveBalance,
  spotNeedsPrices,
} from './hyperliquidPortfolioUtils';

import type {
  IHyperliquidPerpPositionSnapshot,
  IHyperliquidSpotBalanceSnapshot,
} from '../../types/hyperliquid/portfolio';

const meta = {
  universe: [
    { tokens: [1, 0], name: 'PURR/USDC', index: 0, isCanonical: true },
    { tokens: [2, 0], name: '@5', index: 5, isCanonical: false },
  ],
  tokens: [
    {
      name: 'USDC',
      index: 0,
      szDecimals: 2,
      weiDecimals: 8,
      tokenId: '0x0',
      isCanonical: true,
      evmContract: null,
      fullName: null,
      deployerTradingFeeShare: '0',
    },
    {
      name: 'PURR',
      index: 1,
      szDecimals: 2,
      weiDecimals: 8,
      tokenId: '0x1',
      isCanonical: true,
      evmContract: null,
      fullName: null,
      deployerTradingFeeShare: '0',
    },
    {
      name: 'HYPE',
      index: 2,
      szDecimals: 2,
      weiDecimals: 8,
      tokenId: '0x2',
      isCanonical: true,
      evmContract: null,
      fullName: null,
      deployerTradingFeeShare: '0',
    },
  ],
};
const ctxs = [
  {
    coin: 'PURR/USDC',
    markPx: '0.5',
    midPx: '0.5',
    prevDayPx: '0.4',
    dayNtlVlm: '0',
    circulatingSupply: '0',
    totalSupply: '0',
    dayBaseVlm: '0',
  },
  {
    coin: '@5',
    markPx: '30',
    midPx: '30',
    prevDayPx: '29',
    dayNtlVlm: '0',
    circulatingSupply: '0',
    totalSupply: '0',
    dayBaseVlm: '0',
  },
];

describe('buildSpotPriceMap', () => {
  it('maps base coin -> usd, USDC=1', () => {
    const m = buildSpotPriceMap([meta, ctxs] as any);
    expect(m.USDC).toBe('1');
    expect(m.PURR).toBe('0.5');
    expect(m.HYPE).toBe('30');
  });
  it('ignores non-finite / non-positive markPx', () => {
    const bad = [
      { ...ctxs[0], markPx: '0' },
      { ...ctxs[1], markPx: 'NaN' },
    ];
    const m = buildSpotPriceMap([meta, bad] as any);
    expect(m.USDC).toBe('1');
    expect(m.PURR).toBeUndefined();
    expect(m.HYPE).toBeUndefined();
  });
  it('does not treat token/token markPx as USD', () => {
    const tokenQuotedMeta = {
      ...meta,
      universe: [
        { tokens: [1, 2], name: 'PURR/HYPE', index: 7, isCanonical: true },
      ],
    };
    const tokenQuotedCtxs = [
      {
        coin: 'PURR/HYPE',
        markPx: '2',
        midPx: '2',
        prevDayPx: '1.8',
        dayNtlVlm: '0',
        circulatingSupply: '0',
        totalSupply: '0',
        dayBaseVlm: '0',
      },
    ];
    const m = buildSpotPriceMap([tokenQuotedMeta, tokenQuotedCtxs] as any);
    expect(m.USDC).toBe('1');
    expect(m.PURR).toBeUndefined();
  });
});

describe('spotBalancesNeedPriceRefresh', () => {
  it('only treats non-stable positive spot balances as active', () => {
    expect(
      spotBalancesNeedPriceRefresh([
        {
          coin: 'USDC',
          token: 0,
          total: '100',
          hold: '0',
          entryNtl: '0',
          priceUsd: '1',
          valueUsd: '100',
        },
        {
          coin: 'USDT',
          token: 3,
          total: '10',
          hold: '0',
          entryNtl: '0',
          priceUsd: '1',
          valueUsd: '10',
        },
      ]),
    ).toBe(false);
    expect(
      spotBalancesNeedPriceRefresh([
        {
          coin: 'HYPE',
          token: 2,
          total: '0',
          hold: '0',
          entryNtl: '0',
          priceUsd: '30',
          valueUsd: '0',
        },
      ]),
    ).toBe(false);
    expect(
      spotBalancesNeedPriceRefresh([
        {
          coin: 'HYPE',
          token: 2,
          total: '3',
          hold: '0',
          entryNtl: '0',
          priceUsd: '30',
          valueUsd: '90',
        },
      ]),
    ).toBe(true);
  });
});

describe('spotNeedsPrices', () => {
  it('false for only-USDC/empty, true for non-USDC>0', () => {
    expect(
      spotNeedsPrices({
        balances: [
          { coin: 'USDC', token: 0, total: '100', hold: '0', entryNtl: '0' },
        ],
      } as any),
    ).toBe(false);
    expect(spotNeedsPrices({ balances: [] } as any)).toBe(false);
    expect(
      spotNeedsPrices({
        balances: [
          { coin: 'USDT', token: 3, total: '100', hold: '0', entryNtl: '0' },
        ],
      } as any),
    ).toBe(false);
    expect(
      spotNeedsPrices({
        balances: [
          { coin: 'HYPE', token: 2, total: '3', hold: '0', entryNtl: '0' },
        ],
      } as any),
    ).toBe(true);
  });
});

describe('spotHasPositiveBalance', () => {
  it('tracks stablecoin-only balances that still need universe mapping', () => {
    expect(
      spotHasPositiveBalance({
        balances: [
          { coin: 'USDT', token: 3, total: '100', hold: '0', entryNtl: '0' },
        ],
      } as any),
    ).toBe(true);
    expect(
      spotHasPositiveBalance({
        balances: [
          { coin: 'USDB', token: 4, total: '0', hold: '0', entryNtl: '0' },
        ],
      } as any),
    ).toBe(false);
    expect(spotHasPositiveBalance({ balances: [] } as any)).toBe(false);
  });
});

describe('isUnifiedPortfolioMode', () => {
  it('only treats unified and portfolio margin as unified portfolio modes', () => {
    expect(
      isUnifiedPortfolioMode(EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT),
    ).toBe(true);
    expect(
      isUnifiedPortfolioMode(EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN),
    ).toBe(true);
    expect(isUnifiedPortfolioMode(EHyperLiquidAbstractionMode.DEFAULT)).toBe(
      false,
    );
    expect(isUnifiedPortfolioMode(EHyperLiquidAbstractionMode.DISABLED)).toBe(
      false,
    );
    expect(isUnifiedPortfolioMode(undefined)).toBe(false);
  });
});

describe('isHyperliquidPortfolioSnapshotFresh', () => {
  const perpPosition: IHyperliquidPerpPositionSnapshot = {
    coin: 'ETH',
    szi: '1',
    entryPx: '1000',
    positionValue: '1100',
    unrealizedPnl: '100',
    returnOnEquity: '0.1',
    liquidationPx: null,
    marginUsed: '100',
    leverageType: 'cross',
    leverageValue: 10,
    cumFundingSinceOpen: '0',
  };
  const nonStableSpotBalance: IHyperliquidSpotBalanceSnapshot = {
    coin: 'HYPE',
    token: 2,
    total: '1',
    hold: '0',
    entryNtl: '1',
    priceUsd: '1',
    valueUsd: '1',
  };

  const buildSnapshot = ({
    fetchedAt,
    hasPerp = false,
    hasNonStableSpot = false,
    isDegraded = false,
  }: {
    fetchedAt: number;
    hasPerp?: boolean;
    hasNonStableSpot?: boolean;
    isDegraded?: boolean;
  }) => ({
    fetchedAt,
    isDegraded,
    perpPositions: hasPerp ? [perpPosition] : [],
    spotBalances: hasNonStableSpot ? [nonStableSpotBalance] : [],
  });

  it('uses active max age for marked-to-market snapshots', () => {
    const now = 10_000_000;
    expect(
      isHyperliquidPortfolioSnapshotFresh(
        buildSnapshot({
          fetchedAt: now - PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS,
          hasPerp: true,
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isHyperliquidPortfolioSnapshotFresh(
        buildSnapshot({
          fetchedAt: now - PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS - 1,
          hasNonStableSpot: true,
        }),
        now,
      ),
    ).toBe(false);
  });

  it('uses idle max age for empty or stable-only snapshots', () => {
    const now = 10_000_000;
    expect(
      isHyperliquidPortfolioSnapshotFresh(
        buildSnapshot({
          fetchedAt: now - PERPS_HL_PORTFOLIO_SNAPSHOT_MAX_AGE_MS,
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isHyperliquidPortfolioSnapshotFresh(
        buildSnapshot({
          fetchedAt: now - PERPS_HL_PORTFOLIO_SNAPSHOT_MAX_AGE_MS - 1,
        }),
        now,
      ),
    ).toBe(false);
  });

  it('uses active max age for degraded snapshots', () => {
    const now = 10_000_000;
    expect(
      isHyperliquidPortfolioSnapshotFresh(
        buildSnapshot({
          fetchedAt: now - PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS,
          isDegraded: true,
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isHyperliquidPortfolioSnapshotFresh(
        buildSnapshot({
          fetchedAt: now - PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS - 1,
          isDegraded: true,
        }),
        now,
      ),
    ).toBe(false);
  });
});

describe('aggregateClearinghouseStates', () => {
  const buildPosition = (coin: string, unrealizedPnl: string) => ({
    type: 'oneWay',
    position: {
      coin,
      szi: '1',
      entryPx: '10',
      positionValue: '12',
      unrealizedPnl,
      returnOnEquity: '0.1',
      liquidationPx: null,
      marginUsed: '5',
      maxLeverage: 10,
      leverage: { type: 'cross', value: 5 },
      cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
    },
  });

  it('aggregates account summaries and prefixes sub-dex positions', () => {
    const main = {
      marginSummary: {
        accountValue: '100',
        totalNtlPos: '50',
        totalRawUsd: '100',
        totalMarginUsed: '10',
      },
      crossMarginSummary: {
        accountValue: '80',
        totalNtlPos: '40',
        totalRawUsd: '80',
        totalMarginUsed: '8',
      },
      crossMaintenanceMarginUsed: '1',
      withdrawable: '90',
      assetPositions: [buildPosition('BTC', '3')],
      time: 100,
    };
    const xyz = {
      marginSummary: {
        accountValue: '30',
        totalNtlPos: '20',
        totalRawUsd: '30',
        totalMarginUsed: '4',
      },
      crossMarginSummary: {
        accountValue: '25',
        totalNtlPos: '15',
        totalRawUsd: '25',
        totalMarginUsed: '3',
      },
      crossMaintenanceMarginUsed: '0.5',
      withdrawable: '20',
      assetPositions: [buildPosition('NVDA', '-2')],
      time: 120,
    };

    const aggregated = aggregateClearinghouseStates([
      { dex: '', state: main as any },
      { dex: 'xyz', state: xyz as any },
    ]);

    expect(aggregated?.marginSummary.accountValue).toBe('130');
    expect(aggregated?.marginSummary.totalNtlPos).toBe('70');
    expect(aggregated?.marginSummary.totalMarginUsed).toBe('14');
    expect(aggregated?.crossMarginSummary.accountValue).toBe('105');
    expect(aggregated?.crossMaintenanceMarginUsed).toBe('1.5');
    expect(aggregated?.withdrawable).toBe('110');
    expect(aggregated?.time).toBe(120);
    expect(aggregated?.assetPositions.map((p) => p.position.coin)).toEqual([
      'BTC',
      'xyz:NVDA',
    ]);
    expect(xyz.assetPositions[0].position.coin).toBe('NVDA');
  });

  it('aggregates available clearinghouse states when an optional dex is missing', () => {
    const main = {
      marginSummary: {
        accountValue: '100',
        totalNtlPos: '50',
        totalRawUsd: '100',
        totalMarginUsed: '10',
      },
      crossMarginSummary: {
        accountValue: '80',
        totalNtlPos: '40',
        totalRawUsd: '80',
        totalMarginUsed: '8',
      },
      crossMaintenanceMarginUsed: '1',
      withdrawable: '90',
      assetPositions: [buildPosition('BTC', '3')],
      time: 100,
    };

    const aggregated = aggregateClearinghouseStates([
      { dex: '', state: main as any },
      { dex: 'xyz', state: undefined },
    ]);

    expect(aggregated?.marginSummary.accountValue).toBe('100');
    expect(aggregated?.assetPositions.map((p) => p.position.coin)).toEqual([
      'BTC',
    ]);
  });
});

describe('assembleHyperliquidSnapshot', () => {
  const clearing = {
    marginSummary: {
      accountValue: '120',
      totalNtlPos: '0',
      totalRawUsd: '0',
      totalMarginUsed: '10',
    },
    crossMarginSummary: {
      accountValue: '120',
      totalNtlPos: '0',
      totalRawUsd: '0',
      totalMarginUsed: '10',
    },
    crossMaintenanceMarginUsed: '1',
    withdrawable: '110',
    assetPositions: [
      {
        type: 'oneWay',
        position: {
          coin: 'BTC',
          szi: '-0.1',
          entryPx: '60000',
          positionValue: '6000',
          unrealizedPnl: '-50',
          returnOnEquity: '-0.1',
          liquidationPx: '70000',
          marginUsed: '600',
          maxLeverage: 40,
          leverage: { type: 'cross', value: 10 },
          cumFunding: { allTime: '1', sinceOpen: '2', sinceChange: '0' },
        },
      },
    ],
    time: 1,
  };
  it('nets accountValue+spot, keeps entryNtl, no hold subtraction, flags degraded', () => {
    const spot = {
      balances: [
        { coin: 'USDC', token: 0, total: '100', hold: '20', entryNtl: '100' },
        { coin: 'HYPE', token: 2, total: '2', hold: '0', entryNtl: '50' },
        { coin: 'WEIRD', token: 9, total: '5', hold: '0', entryNtl: '5' },
      ],
    };
    const snap = assembleHyperliquidSnapshot({
      address: '0xAbc',
      clearinghouse: clearing as any,
      spot: spot as any,
      priceMap: { USDC: '1', HYPE: '30' },
      now: 1000,
    });
    expect(snap.address).toBe('0xabc');
    expect(snap.spotTotalUsd).toBe('160'); // 100 + 2*30 (hold not subtracted)
    expect(snap.netWorthUsd).toBe('280');
    expect(snap.totalUnrealizedPnl).toBe('-50');
    expect(snap.isDegraded).toBe(true);
    expect(snap.spotBalances.find((b) => b.coin === 'HYPE')?.entryNtl).toBe(
      '50',
    );
    expect(
      snap.spotBalances.find((b) => b.coin === 'WEIRD')?.valueUsd,
    ).toBeUndefined();
  });
  it('marks empty when no perp value/positions and no spot', () => {
    const empty = {
      marginSummary: {
        accountValue: '0',
        totalNtlPos: '0',
        totalRawUsd: '0',
        totalMarginUsed: '0',
      },
      crossMarginSummary: {
        accountValue: '0',
        totalNtlPos: '0',
        totalRawUsd: '0',
        totalMarginUsed: '0',
      },
      crossMaintenanceMarginUsed: '0',
      withdrawable: '0',
      assetPositions: [],
      time: 1,
    };
    const snap = assembleHyperliquidSnapshot({
      address: '0x1',
      clearinghouse: empty as any,
      spot: { balances: [] } as any,
      priceMap: {},
      now: 1,
    });
    expect(snap.isEmpty).toBe(true);
    expect(snap.netWorthUsd).toBe('0');

    const degradedSnap = assembleHyperliquidSnapshot({
      address: '0x1',
      clearinghouse: empty as any,
      spot: { balances: [] } as any,
      priceMap: {},
      isDegraded: true,
      now: 1,
    });
    expect(degradedSnap.isDegraded).toBe(true);
    expect(degradedSnap.isEmpty).toBe(false);
  });
  it('carries upstream degraded state into the Home snapshot', () => {
    const snap = assembleHyperliquidSnapshot({
      address: '0x1',
      clearinghouse: clearing as any,
      spot: { balances: [] } as any,
      priceMap: {},
      isDegraded: true,
      now: 1,
    });

    expect(snap.isDegraded).toBe(true);
  });
  it('can build a degraded perp-only snapshot without spot state', () => {
    const snap = assembleHyperliquidSnapshot({
      address: '0x1',
      clearinghouse: clearing as any,
      spot: undefined,
      priceMap: { USDC: '1' },
      isDegraded: true,
      now: 1,
    });

    expect(snap.accountValue).toBe('120');
    expect(snap.netWorthUsd).toBe('120');
    expect(snap.spotBalances).toHaveLength(0);
    expect(snap.isDegraded).toBe(true);
    expect(snap.isEmpty).toBe(false);
  });
  it('filters closed residual positions before Home snapshot fields', () => {
    const snap = assembleHyperliquidSnapshot({
      address: '0x1',
      clearinghouse: {
        marginSummary: {
          accountValue: '0',
          totalNtlPos: '0',
          totalRawUsd: '0',
          totalMarginUsed: '0',
        },
        crossMarginSummary: {
          accountValue: '0',
          totalNtlPos: '0',
          totalRawUsd: '0',
          totalMarginUsed: '0',
        },
        crossMaintenanceMarginUsed: '0',
        withdrawable: '0',
        assetPositions: [
          {
            type: 'oneWay',
            position: {
              coin: 'ETH',
              szi: '0',
              entryPx: '1600',
              positionValue: '0',
              unrealizedPnl: '99',
              returnOnEquity: '0',
              liquidationPx: null,
              marginUsed: '0',
              maxLeverage: 50,
              leverage: { type: 'cross', value: 10 },
              cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
            },
          },
        ],
        time: 1,
      } as any,
      spot: { balances: [] } as any,
      priceMap: {},
      now: 1,
    });

    expect(snap.perpPositions).toHaveLength(0);
    expect(snap.totalUnrealizedPnl).toBe('0');
    expect(snap.isEmpty).toBe(true);
  });
  it('values stable coins and allMids-style fallback prices', () => {
    const snap = assembleHyperliquidSnapshot({
      address: '0x1',
      clearinghouse: clearing as any,
      spot: {
        balances: [
          { coin: 'USDT', token: 3, total: '7', hold: '0', entryNtl: '7' },
          { coin: 'HYPE', token: 2, total: '2', hold: '0', entryNtl: '40' },
        ],
      } as any,
      priceMap: {},
      getSpotMarkPrice: (coin) => (coin === 'HYPE' ? '30' : undefined),
      getSpotUniverseName: (coin) =>
        coin === 'HYPE' ? 'HYPE/USDC' : undefined,
      now: 1,
    });

    expect(snap.spotTotalUsd).toBe('67');
    expect(snap.netWorthUsd).toBe('187');
    expect(snap.isDegraded).toBe(false);
    expect(snap.spotBalances.find((b) => b.coin === 'USDT')?.priceUsd).toBe(
      '1',
    );
    expect(
      snap.spotBalances.find((b) => b.coin === 'HYPE')?.spotUniverseName,
    ).toBe('HYPE/USDC');
  });
  it('uses spot-side account value and withdrawable for unified accounts', () => {
    const snap = assembleHyperliquidSnapshot({
      address: '0x1',
      clearinghouse: {
        ...clearing,
        marginSummary: {
          ...clearing.marginSummary,
          accountValue: '900',
        },
        withdrawable: '500',
      } as any,
      spot: {
        balances: [
          { coin: 'USDC', token: 0, total: '200', hold: '50', entryNtl: '200' },
          { coin: 'HYPE', token: 2, total: '2', hold: '0', entryNtl: '40' },
        ],
      } as any,
      priceMap: { HYPE: '30' },
      abstractionMode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
      now: 1,
    });

    expect(snap.accountValue).toBe('260');
    expect(snap.netWorthUsd).toBe('260');
    expect(snap.withdrawable).toBe('150');
  });
  it('adds non-unified perps-side USDC to display holdings without double-counting net worth', () => {
    const snap = assembleHyperliquidSnapshot({
      address: '0x1',
      clearinghouse: {
        ...clearing,
        marginSummary: {
          ...clearing.marginSummary,
          accountValue: '120',
          totalRawUsd: '75',
        },
        withdrawable: '60',
        assetPositions: [],
      } as any,
      spot: {
        balances: [
          { coin: 'USDC', token: 0, total: '25', hold: '5', entryNtl: '25' },
          { coin: 'HYPE', token: 2, total: '1', hold: '0', entryNtl: '20' },
        ],
      } as any,
      priceMap: { HYPE: '30' },
      abstractionMode: EHyperLiquidAbstractionMode.DEFAULT,
      now: 1,
    });

    const usdc = snap.spotBalances.find((balance) => balance.token === 0);
    expect(usdc).toMatchObject({
      coin: 'USDC',
      total: '100',
      hold: '20',
      entryNtl: '100',
      priceUsd: '1',
      valueUsd: '100',
    });
    expect(snap.spotTotalUsd).toBe('55');
    expect(snap.netWorthUsd).toBe('175');
    expect(snap.isEmpty).toBe(false);
  });
});

describe('active perp position helpers', () => {
  const buildPosition = (szi: string, unrealizedPnl: string) => ({
    type: 'oneWay',
    position: {
      coin: 'BTC',
      szi,
      entryPx: '60000',
      positionValue: '6000',
      unrealizedPnl,
      returnOnEquity: '0.1',
      liquidationPx: null,
      marginUsed: '600',
      maxLeverage: 40,
      leverage: { type: 'cross', value: 10 },
      cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
    },
  });

  it('keeps only non-zero sizes and sums their unrealized pnl', () => {
    const positions = [
      buildPosition('0', '99'),
      buildPosition('0.2', '7'),
      buildPosition('-0.1', '-2'),
    ] as any;

    expect(getActivePerpAssetPositions(positions)).toHaveLength(2);
    expect(getActivePerpPositionsUnrealizedPnl(positions)).toBe('5');
  });
});
