import { isRetryableLightningInvoiceDecodeFailure } from '@onekeyhq/shared/src/errors';
import { getRetryAfterOnError } from '@onekeyhq/shared/src/request/retryAfterUtils';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';

export type ILightningRetryDeadline = {
  monotonicAt: number;
  wallAt: number;
  serverAt?: number;
};

export function getLightningRetryDeadline(
  error: unknown,
  minimumDelayMs: number,
): ILightningRetryDeadline | undefined {
  if (!isRetryableLightningInvoiceDecodeFailure(error)) return undefined;
  const estimated = systemTimeUtils.getContinuousEstimatedServerTime();
  const { responseTime, delayMs } = getRetryAfterOnError(
    error,
    minimumDelayMs,
    estimated,
  );
  const serverTime = estimated ?? responseTime;
  return {
    monotonicAt: performance.now() + delayMs,
    wallAt: Date.now() + delayMs,
    serverAt: serverTime === undefined ? undefined : serverTime + delayMs,
  };
}

export async function isLightningRetryPending(
  deadline: ILightningRetryDeadline,
) {
  if (performance.now() >= deadline.monotonicAt) return false;
  if (deadline.serverAt === undefined) return true;
  let serverTime = systemTimeUtils.getContinuousEstimatedServerTime();
  // Only a trusted clock can shorten the monotonic backoff after suspend.
  if (serverTime === undefined && Date.now() >= deadline.wallAt) {
    serverTime = await systemTimeUtils.getFreshEstimatedServerTime();
  }
  return serverTime === undefined || serverTime < deadline.serverAt;
}
