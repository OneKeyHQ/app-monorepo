import { parse, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';

import type {
  IStakeEarnDetail,
  IUnderlyingApyHistoryItem,
} from '@onekeyhq/shared/types/staking';

export type IPtConvergenceChartData = NonNullable<
  NonNullable<IStakeEarnDetail['rules']>['chart']
>;

export interface IPendlePtConvergenceChartProps {
  chart: IPtConvergenceChartData;
  maturity?: IStakeEarnDetail['maturity'];
  history?: IUnderlyingApyHistoryItem[];
}

export interface IPtPricePoint {
  timestamp: number;
  price: number;
  source: 'history' | 'current' | 'estimate';
}

export const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;
const MAX_HISTORY_MS = 60 * DAY_MS;
const PROJECTION_STEPS = 48;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatRate(rate: number) {
  if (!Number.isFinite(rate)) return '--';
  return Number(
    rate !== 0 && Math.abs(rate) < 0.0001
      ? rate.toPrecision(4)
      : rate.toFixed(4),
  ).toString();
}

export function getMaturityTimestamp(date?: string) {
  if (!date?.trim()) return undefined;
  if (date.includes('T')) {
    const timestamp = parseISO(date.trim()).getTime();
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }
  // The detail contract formats expiry as an English UTC calendar date.
  // Parse that calendar day independently of the app locale and device zone.
  let calendarDate = parse(date.trim(), 'dd MMM yyyy', new Date(0), {
    locale: enUS,
  });
  if (!Number.isFinite(calendarDate.getTime())) {
    calendarDate = parse(date.trim(), 'yyyy-MM-dd', new Date(0));
  }
  const timestamp = Date.UTC(
    calendarDate.getFullYear(),
    calendarDate.getMonth(),
    calendarDate.getDate(),
  );
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function buildPtPriceChart({
  chart,
  maturity,
  history,
  now = Date.now(),
}: IPendlePtConvergenceChartProps & { now?: number }) {
  const { currentRate, targetRate, remainingDays, accountingSymbol, ptSymbol } =
    chart;
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(currentRate) ||
    currentRate <= 0 ||
    !Number.isFinite(targetRate) ||
    targetRate <= 0 ||
    !Number.isFinite(remainingDays) ||
    remainingDays < 0 ||
    !accountingSymbol?.trim() ||
    !ptSymbol?.trim()
  ) {
    return undefined;
  }

  const expiry = getMaturityTimestamp(maturity?.date);
  const end = expiry ?? now + remainingDays * DAY_MS;
  // Matured markets have no future trajectory; do not extend a stale snapshot.
  if (
    maturity?.isMatured ||
    end <= now ||
    !Number.isFinite(end) ||
    !Number.isFinite(new Date(end).getTime())
  )
    return undefined;

  const windowStart = now - Math.min(end - now, MAX_HISTORY_MS);
  const priceByTimestamp = new Map<number, IPtPricePoint>();
  // The existing API returns historical implied APY in percent, rounded to
  // two decimals. Reconstruct approximate PT/accounting-asset prices using
  // Pendle's discount formula; never invent observations or smooth volatility.
  // https://docs.pendle.finance/pendle-v2-dev/Oracles/OracleOverview
  if (expiry !== undefined) {
    (history ?? []).forEach((item) => {
      const apy = Number(item.impliedApy);
      if (
        !item.impliedApy?.trim() ||
        !Number.isFinite(apy) ||
        apy <= -100 ||
        !Number.isFinite(item.timestamp) ||
        item.timestamp < windowStart ||
        item.timestamp >= now
      ) {
        return;
      }
      const price =
        targetRate * (1 + apy / 100) ** (-(end - item.timestamp) / YEAR_MS);
      if (Number.isFinite(price) && price > 0) {
        priceByTimestamp.set(item.timestamp, {
          timestamp: item.timestamp,
          price,
          source: 'history',
        });
      }
    });
  }
  const historical = Array.from(priceByTimestamp.values()).toSorted(
    (a, b) => a.timestamp - b.timestamp,
  );
  // Keep only observed timestamps; do not fill missing history with projections.
  const start = historical[0]?.timestamp ?? now;
  const current: IPtPricePoint = {
    timestamp: now,
    price: currentRate,
    source: 'current',
  };
  const projection: IPtPricePoint[] = Array.from(
    { length: PROJECTION_STEPS + 1 },
    (_, index) => {
      const fraction = index / PROJECTION_STEPS;
      return {
        timestamp: now + (end - now) * fraction,
        // Hold today's implied discount rate constant, reaching redemption
        // exactly at expiry. This illustrates convergence, not market prices.
        price:
          index === 0
            ? currentRate
            : discountedPrice(currentRate, targetRate, fraction),
        source: index === 0 ? 'current' : 'estimate',
      };
    },
  );
  const points = [...historical, ...projection];
  let low = Math.min(currentRate, targetRate);
  let high = Math.max(currentRate, targetRate);
  for (const point of historical) {
    low = Math.min(low, point.price);
    high = Math.max(high, point.price);
  }
  const padding = Math.max((high - low) * 0.16, targetRate * 0.0005);
  if (!Number.isFinite(high + padding)) return undefined;
  return {
    start,
    end,
    now,
    current,
    historical,
    projection,
    points,
    minPrice: Math.max(0, low - padding),
    maxPrice: high + padding,
  };
}

export type IPtPriceChart = NonNullable<ReturnType<typeof buildPtPriceChart>>;

function discountedPrice(current: number, target: number, fraction: number) {
  if (fraction >= 1) return target;
  return Math.exp(
    Math.log(current) * (1 - fraction) + Math.log(target) * fraction,
  );
}

export function getPtPriceAtTime(model: IPtPriceChart, timestamp: number) {
  if (timestamp < model.start || timestamp > model.end) return undefined;
  if (timestamp > model.now) {
    return {
      timestamp,
      price: discountedPrice(
        model.current.price,
        model.projection[model.projection.length - 1].price,
        (timestamp - model.now) / (model.end - model.now),
      ),
      source: 'estimate' as const,
    };
  }
  return findNearestPoint([...model.historical, model.current], timestamp);
}

export function findNearestPoint(points: IPtPricePoint[], timestamp: number) {
  return points.reduce<IPtPricePoint | undefined>(
    (nearest, point) =>
      !nearest ||
      Math.abs(point.timestamp - timestamp) <
        Math.abs(nearest.timestamp - timestamp)
        ? point
        : nearest,
    undefined,
  );
}
