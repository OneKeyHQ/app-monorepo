import { parse, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';

import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

export type IPtConvergenceChartData = NonNullable<
  NonNullable<IStakeEarnDetail['rules']>['chart']
>;

export interface IPendlePtConvergenceChartProps {
  chart: IPtConvergenceChartData;
  history?: { timestamp: number; apy?: string }[];
  maturityDate?: string;
  isHistoryLoading?: boolean;
}

export type IPtPricePoint = {
  timestamp: number;
  price: number;
  estimated: boolean;
};

export const DAY_MS = 86_400_000;
const YEAR_MS = DAY_MS * 365;
const MAX_HISTORY_MS = DAY_MS * 60;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatRate(rate: number) {
  return Number.isFinite(rate) ? Number(rate.toFixed(4)).toString() : '--';
}

function getMaturityTimestamp(maturityDate?: string) {
  if (!maturityDate) return NaN;
  const isoTimestamp = parseISO(maturityDate).getTime();
  if (Number.isFinite(isoTimestamp)) return isoTimestamp;
  // The detail contract also returns calendar dates such as "26 Nov 2026".
  // Parse explicitly because Hermes need not accept this via new Date().
  return parse(maturityDate, 'd MMM yyyy', new Date(0), {
    locale: enUS,
  }).getTime();
}

export function buildConvergenceModel({
  chart,
  history,
  maturityDate,
  now,
  asOf = now,
}: Omit<IPendlePtConvergenceChartProps, 'isHistoryLoading'> & {
  now: number;
  asOf?: number;
}) {
  const { currentRate, targetRate, remainingDays, accountingSymbol } = chart;
  const serverMaturity = getMaturityTimestamp(maturityDate);
  const hasMaturityDate = Number.isFinite(serverMaturity);
  const maturity = hasMaturityDate
    ? serverMaturity
    : asOf + remainingDays * DAY_MS;
  if (
    !Number.isFinite(new Date(now).getTime()) ||
    !Number.isFinite(new Date(maturity).getTime()) ||
    !Number.isFinite(currentRate) ||
    !Number.isFinite(targetRate) ||
    currentRate <= 0 ||
    targetRate <= 0 ||
    !accountingSymbol.trim()
  ) {
    return undefined;
  }
  const isMatured = maturity <= now;
  const anchorTime = Math.min(now, maturity);
  const historyWindow = Math.min(
    Math.max(maturity - now, DAY_MS),
    MAX_HISTORY_MS,
  );
  const historyStart = anchorTime - (isMatured ? MAX_HISTORY_MS : historyWindow);
  const byTime = new Map<number, IPtPricePoint>();
  // Implied APY is a percentage in OneKey's history contract. Pendle's
  // ptExchangeRate = (1 + APY) ^ yearsToExpiry; price is its reciprocal.
  // Require the server's maturity date; remainingDays alone is a snapshot.
  if (hasMaturityDate) {
    for (const item of history ?? []) {
      const timestamp = Number(item.timestamp);
      if (
        item.apy?.trim() &&
        Number.isFinite(timestamp) &&
        timestamp >= historyStart &&
        timestamp < anchorTime
      ) {
        const apy = Number(item.apy) / 100;
        const price =
          targetRate / (1 + apy) ** ((maturity - timestamp) / YEAR_MS);
        if (
          Number.isFinite(apy) &&
          apy > -1 &&
          Number.isFinite(price) &&
          price > 0
        ) {
          byTime.set(timestamp, { timestamp, price, estimated: false });
        }
      }
    }
  }
  const observed = Array.from(byTime.values()).toSorted(
    (a, b) => a.timestamp - b.timestamp,
  );
  const current: IPtPricePoint = {
    timestamp: anchorTime,
    price: isMatured ? targetRate : currentRate,
    estimated: false,
  };
  const historical = observed.length >= 2 ? [...observed, current] : [];
  const forecast: IPtPricePoint[] = [];
  if (!isMatured) {
    for (let index = 0; index <= 32; index += 1) {
      const fraction = index / 32;
      forecast.push({
        timestamp: now + fraction * (maturity - now),
        // Constant implied yield is an illustration, never a price prediction.
        price:
          index === 0
            ? currentRate
            : index === 32
              ? targetRate
              : Math.exp(
                  Math.log(currentRate) * (1 - fraction) +
                    Math.log(targetRate) * fraction,
                ),
        estimated: index > 0,
      });
    }
  }
  const points = [...historical, ...forecast];
  const prices = points.length
    ? points.map((point) => point.price)
    : [targetRate];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const padding = max === min ? max * 0.005 : (max - min) * 0.2;
  const axisMin = min - padding;
  const axisMax = max + padding;
  const axisRange = axisMax - axisMin;
  if (!Number.isFinite(axisRange) || axisRange <= 0) return undefined;
  return {
    historical,
    forecast,
    current,
    isMatured,
    maturity,
    start: historical[0]?.timestamp ?? anchorTime,
    min: axisMin,
    max: axisMax,
    points: points.length ? points : [current],
  };
}

export type IConvergenceModel = NonNullable<
  ReturnType<typeof buildConvergenceModel>
>;

export function findNearestPoint(points: IPtPricePoint[], timestamp: number) {
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].timestamp < timestamp) low = mid + 1;
    else high = mid;
  }
  const after = points[low];
  const before = points[Math.max(0, low - 1)];
  return timestamp - before.timestamp < after.timestamp - timestamp
    ? before
    : after;
}
