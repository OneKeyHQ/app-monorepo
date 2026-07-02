import { EHyperLiquidAbstractionMode } from '../../types/hyperliquid';

import {
  assembleHyperliquidSnapshot,
  buildSpotPriceMap,
  spotNeedsPrices,
} from './hyperliquidPortfolioUtils';

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
      now: 1,
    });

    expect(snap.spotTotalUsd).toBe('67');
    expect(snap.netWorthUsd).toBe('187');
    expect(snap.isDegraded).toBe(false);
    expect(snap.spotBalances.find((b) => b.coin === 'USDT')?.priceUsd).toBe(
      '1',
    );
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
});
