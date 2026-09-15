import {
  getAvailabilityErrorCode,
  isAvailabilityCancelError,
} from '@onekeyhq/shared/src/request/availabilityMetrics';
import type { IAvailabilityFlowResult } from '@onekeyhq/shared/src/request/availabilityMetrics';

export type IScanQrCodeAvailabilityScene = 'general' | 'qr_wallet';

export type IScanQrCodeCallbackResult = {
  progress?: number;
  retry?: boolean;
};

export function getScanQrCodeAvailabilityScene(
  qrWalletScene: boolean | undefined,
): IScanQrCodeAvailabilityScene {
  return qrWalletScene ? 'qr_wallet' : 'general';
}

export function getQrScanFlowErrorResult(
  error: unknown,
): IAvailabilityFlowResult {
  return {
    status: isAvailabilityCancelError(error) ? 'cancelled' : 'failed',
    errorCode: getAvailabilityErrorCode(error),
  };
}

/**
 * Animated (UR) codes report `progress < 1` and rejected frames ask for a
 * `retry`: the camera keeps scanning instead of finishing the flow.
 */
export function isCameraScanExpectingMoreFrames(
  result: IScanQrCodeCallbackResult | undefined,
): boolean {
  return (
    !!result?.retry ||
    (typeof result?.progress === 'number' && result.progress < 1)
  );
}

/**
 * Outcome for the camera flow once the route callback resolved for a scanned
 * value, or `undefined` while the flow must stay open. A rejected callback is
 * classified by `getQrScanFlowErrorResult` instead.
 */
export function getCameraScanFlowResult({
  value,
  result,
  isFlowCurrent,
  pendingScans,
}: {
  value: string;
  result: IScanQrCodeCallbackResult | undefined;
  /** False once the modal that started the flow has unmounted. */
  isFlowCurrent: boolean;
  /** Scans of the same flow still awaiting the route callback. */
  pendingScans: number;
}): IAvailabilityFlowResult | undefined {
  // The scanner reports '' when it unmounts without having admitted a frame.
  if (!value) {
    return { status: 'cancelled' };
  }
  if (!isCameraScanExpectingMoreFrames(result)) {
    return { status: 'ok' };
  }
  if (!isFlowCurrent && pendingScans === 0) {
    // The modal closed while waiting for the next frame.
    return { status: 'cancelled' };
  }
  return undefined;
}

/**
 * A scan still awaiting the route callback (which may close the modal itself)
 * reports the outcome instead of the unmount.
 */
export function getCameraFlowUnmountResult({
  pendingScans,
}: {
  pendingScans: number;
}): IAvailabilityFlowResult | undefined {
  return pendingScans === 0 ? { status: 'cancelled' } : undefined;
}

/**
 * Library outcomes that are not a thrown picker or route callback error; those
 * are classified by `getQrScanFlowErrorResult`.
 */
export type ILibraryScanSettlement =
  | { type: 'pickerCancelled' }
  | {
      type: 'noCode';
      /** Error thrown by the decoder, if any. */
      scanError?: unknown;
    }
  | { type: 'callbackResolved' };

export function getLibraryScanFlowResult(
  settlement: ILibraryScanSettlement,
): IAvailabilityFlowResult {
  switch (settlement.type) {
    case 'pickerCancelled':
      return { status: 'cancelled' };
    case 'noCode':
      // A decoder error is never classified as a user cancellation.
      return settlement.scanError
        ? {
            status: 'failed',
            errorCode: getAvailabilityErrorCode(settlement.scanError),
          }
        : { status: 'no_code' };
    case 'callbackResolved':
      return { status: 'ok' };
    default: {
      const unexpected: never = settlement;
      return unexpected;
    }
  }
}
