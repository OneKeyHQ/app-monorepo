import BigNumber from 'bignumber.js';

import {
  isSpotInstrument,
  isUsdcDenominatedFee,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IFill,
  IPortfolio,
  IPortfolioMetrics,
  IUserFunding,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

export type IPortfolioTimePeriod = 'day' | 'week' | 'month' | 'allTime';
export type IPortfolioChartType = 'accountValue' | 'pnl' | 'funding';
export type IPortfolioPnlType = 'all' | 'perps' | 'spot';

export type IPortfolioChartData = {
  accountValueHistory: [number, number][];
  pnlHistory: [number, number][];
  perpsPnlHistory: [number, number][];
  nonPerpsPnlHistory: [number, number][];
  vlm: string;
};

export type IFundingMarketBreakdownRow = {
  coin: string;
  total: number;
  activity: number;
  bucketValues: number[];
};

export type IFundingMarketBreakdown = {
  rows: IFundingMarketBreakdownRow[];
  bucketStarts: number[];
  maxAbsBucketValue: number;
  maxAbsTotal: number;
};

export type IFundingDistributionRow = {
  coin: string;
  amount: number;
};

export type IFundingDirectionDistribution = {
  paid: IFundingDistributionRow[];
  received: IFundingDistributionRow[];
};

export type IFundingPeriodNetSummary = {
  net24h: number;
  net7d: number;
};

export type IFundingHistogramStyle = {
  barWidthRatio: number;
  maxBarWidth: number;
};

export type IPerpPortfolioFillsStats = {
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  feesPaid: number;
  volumeUsd: number;
  mostTraded: string | null;
  profitFactor: number | null;
  realizedPnl: number;
  spotRealizedPnl: number;
  totalTrades: number;
};

type IPortfolioData = IPortfolio[number][];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;
const FUNDING_HISTOGRAM_BUCKET_COUNT_MAP: Record<IPortfolioTimePeriod, number> =
  {
    day: 24,
    week: 7,
    month: 30,
    allTime: 30,
  };

const COMBINED_PERIOD_KEY_MAP: Record<IPortfolioTimePeriod, string> = {
  day: 'day',
  week: 'week',
  month: 'month',
  allTime: 'allTime',
};

const PERP_PERIOD_KEY_MAP: Record<IPortfolioTimePeriod, string> = {
  day: 'perpDay',
  week: 'perpWeek',
  month: 'perpMonth',
  allTime: 'perpAllTime',
};

export function getStartTimeForPeriod(
  period: IPortfolioTimePeriod,
  now = Date.now(),
): number {
  switch (period) {
    case 'day':
      return now - ONE_DAY_MS;
    case 'week':
      return now - ONE_WEEK_MS;
    case 'month':
      return now - ONE_MONTH_MS;
    case 'allTime':
    default:
      return 0;
  }
}

function formatHistory(
  history: IPortfolioMetrics['pnlHistory'],
): [number, number][] {
  return history.map(([ts, val]): [number, number] => [
    Math.floor(ts / 1000),
    parseFloat(val),
  ]);
}

function getPortfolioMetrics(
  portfolioData: IPortfolioData,
  key: string,
): IPortfolioMetrics | null {
  const entry = portfolioData.find(([entryKey]) => entryKey === key);
  return entry?.[1] ?? null;
}

function subtractHistory(
  history: [number, number][],
  subtrahend: [number, number][],
): [number, number][] {
  const subtrahendMap = new Map(subtrahend);
  return history.map(([ts, val]) => [ts, val - (subtrahendMap.get(ts) ?? 0)]);
}

export function buildPortfolioChartData({
  portfolioData,
  timePeriod,
}: {
  portfolioData: IPortfolioData;
  timePeriod: IPortfolioTimePeriod;
}): IPortfolioChartData | null {
  const combinedMetrics = getPortfolioMetrics(
    portfolioData,
    COMBINED_PERIOD_KEY_MAP[timePeriod],
  );
  if (!combinedMetrics) return null;

  const perpsMetrics = getPortfolioMetrics(
    portfolioData,
    PERP_PERIOD_KEY_MAP[timePeriod],
  );

  const pnlHistory = formatHistory(combinedMetrics.pnlHistory);
  const perpsPnlHistory = perpsMetrics
    ? formatHistory(perpsMetrics.pnlHistory)
    : [];

  return {
    accountValueHistory: formatHistory(combinedMetrics.accountValueHistory),
    pnlHistory,
    perpsPnlHistory,
    nonPerpsPnlHistory: subtractHistory(pnlHistory, perpsPnlHistory),
    vlm: combinedMetrics.vlm,
  };
}

export function buildCumulativeFundingChartData({
  records,
  timePeriod,
  now = Date.now(),
}: {
  records: IUserFunding[];
  timePeriod: IPortfolioTimePeriod;
  now?: number;
}): {
  chartData: [number, number][];
  total: number;
} {
  const startTime = getStartTimeForPeriod(timePeriod, now);
  const fundingBySecond = new Map<number, BigNumber>();

  records.forEach((record) => {
    if (record.time < startTime || record.time > now) return;

    const payment = new BigNumber(record.delta.usdc);
    if (!payment.isFinite()) return;

    const time = Math.floor(record.time / 1000);
    fundingBySecond.set(
      time,
      (fundingBySecond.get(time) ?? new BigNumber(0)).plus(payment),
    );
  });

  const fundingPoints = Array.from(fundingBySecond.entries()).toSorted(
    ([timeA], [timeB]) => timeA - timeB,
  );
  const firstFundingTime = fundingPoints[0]?.[0];
  if (firstFundingTime === undefined) {
    return {
      chartData: [],
      total: 0,
    };
  }

  const periodStartTime = Math.floor(startTime / 1000);
  const baselineTime =
    timePeriod === 'allTime'
      ? Math.max(0, firstFundingTime - 1)
      : Math.min(periodStartTime, firstFundingTime - 1);
  const chartData: [number, number][] = [[baselineTime, 0]];
  let cumulativeFunding = new BigNumber(0);

  fundingPoints.forEach(([time, payment]) => {
    cumulativeFunding = cumulativeFunding.plus(payment);
    chartData.push([time, cumulativeFunding.toNumber()]);
  });

  const nowInSeconds = Math.floor(now / 1000);
  if (chartData.at(-1)?.[0] !== nowInSeconds) {
    chartData.push([nowInSeconds, cumulativeFunding.toNumber()]);
  }

  return {
    chartData,
    total: cumulativeFunding.toNumber(),
  };
}

export function buildFundingHistogramChartData({
  records,
  timePeriod,
  now = Date.now(),
}: {
  records: IUserFunding[];
  timePeriod: IPortfolioTimePeriod;
  now?: number;
}): {
  chartData: [number, number][];
  total: number;
} {
  const validRecords = records.flatMap((record) => {
    if (!Number.isFinite(record.time) || record.time > now) {
      return [];
    }

    const payment = new BigNumber(record.delta.usdc);
    if (!payment.isFinite()) return [];

    return [{ record, payment }];
  });
  const rangeStart =
    timePeriod === 'allTime'
      ? Math.min(...validRecords.map(({ record }) => record.time))
      : getStartTimeForPeriod(timePeriod, now);
  const periodRecords = validRecords.filter(
    ({ record }) => record.time >= rangeStart,
  );

  if (periodRecords.length === 0 || !Number.isFinite(rangeStart)) {
    return { chartData: [], total: 0 };
  }

  const rangeDuration = Math.max(1, now - rangeStart);
  const targetBucketCount = FUNDING_HISTOGRAM_BUCKET_COUNT_MAP[timePeriod];
  const bucketCount = Math.min(
    targetBucketCount,
    Math.max(1, Math.floor(rangeDuration / 1000)),
  );
  const bucketValues = Array.from(
    { length: bucketCount },
    () => new BigNumber(0),
  );

  periodRecords.forEach(({ record, payment }) => {
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.floor(((record.time - rangeStart) / rangeDuration) * bucketCount),
    );
    bucketValues[bucketIndex] = bucketValues[bucketIndex].plus(payment);
  });

  return {
    chartData: bucketValues.map((value, bucketIndex) => [
      Math.floor(
        (rangeStart + (rangeDuration * bucketIndex) / bucketCount) / 1000,
      ),
      value.toNumber(),
    ]),
    total: bucketValues
      .reduce((sum, value) => sum.plus(value), new BigNumber(0))
      .toNumber(),
  };
}

