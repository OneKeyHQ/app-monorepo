import BigNumber from 'bignumber.js';

import { formatLocalizedNumberString } from './numberUtils';

export const TWAP_MIN_DURATION_MINUTES = 5;
export const TWAP_MAX_DURATION_MINUTES = 7 * 24 * 60;
export const TWAP_MIN_ORDER_NOTIONAL = 100;

export type ITwapRuntimeStatus =
  | 'activated'
  | 'error'
  | 'finished'
  | 'stopped'
  | 'terminated'
  | 'waitingForTrigger';

export type IActiveTwapRuntimeInfo = {
  reportedStatus: 'activated' | 'waitingForTrigger';
  activatedAt?: number;
};

export function getTwapRuntimeInfoKey(state: {
  coin: string;
  timestamp: number;
}): string {
  return `${state.coin}:${state.timestamp}`;
}

function normalizeTwapHistoryTimeMs(time: number): number {
  return time > 1_000_000_000_000 ? time : time * 1000;
}

export function buildActiveTwapRuntimeInfoByKey(
  records: readonly {
    time: number;
    state: {
      coin: string;
      timestamp: number;
    };
    status: { status: ITwapRuntimeStatus };
  }[],
): Map<string, IActiveTwapRuntimeInfo> {
  const latestRecordByKey = new Map<string, (typeof records)[number]>();
  records.forEach((record) => {
    const key = getTwapRuntimeInfoKey(record.state);
    const previous = latestRecordByKey.get(key);
    if (!previous || record.time > previous.time) {
      latestRecordByKey.set(key, record);
    }
  });
  return new Map(
    Array.from(latestRecordByKey.entries()).map(([key, record]) => [
      key,
      {
        reportedStatus:
          record.status.status === 'waitingForTrigger'
            ? 'waitingForTrigger'
            : 'activated',
        activatedAt:
          record.status.status === 'activated'
            ? normalizeTwapHistoryTimeMs(record.time)
            : undefined,
      },
    ]),
  );
}

export function getActiveTwapRuntimeStatus({
  reportedStatus,
  triggerPrice,
  executedSize,
}: {
  reportedStatus?: 'activated' | 'waitingForTrigger';
  triggerPrice?: string | null;
  executedSize: BigNumber.Value;
}): 'activated' | 'waitingForTrigger' {
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

export function getTwapTriggerReferencePrice({
  isSpot,
  midPrice,
  markPrice,
}: {
  isSpot: boolean;
  midPrice: BigNumber.Value;
  markPrice?: BigNumber.Value;
}): BigNumber {
  if (isSpot) {
    return new BigNumber(midPrice);
  }
  return new BigNumber(markPrice ?? '');
}

export function formatTwapPriceForDisplay(price?: string | null): string {
  const priceBN = new BigNumber(price ?? '');
  if (!priceBN.isFinite() || priceBN.lte(0)) {
    return '--';
  }
  return formatLocalizedNumberString(priceBN.toFixed());
}

export function isValidTwapDuration(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= TWAP_MIN_DURATION_MINUTES &&
    minutes <= TWAP_MAX_DURATION_MINUTES
  );
}

export function isTwapTotalNotionalValid({
  size,
  price,
}: {
  size: BigNumber.Value;
  price: BigNumber.Value;
}): boolean {
  const sizeBN = new BigNumber(size);
  const priceBN = new BigNumber(price);
  if (
    !sizeBN.isFinite() ||
    !priceBN.isFinite() ||
    sizeBN.lte(0) ||
    priceBN.lte(0)
  ) {
    return false;
  }
  return sizeBN.multipliedBy(priceBN).gte(TWAP_MIN_ORDER_NOTIONAL);
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

export function getTwapElapsedMs({
  status,
  timestamp,
  activatedAt,
  now,
  endTime,
  minutes,
}: {
  status?: ITwapRuntimeStatus;
  timestamp: number;
  activatedAt?: number;
  now: number;
  endTime?: number;
  minutes: number;
}): number {
  if (status === 'waitingForTrigger') {
    return 0;
  }
  const totalMs = Math.max(0, minutes) * 60_000;
  return Math.min(
    Math.max((endTime ?? now) - (activatedAt ?? timestamp), 0),
    totalMs,
  );
}
