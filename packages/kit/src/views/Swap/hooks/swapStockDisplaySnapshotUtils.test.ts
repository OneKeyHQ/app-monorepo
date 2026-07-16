import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { ESwapStockTradeSide } from './swapStockChannelUtils';
import {
  type ISwapStockDisplayIdentity,
  type ISwapStockDisplaySnapshot,
  SWAP_STOCK_DISPLAY_CHART_MAX_POINTS,
  SWAP_STOCK_DISPLAY_SNAPSHOT_MAX_AGE_MS,
  SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION,
  getMatchingSwapStockDisplaySnapshot,
  mergeSwapStockDisplaySnapshot,
  projectSwapStockDisplayTokenDetail,
  resolveSwapStockDisplayAccountKey,
  sanitizeSwapStockDisplayChartData,
} from './swapStockDisplaySnapshotUtils';

const NOW = 1_725_000_000_000;

const identity: ISwapStockDisplayIdentity = {
  accountKey: 'wallet-1:account-1:derive-1',
  stockTokenKey: 'evm--1:0xaapl:token',
  payTokenKey: 'evm--1:0xusdc:token',
  tradeSide: ESwapStockTradeSide.Buy,
  currency: 'USD',
};

const tokenDetail: IMarketTokenDetail = {
  address: '0xaapl',
  networkId: 'evm--1',
  logoUrl: 'https://example.com/aapl.png',
  name: 'Apple Inc.',
  symbol: 'AAPL',
  decimals: 18,
  price: '213.49',
  priceConverted: '213.49',
  priceChange24hPercent: '1.25',
  lastUpdated: NOW,
  coingeckoId: '  apple-tokenized-stock  ',
  stock: {
    title: 'Apple',
    subtitle: 'AAPL',
    source: 'Nasdaq',
    sourceLogoUri: 'https://example.com/nasdaq.png',
    isOpen: true,
    description: 'Market is open',
    dividendPerShare: '1.00',
    assetAnalysis: {
      volume24h: '1000000',
    },
    tradingActivity: {
      peRatio: '30',
    },
  },
};

function createSnapshot({
  currentIdentity = identity,
  now = NOW,
}: {
  currentIdentity?: ISwapStockDisplayIdentity;
  now?: number;
} = {}): ISwapStockDisplaySnapshot {
  return mergeSwapStockDisplaySnapshot({
    identity: currentIdentity,
    patch: {
      tokenDetail: projectSwapStockDisplayTokenDetail(tokenDetail),
      balance: {
        inputTokenKey: currentIdentity.payTokenKey,
        value: '125.5',
        tokenPrice: {
          price: '1',
          currency: currentIdentity.currency,
        },
      },
      chart: {
        range: '1W',
        data: [
          [1_724_000_000, 210],
          [1_725_000_000, 213.49],
        ],
      },
    },
    now,
  });
}