export function resolveFundingHistogramStyle({
  chartData,
  isMobile,
}: {
  chartData: [number, number][];
  isMobile: boolean;
}): IFundingHistogramStyle {
  const activeBucketCount = chartData.reduce(
    (count, [, value]) =>
      count + (Number.isFinite(value) && value !== 0 ? 1 : 0),
    0,
  );

  if (chartData.length <= 7 || activeBucketCount <= 2) {
    return {
      barWidthRatio: 0.45,
      maxBarWidth: isMobile ? 8 : 12,
    };
  }

  if (chartData.length <= 24 || activeBucketCount <= 5) {
    return {
      barWidthRatio: 0.4,
      maxBarWidth: isMobile ? 7 : 10,
    };
  }

  return {
    barWidthRatio: 0.35,
    maxBarWidth: isMobile ? 6 : 8,
  };
}

export function buildFundingPaymentSummary(records: IUserFunding[]): {
  netFunding: number;
  totalPaid: number;
  totalReceived: number;
} {
  let totalPaid = new BigNumber(0);
  let totalReceived = new BigNumber(0);

  records.forEach((record) => {
    const payment = new BigNumber(record.delta.usdc);
    if (!payment.isFinite()) return;

    if (payment.isPositive()) {
      totalReceived = totalReceived.plus(payment);
    } else if (payment.isNegative()) {
      totalPaid = totalPaid.plus(payment.abs());
    }
  });

  return {
    netFunding: totalReceived.minus(totalPaid).toNumber(),
    totalPaid: totalPaid.toNumber(),
    totalReceived: totalReceived.toNumber(),
  };
}

