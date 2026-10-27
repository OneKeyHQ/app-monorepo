import BigNumber from 'bignumber.js';

import { ETranslations } from '../locale/enum/translations';

import { formatLocalizedNumberString, numberFormat } from './numberUtils';
import { formatHlPrice, formatHlSize, getMinimumOrderSize } from './perpsUtils';

export const TWAP_MIN_DURATION_MINUTES = 5;
export const TWAP_MAX_DURATION_MINUTES = 7 * 24 * 60;
export const TWAP_MIN_ORDER_NOTIONAL = 100;
const TWAP_ESTIMATED_SLICE_INTERVAL_SECONDS = 30;
const TWAP_ESTIMATED_MIN_SLICE_NOTIONAL = 10;

export type ITwapRuntimeStatus =
  | 'activated'
  | 'error'
  | 'finished'
  | 'stopped'
  | 'terminated'
  | 'waitingForTrigger';

export type IActiveTwapRuntimeInfo = {
  reportedStatus: ITwapRuntimeStatus;
  activatedAt?: number;
};

function normalizeTwapHistoryTimeMs(time: number): number {
  return time > 1_000_000_000_000 ? time : time * 1000;
}

export function buildActiveTwapRuntimeInfoById(
  records: readonly {
    twapId?: number;
    time: number;
    state: {
      coin: string;
      timestamp: number;
    };
    status: { status: ITwapRuntimeStatus };
  }[],
): Map<number, IActiveTwapRuntimeInfo> {
  const latestRecordById = new Map<number, (typeof records)[number]>();
  const activationTimeById = new Map<number, number>();
  records.forEach((record) => {
    const { twapId } = record;
    // Legacy events without an ID cannot safely be attributed to an order.
    if (twapId === undefined) return;
    if (record.status.status === 'activated') {
      const activatedAt = normalizeTwapHistoryTimeMs(record.time);
      activationTimeById.set(
        twapId,
        Math.min(activationTimeById.get(twapId) ?? activatedAt, activatedAt),
      );
    }
    const previous = latestRecordById.get(twapId);
    if (!previous || record.time > previous.time) {
      latestRecordById.set(twapId, record);
    }
  });
  return new Map(
    Array.from(latestRecordById.entries()).map(([twapId, record]) => [
      twapId,
      {
        reportedStatus: record.status.status,
        activatedAt: activationTimeById.get(twapId),
      },
    ]),
  );
}

export function isTerminalTwapStatus(status?: ITwapRuntimeStatus): boolean {
  return (
    status === 'finished' ||
    status === 'stopped' ||
    status === 'terminated' ||
    status === 'error'
  );
}

export function getActiveTwapRuntimeStatus({
  reportedStatus,
  triggerPrice,
  executedSize,
}: {
  reportedStatus?: ITwapRuntimeStatus;
  triggerPrice?: string | null;
  executedSize: BigNumber.Value;
}): ITwapRuntimeStatus {
  if (reportedStatus && isTerminalTwapStatus(reportedStatus)) {
    return reportedStatus;
  }
  const executedSizeBN = new BigNumber(executedSize);
  if (executedSizeBN.isFinite() && executedSizeBN.gt(0)) {
    return 'activated';
  }
  if (reportedStatus) {
    return reportedStatus;
  }
  return triggerPrice && executedSizeBN.isFinite() && executedSizeBN.isZero()
    ? 'waitingForTrigger'
    : 'activated';
}

export function formatTwapPriceForDisplay(price?: string | null): string {
  const priceBN = new BigNumber(price ?? '');
  if (!priceBN.isFinite() || priceBN.lte(0)) {
    return '--';
  }
  return formatLocalizedNumberString(priceBN.toFixed());
}

export function formatTwapPriceForOrder({
  price,
  szDecimals,
  assetType,
}: {
  price?: string;
  szDecimals: number;
  assetType: 'perp' | 'spot';
}): string | undefined {
  const trimmedPrice = price?.trim();
  return trimmedPrice
    ? formatHlPrice(trimmedPrice, szDecimals, assetType) || undefined
    : undefined;
}

export function isValidTwapDuration(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= TWAP_MIN_DURATION_MINUTES &&
    minutes <= TWAP_MAX_DURATION_MINUTES
  );
}

function getTwapTruncatedNotional({
  size,
  price,
  szDecimals,
}: {
  size: BigNumber.Value;
  price: BigNumber.Value;
  szDecimals: number;
}): BigNumber | undefined {
  const sizeBN = new BigNumber(formatHlSize(size, szDecimals));
  const priceBN = new BigNumber(price);
  if (
    !sizeBN.isFinite() ||
    !priceBN.isFinite() ||
    sizeBN.lte(0) ||
    priceBN.lte(0)
  ) {
    return undefined;
  }
  return sizeBN.multipliedBy(priceBN);
}

export function formatTwapMinimumOrderNotional({
  price,
  szDecimals,
}: {
  price: BigNumber.Value;
  szDecimals: number;
}): string {
  const size = getMinimumOrderSize({
    price,
    szDecimals,
    minimumNotional: TWAP_MIN_ORDER_NOTIONAL,
  });
  return formatLocalizedNumberString(
    size
      ? size.multipliedBy(price).toFixed(2, BigNumber.ROUND_CEIL)
      : String(TWAP_MIN_ORDER_NOTIONAL),
  );
}

