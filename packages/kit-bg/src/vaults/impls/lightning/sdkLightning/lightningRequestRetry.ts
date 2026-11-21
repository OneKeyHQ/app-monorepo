import { isRetryableLightningInvoiceDecodeFailure } from '@onekeyhq/shared/src/errors';
import {
  getRetryAfterOnError,
  getUnanchoredRetryDelayMs,
} from '@onekeyhq/shared/src/request/retryAfterUtils';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

const minUnanchoredRetryMs = timerUtils.getTimeDurationMs({ minute: 1 });
const maxUnanchoredRetryMs = timerUtils.getTimeDurationMs({ minute: 5 });

export type ILightningRetryDeadline = {
  monotonicAt: number;
  wallAt: number;
  serverAt?: number;
  unanchoredUntil?: number;
};

export function getLightningRetryDeadline(
  error: unknown,
  minimumDelayMs: number,
): ILightningRetryDeadline | undefined {
  if (!isRetryableLightningInvoiceDecodeFailure(error)) return undefined;
  const estimated = systemTimeUtils.getContinuousEstimatedServerTime();
  const { responseTime, absoluteAt, delayMs } = getRetryAfterOnError(
    error,
    minimumDelayMs,
    estimated,
  );
  const serverTime = estimated ?? responseTime;
  const monotonicNow = performance.now();
  let unanchoredUntil: number | undefined;
  if (absoluteAt !== undefined && serverTime === undefined) {
    const fallbackDelay = getUnanchoredRetryDelayMs({
      absoluteAt,
      minimumDelayMs: minUnanchoredRetryMs,
      maximumDelayMs: maxUnanchoredRetryMs,
    });
    unanchoredUntil = monotonicNow + Math.max(delayMs, fallbackDelay);
  }
  return {
    monotonicAt: monotonicNow + delayMs,
    wallAt: Date.now() + delayMs,
    serverAt: serverTime === undefined ? absoluteAt : serverTime + delayMs,
    unanchoredUntil,
  };
}

export async function isLightningRetryPending(
  deadline: ILightningRetryDeadline,
) {
  const monotonicNow = performance.now();
  const elapsed = monotonicNow >= deadline.monotonicAt;
  const { unanchoredUntil } = deadline;
  if (unanchoredUntil !== undefined) {
    if (!elapsed) return true;
  } else if (elapsed) return false;
  if (deadline.serverAt === undefined) return true;
  let serverTime = systemTimeUtils.getContinuousEstimatedServerTime();
  // Only a trusted clock can shorten the monotonic backoff after suspend.
  const shouldRefreshTime =
    unanchoredUntil === undefined
      ? Date.now() >= deadline.wallAt
      : monotonicNow < unanchoredUntil;
  if (serverTime === undefined && shouldRefreshTime) {
    serverTime = await systemTimeUtils.getFreshEstimatedServerTime();
  }
  if (serverTime !== undefined) return serverTime < deadline.serverAt;
  // Without an anchor, let the caller's single in-flight request probe recovery.
  return unanchoredUntil === undefined || performance.now() < unanchoredUntil;
}