export function buildFundingPeriodNetSummary({
  records,
  now = Date.now(),
}: {
  records: IUserFunding[];
  now?: number;
}): IFundingPeriodNetSummary {
  const dayStart = getStartTimeForPeriod('day', now);
  const weekStart = getStartTimeForPeriod('week', now);
  let net24h = new BigNumber(0);
  let net7d = new BigNumber(0);

  records.forEach((record) => {
    if (record.time < weekStart || record.time > now) return;

    const payment = new BigNumber(record.delta.usdc);
    if (!payment.isFinite()) return;

    net7d = net7d.plus(payment);
    if (record.time >= dayStart) {
      net24h = net24h.plus(payment);
    }
  });

  return {
    net24h: net24h.toNumber(),
    net7d: net7d.toNumber(),
  };
}

export function buildFundingMarketBreakdown({
  records,
  timePeriod,
  now = Date.now(),
  bucketCount = 12,
  maxMarkets = 9,
}: {
  records: IUserFunding[];
  timePeriod: IPortfolioTimePeriod;
  now?: number;
  bucketCount?: number;
  maxMarkets?: number;
}): IFundingMarketBreakdown {
  const safeBucketCount = Math.max(1, Math.floor(bucketCount));
  const safeMaxMarkets = Math.max(1, Math.floor(maxMarkets));
  const validRecords = records.flatMap((record) => {
    if (record.time > now) return [];

    const payment = new BigNumber(record.delta.usdc);
    if (!payment.isFinite()) return [];

    return [{ record, payment }];
  });
  const rangeStart =
    timePeriod === 'allTime'
      ? Math.min(...validRecords.map(({ record }) => record.time))
      : getStartTimeForPeriod(timePeriod, now);
  const periodRecords = validRecords.filter(
    ({ record }) => record.time >= rangeStart,
  );

  if (periodRecords.length === 0 || !Number.isFinite(rangeStart)) {
    return {
      rows: [],
      bucketStarts: [],
      maxAbsBucketValue: 0,
      maxAbsTotal: 0,
    };
  }

  const rangeDuration = Math.max(1, now - rangeStart);
  const bucketStarts = Array.from({ length: safeBucketCount }, (_, index) =>
    Math.floor(rangeStart + (rangeDuration * index) / safeBucketCount),
  );
  const marketMap = new Map<
    string,
    {
      total: BigNumber;
      activity: BigNumber;
      bucketValues: BigNumber[];
    }
  >();

  periodRecords.forEach(({ record, payment }) => {
    const market = marketMap.get(record.delta.coin) ?? {
      total: new BigNumber(0),
      activity: new BigNumber(0),
      bucketValues: Array.from(
        { length: safeBucketCount },
        () => new BigNumber(0),
      ),
    };
    const bucketIndex = Math.min(
      safeBucketCount - 1,
      Math.floor(
        ((record.time - rangeStart) / rangeDuration) * safeBucketCount,
      ),
    );

    market.total = market.total.plus(payment);
    market.activity = market.activity.plus(payment.abs());
    market.bucketValues[bucketIndex] =
      market.bucketValues[bucketIndex].plus(payment);
    marketMap.set(record.delta.coin, market);
  });

  const marketRows = Array.from(marketMap.entries())
    .map(([coin, market]) => ({
      coin,
      total: market.total.toNumber(),
      activity: market.activity.toNumber(),
      bucketValues: market.bucketValues.map((value) => value.toNumber()),
    }))
    .toSorted(
      (rowA, rowB) =>
        rowB.activity - rowA.activity || rowA.coin.localeCompare(rowB.coin),
    );

  let rows = marketRows.slice(0, safeMaxMarkets);
  if (marketRows.length > safeMaxMarkets) {
    const visibleRows = marketRows.slice(0, safeMaxMarkets - 1);
    const otherRows = marketRows.slice(safeMaxMarkets - 1);
    rows = [
      ...visibleRows,
      {
        coin: 'Other',
        total: otherRows.reduce((sum, row) => sum + row.total, 0),
        activity: otherRows.reduce((sum, row) => sum + row.activity, 0),
        bucketValues: Array.from(
          { length: safeBucketCount },
          (_, bucketIndex) =>
            otherRows.reduce(
              (sum, row) => sum + row.bucketValues[bucketIndex],
              0,
            ),
        ),
      },
    ];
  }

  return {
    rows,
    bucketStarts,
    maxAbsBucketValue: Math.max(
      0,
      ...rows.flatMap((row) =>
        row.bucketValues.map((value) => Math.abs(value)),
      ),
    ),
    maxAbsTotal: Math.max(0, ...rows.map((row) => Math.abs(row.total))),
  };
}