export function isTwapTotalNotionalValid(params: {
  size: BigNumber.Value;
  price: BigNumber.Value;
  szDecimals: number;
}): boolean {
  return (
    getTwapTruncatedNotional(params)?.gte(TWAP_MIN_ORDER_NOTIONAL) ?? false
  );
}

// Mirrors app.hyperliquid.xyz: one slice per 30s plus the opening slice,
// raised to $10 per slice and capped at the whole order. Randomize and
// catch-up after unfilled slices make actual slices differ.
export function getTwapEstimatedSliceSize({
  size,
  midPrice,
  szDecimals,
  durationMinutes,
}: {
  size: BigNumber.Value;
  midPrice: BigNumber.Value;
  szDecimals: number;
  durationMinutes: number;
}): BigNumber | undefined {
  const midPriceBN = new BigNumber(midPrice);
  const notionalBN = getTwapTruncatedNotional({
    size,
    price: midPriceBN,
    szDecimals,
  });
  if (!notionalBN || !isValidTwapDuration(durationMinutes)) {
    return undefined;
  }
  const sliceCount =
    Math.floor((durationMinutes * 60) / TWAP_ESTIMATED_SLICE_INTERVAL_SECONDS) +
    1;
  return BigNumber.min(
    notionalBN,
    BigNumber.max(
      notionalBN.dividedBy(sliceCount),
      TWAP_ESTIMATED_MIN_SLICE_NOTIONAL,
    ),
  ).dividedBy(midPriceBN);
}

export function formatTwapEstimatedSliceSize({
  symbol,
  ...params
}: Parameters<typeof getTwapEstimatedSliceSize>[0] & {
  symbol: string;
}): string | undefined {
  const sizeBN = new BigNumber(params.size);
  if (sizeBN.isZero()) {
    return `≈ 0 ${symbol}`;
  }
  const sliceSizeBN = getTwapEstimatedSliceSize(params);
  if (!sliceSizeBN) {
    return undefined;
  }
  return `≈ ${numberFormat(sliceSizeBN.toFixed(), {
    formatter: 'balance',
  })} ${symbol}`;
}

export function getTwapTriggerAbove({
  triggerPrice,
  markPrice,
}: {
  triggerPrice: BigNumber.Value;
  markPrice: BigNumber.Value;
}): boolean | undefined {
  const triggerPriceBN = new BigNumber(triggerPrice);
  const markPriceBN = new BigNumber(markPrice);
  if (
    !triggerPriceBN.isFinite() ||
    !markPriceBN.isFinite() ||
    triggerPriceBN.lte(0) ||
    markPriceBN.lte(0) ||
    triggerPriceBN.eq(markPriceBN)
  ) {
    return undefined;
  }
  return triggerPriceBN.gt(markPriceBN);
}

export function isTwapStopPriceValid({
  isBuy,
  stopPrice,
  referencePrice,
  triggerPrice,
}: {
  isBuy: boolean;
  stopPrice: BigNumber.Value;
  referencePrice: BigNumber.Value;
  triggerPrice?: BigNumber.Value;
}): boolean {
  const stopPriceBN = new BigNumber(stopPrice);
  const referencePriceBN = new BigNumber(referencePrice);
  const triggerPriceBN =
    triggerPrice === undefined || triggerPrice === ''
      ? referencePriceBN
      : new BigNumber(triggerPrice);
  if (
    !stopPriceBN.isFinite() ||
    !referencePriceBN.isFinite() ||
    !triggerPriceBN.isFinite() ||
    stopPriceBN.lte(0) ||
    referencePriceBN.lte(0) ||
    triggerPriceBN.lte(0)
  ) {
    return false;
  }
  const activationBoundary = triggerPriceBN;
  return isBuy
    ? stopPriceBN.gt(activationBoundary)
    : stopPriceBN.lt(activationBoundary);
}

export function getTwapStopPriceErrorKey({
  isBuy,
  triggerPrice,
}: {
  isBuy: boolean;
  triggerPrice?: string;
}): ETranslations {
  if (triggerPrice) {
    return isBuy
      ? ETranslations.perp_twap_max_price_above_trigger__msg
      : ETranslations.perp_twap_min_price_below_trigger__msg;
  }
  return isBuy
    ? ETranslations.perp_twap_max_price_above_mark__msg
    : ETranslations.perp_twap_min_price_below_mark__msg;
}

export function getTwapElapsedMs({
  status,
  timestamp,
  activatedAt,
  triggerPrice,
  now,
  endTime,
  minutes,
}: {
  status?: ITwapRuntimeStatus;
  timestamp: number;
  activatedAt?: number;
  triggerPrice?: string | null;
  now: number;
  endTime?: number;
  minutes: number;
}): number | undefined {
  if (status === 'waitingForTrigger') {
    return 0;
  }
  // Creation can precede activation by days; wait for the history timestamp.
  if (triggerPrice && activatedAt === undefined) {
    return undefined;
  }
  const totalMs = Math.max(0, minutes) * 60_000;
  return Math.min(
    Math.max((endTime ?? now) - (activatedAt ?? timestamp), 0),
    totalMs,
  );
}
