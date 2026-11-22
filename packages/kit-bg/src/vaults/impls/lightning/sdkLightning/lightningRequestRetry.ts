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
} & (
  | { absoluteAt?: undefined; uptimeAt?: number }
  | { absoluteAt: number; serverAt: number; unanchoredUntil?: number }
);

export async function getLightningRetryDeadline(
  error: unknown,
  minimumDelayMs: number,
): Promise<ILightningRetryDeadline | undefined> {
  if (!isRetryableLightningInvoiceDecodeFailure(error)) return undefined;
  const estimated = systemTimeUtils.getContinuousEstimatedServerTime();
  const { responseTime, absoluteAt, delayMs } = getRetryAfterOnError(
    error,
    minimumDelayMs,
    estimated,
  );
  const monotonicNow = performance.now();
  const deadline = {
    monotonicAt: monotonicNow + delayMs,
    wallAt: Date.now() + delayMs,
  };
  if (absoluteAt === undefined) {
    const uptime = await systemTimeUtils.getDesktopSystemUptimeMs();
    return {
      ...deadline,
      // Desktop uptime advances during sleep and can be rounded to seconds.
      uptimeAt: uptime === undefined ? undefined : uptime + delayMs + 1000,
    };
  }
  const serverTime = estimated ?? responseTime;
  let unanchoredUntil: number | undefined;
  if (serverTime === undefined) {
    const fallbackDelay = getUnanchoredRetryDelayMs({
      absoluteAt,
      minimumDelayMs: minUnanchoredRetryMs,
      maximumDelayMs: maxUnanchoredRetryMs,
    });
    unanchoredUntil = monotonicNow + Math.max(delayMs, fallbackDelay);
  }
  return {
    ...deadline,
    absoluteAt,
    // A corrected server estimate must still honor the absolute header.
    serverAt:
      serverTime === undefined
        ? absoluteAt
        : Math.max(serverTime + delayMs, absoluteAt),
    unanchoredUntil,
  };
}

export async function isLightningRetryPending(
  deadline: ILightningRetryDeadline,
) {
  const monotonicNow = performance.now();
  const elapsed = monotonicNow >= deadline.monotonicAt;
  if (deadline.absoluteAt === undefined) {
    if (elapsed) return false;
    if (deadline.uptimeAt === undefined || Date.now() < deadline.wallAt) {
      return true;
    }
    const uptime = await systemTimeUtils.getDesktopSystemUptimeMs();
    return (
      performance.now() < deadline.monotonicAt &&
      (uptime === undefined || uptime < deadline.uptimeAt)
    );
  }
  const { unanchoredUntil } = deadline;
  if (unanchoredUntil !== undefined && !elapsed) return true;
  let serverTime = systemTimeUtils.getContinuousEstimatedServerTime();
  if (elapsed && unanchoredUntil === undefined) {
    // The monotonic timer can expire first if its estimate was corrected back.
    return serverTime !== undefined && serverTime < deadline.absoluteAt;
  }
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