export function buildFundingDirectionDistribution({
  records,
  timePeriod,
  now = Date.now(),
  maxBaseMarkets = 5,
}: {
  records: IUserFunding[];
  timePeriod: IPortfolioTimePeriod;
  now?: number;
  maxBaseMarkets?: number;
}): IFundingDirectionDistribution {
  const startTime = getStartTimeForPeriod(timePeriod, now);
  const safeMaxBaseMarkets = Math.max(1, Math.floor(maxBaseMarkets));
  const paidByMarket = new Map<string, BigNumber>();
  const receivedByMarket = new Map<string, BigNumber>();

  records.forEach((record) => {
    if (record.time < startTime || record.time > now) return;

    const payment = new BigNumber(record.delta.usdc);
    if (!payment.isFinite() || payment.isZero()) return;

    const targetMap = payment.isPositive() ? receivedByMarket : paidByMarket;
    const amount = payment.abs();
    targetMap.set(
      record.delta.coin,
      (targetMap.get(record.delta.coin) ?? new BigNumber(0)).plus(amount),
    );
  });

  const buildRows = (
    marketMap: Map<string, BigNumber>,
  ): IFundingDistributionRow[] => {
    const marketRows = Array.from(marketMap.entries())
      .map(([coin, amount]) => ({ coin, amount: amount.toNumber() }))
      .toSorted(
        (rowA, rowB) =>
          rowB.amount - rowA.amount || rowA.coin.localeCompare(rowB.coin),
      );

    if (marketRows.length <= safeMaxBaseMarkets) return marketRows;

    const visibleRows = marketRows.slice(0, safeMaxBaseMarkets);
    const otherRows = marketRows.slice(safeMaxBaseMarkets);
    return [
      ...visibleRows,
      {
        coin: 'Other',
        amount: otherRows.reduce((sum, row) => sum + row.amount, 0),
      },
    ];
  };

  return {
    paid: buildRows(paidByMarket),
    received: buildRows(receivedByMarket),
  };
}