describe('swapStockDisplaySnapshotUtils', () => {
  it('uses the validated cold-start owner only before account sync', () => {
    expect(
      resolveSwapStockDisplayAccountKey({
        activeAccountReady: false,
        coldStartAccountKey: identity.accountKey,
        initialSelectedTokensSynced: false,
      }),
    ).toBe(identity.accountKey);
    expect(
      resolveSwapStockDisplayAccountKey({
        activeAccountCandidateKey: 'wallet-2|account-2|derive-1',
        activeAccountReady: false,
        coldStartAccountKey: identity.accountKey,
        initialSelectedTokensSynced: false,
      }),
    ).toBeUndefined();
    expect(
      resolveSwapStockDisplayAccountKey({
        activeAccountReady: false,
        coldStartAccountKey: identity.accountKey,
        initialSelectedTokensSynced: true,
      }),
    ).toBeUndefined();
  });

  it('always prefers the ready live account owner', () => {
    expect(
      resolveSwapStockDisplayAccountKey({
        activeAccountCandidateKey: 'wallet-2|account-2|derive-1',
        activeAccountReady: true,
        coldStartAccountKey: identity.accountKey,
        initialSelectedTokensSynced: false,
      }),
    ).toBe('wallet-2|account-2|derive-1');
  });

  it.each([
    ['account', { accountKey: 'wallet-2:account-2:derive-1' }],
    ['stock', { stockTokenKey: 'evm--1:0xtsla:token' }],
    ['pay token', { payTokenKey: 'evm--1:0xusdt:token' }],
    ['trade side', { tradeSide: ESwapStockTradeSide.Sell }],
    ['currency', { currency: 'EUR' }],
  ] as const)('rejects a snapshot for the wrong %s identity', (_, change) => {
    expect(
      getMatchingSwapStockDisplaySnapshot({
        identity: { ...identity, ...change },
        snapshot: createSnapshot(),
        now: NOW,
      }),
    ).toBeUndefined();
  });

  it('rejects snapshots with future or expired region timestamps', () => {
    const snapshot = createSnapshot();

    expect(
      getMatchingSwapStockDisplaySnapshot({
        identity,
        snapshot: {
          ...snapshot,
          updatedAt: NOW + 1,
        },
        now: NOW,
      }),
    ).toBeUndefined();

    expect(
      getMatchingSwapStockDisplaySnapshot({
        identity,
        snapshot: {
          ...snapshot,
          tokenDetail: snapshot.tokenDetail
            ? { ...snapshot.tokenDetail, updatedAt: NOW + 1 }
            : undefined,
          balance: undefined,
          chart: undefined,
        },
        now: NOW,
      }),
    ).toBeUndefined();

    expect(
      getMatchingSwapStockDisplaySnapshot({
        identity,
        snapshot,
        now: NOW + SWAP_STOCK_DISPLAY_SNAPSHOT_MAX_AGE_MS + 1,
      }),
    ).toBeUndefined();
  });

  it('rejects malformed and unsupported-version snapshots', () => {
    expect(
      getMatchingSwapStockDisplaySnapshot({
        identity,
        snapshot: {
          version: SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION,
          identity,
          updatedAt: NOW,
          balance: {
            inputTokenKey: identity.payTokenKey,
            value: 125.5,
            updatedAt: NOW,
          },
        },
        now: NOW,
      }),
    ).toBeUndefined();

    expect(
      getMatchingSwapStockDisplaySnapshot({
        identity,
        snapshot: {
          ...createSnapshot(),
          version: SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION + 1,
        },
        now: NOW,
      }),
    ).toBeUndefined();

    expect(
      getMatchingSwapStockDisplaySnapshot({
        identity,
        snapshot: {
          ...createSnapshot(),
          identity: {
            ...identity,
            tradeSide: 'hold',
          },
        },
        now: NOW,
      }),
    ).toBeUndefined();
  });

  it('does not renew untouched region TTLs when another region is updated', () => {
    const original = createSnapshot();
    const balanceUpdatedAt = NOW + SWAP_STOCK_DISPLAY_SNAPSHOT_MAX_AGE_MS - 10;
    const withFreshBalance = mergeSwapStockDisplaySnapshot({
      identity,
      previous: original,
      patch: {
        balance: {
          inputTokenKey: identity.payTokenKey,
          value: '200',
        },
      },
      now: balanceUpdatedAt,
    });

    expect(withFreshBalance.tokenDetail?.updatedAt).toBe(NOW);
    expect(withFreshBalance.chart?.updatedAt).toBe(NOW);
    expect(withFreshBalance.balance?.updatedAt).toBe(balanceUpdatedAt);

    expect(
      getMatchingSwapStockDisplaySnapshot({
        identity,
        snapshot: withFreshBalance,
        now: NOW + SWAP_STOCK_DISPLAY_SNAPSHOT_MAX_AGE_MS + 1,
      }),
    ).toMatchObject({
      tokenDetail: undefined,
      chart: undefined,
      balance: {
        value: '200',
        updatedAt: balanceUpdatedAt,
      },
    });
  });

  it('uniformly downsamples chart data while preserving first and last points', () => {
    const chartData = Array.from(
      { length: 1001 },
      (_, index) => [index, index * 2] as [number, number],
    );

    const result = sanitizeSwapStockDisplayChartData(chartData);

    expect(result).toHaveLength(SWAP_STOCK_DISPLAY_CHART_MAX_POINTS);
    expect(result[0]).toEqual(chartData[0]);
    expect(result.at(-1)).toEqual(chartData.at(-1));
    expect(result).toEqual(
      Array.from(
        { length: SWAP_STOCK_DISPLAY_CHART_MAX_POINTS },
        (_, index) =>
          chartData[
            Math.round(
              (index * (chartData.length - 1)) /
                (SWAP_STOCK_DISPLAY_CHART_MAX_POINTS - 1),
            )
          ],
      ),
    );
  });

  it('drops all previous regions when the snapshot identity changes', () => {
    const nextIdentity: ISwapStockDisplayIdentity = {
      ...identity,
      accountKey: 'wallet-2:account-2:derive-1',
    };
    const next = mergeSwapStockDisplaySnapshot({
      identity: nextIdentity,
      previous: createSnapshot(),
      patch: {
        balance: {
          inputTokenKey: nextIdentity.payTokenKey,
          value: '50',
        },
      },
      now: NOW + 1,
    });

    expect(next.identity).toEqual(nextIdentity);
    expect(next.tokenDetail).toBeUndefined();
    expect(next.chart).toBeUndefined();
    expect(next.balance).toMatchObject({
      inputTokenKey: nextIdentity.payTokenKey,
      value: '50',
      updatedAt: NOW + 1,
    });
  });

  it('projects display-only stock detail without live market gate fields', () => {
    const projected = projectSwapStockDisplayTokenDetail(tokenDetail);

    expect(projected).toMatchObject({
      address: tokenDetail.address,
      symbol: tokenDetail.symbol,
      coingeckoId: 'apple-tokenized-stock',
      stock: {
        subtitle: tokenDetail.stock?.subtitle,
        source: tokenDetail.stock?.source,
        sourceLogoUri: tokenDetail.stock?.sourceLogoUri,
        assetAnalysis: tokenDetail.stock?.assetAnalysis,
        tradingActivity: tokenDetail.stock?.tradingActivity,
      },
    });
    expect(projected.stock).not.toHaveProperty('isOpen');
    expect(projected.stock).not.toHaveProperty('description');
  });
});