export function buildPerpPortfolioFillsStats({
  fills,
  timePeriod,
  pnlType = 'all',
  now,
}: {
  fills: IFill[];
  timePeriod: IPortfolioTimePeriod;
  pnlType?: IPortfolioPnlType;
  now?: number;
}): IPerpPortfolioFillsStats {
  const startMs = getStartTimeForPeriod(timePeriod, now);

  const filteredFills = fills.filter((fill) => {
    const isSpotFill = isSpotInstrument(fill.coin);
    if (pnlType === 'perps' && isSpotFill) return false;
    if (pnlType === 'spot' && !isSpotFill) return false;
    if (timePeriod !== 'allTime' && fill.time < startMs) return false;
    return new BigNumber(fill.closedPnl).isFinite();
  });

  const closedFills = filteredFills.filter((fill) =>
    new BigNumber(fill.closedPnl).abs().gt(0),
  );

  const winFills = closedFills.filter((fill) =>
    new BigNumber(fill.closedPnl).gt(0),
  );
  const lossFills = closedFills.filter((fill) =>
    new BigNumber(fill.closedPnl).lt(0),
  );

  const winRate =
    closedFills.length > 0
      ? (winFills.length / closedFills.length) * 100
      : null;

  const avgWin =
    winFills.length > 0
      ? winFills
          .reduce((sum, f) => sum.plus(f.closedPnl), new BigNumber(0))
          .div(winFills.length)
          .toNumber()
      : null;

  const avgLoss =
    lossFills.length > 0
      ? lossFills
          .reduce((sum, f) => sum.plus(f.closedPnl), new BigNumber(0))
          .div(lossFills.length)
          .toNumber()
      : null;

  // Base-token fees (spot buys) are token units, not USD; convert them at the
  // fill's own price (the same px volumeUsd trusts). A fill without a usable
  // price is dropped rather than counted as raw token units.
  const feesPaid = filteredFills
    .reduce((sum, f) => {
      if (isUsdcDenominatedFee(f.feeToken)) {
        return sum.plus(f.fee);
      }
      const px = new BigNumber(f.px);
      const fee = new BigNumber(f.fee);
      return px.isFinite() && px.gt(0) && fee.isFinite()
        ? sum.plus(fee.multipliedBy(px))
        : sum;
    }, new BigNumber(0))
    .toNumber();

  const volumeUsd = filteredFills
    .reduce((sum, f) => {
      const size = new BigNumber(f.sz);
      const price = new BigNumber(f.px);
      if (!size.isFinite() || !price.isFinite()) {
        return sum;
      }
      return sum.plus(size.abs().multipliedBy(price));
    }, new BigNumber(0))
    .toNumber();

  const coinCounts: Record<string, number> = {};
  filteredFills.forEach((fill) => {
    coinCounts[fill.coin] = (coinCounts[fill.coin] ?? 0) + 1;
  });
  let mostTraded: string | null = null;
  let maxCount = 0;
  Object.entries(coinCounts).forEach(([coin, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostTraded = coin;
    }
  });

  const totalGain = winFills.reduce(
    (sum, f) => sum.plus(f.closedPnl),
    new BigNumber(0),
  );
  const totalLoss = lossFills
    .reduce((sum, f) => sum.plus(f.closedPnl), new BigNumber(0))
    .abs();
  const profitFactor = totalLoss.gt(0)
    ? totalGain.div(totalLoss).toNumber()
    : null;

  const realizedPnl = totalGain.minus(totalLoss).toNumber();
  const spotRealizedPnl = closedFills
    .filter((fill) => isSpotInstrument(fill.coin))
    .reduce((sum, fill) => sum.plus(fill.closedPnl), new BigNumber(0))
    .toNumber();

  return {
    winRate,
    avgWin,
    avgLoss,
    feesPaid,
    volumeUsd,
    mostTraded,
    profitFactor,
    realizedPnl,
    spotRealizedPnl,
    totalTrades: filteredFills.length,
  };
}
