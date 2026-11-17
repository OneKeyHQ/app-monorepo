import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { DEVICE_STAGE_DISCONNECTED_CODES } from '@onekeyhq/shared/src/hardware/deviceStageErrorCodes';
import { isTransientNetworkLikeError } from '@onekeyhq/shared/src/utils/transientNetworkErrorUtils';
import type { IDeviceStageAuthFailureReasonValue } from '@onekeyhq/shared/types/deviceStage';

/**
 * The device vanished mid-check: the transport died, the initial reach
 * found nothing, or another call took the device away. Nothing to
 * continue with — the card offers Retry alone.
 */
const DEVICE_GONE_CODES = [
  HardwareErrorCode.DeviceNotFound,
  HardwareErrorCode.DeviceInterruptedFromOutside,
  ...DEVICE_STAGE_DISCONNECTED_CODES,
];

/** The HTTP statuses that read as "the server could not serve this
 * request right now" — the only server-side failures that open the
 * bypass. A server that answered and refused (403, a business code on a
 * 200) reached a verdict against the request; that stays strict. */
function isTransientHttpStatus(status: unknown): boolean {
  return (
    typeof status === 'number' &&
    ((status >= 500 && status < 600) || status === 408 || status === 429)
  );
}

/**
 * Sorts a thrown authenticity-check error by whose fault the check did
 * not stand (OK-62484), the one rule behind the card's exits:
 *
 * - The server reached a verdict against the device, or the device is a
 *   known-defective batch → terminal, Support only.
 * - The device vanished → `disconnected`, Retry only.
 * - The device did its part and our side could not finish (the server
 *   down or unreachable from the request layer) → `unavailable` /
 *   `network`, Retry or Continue anyway behind the NOTE.
 * - Anything else — the device stayed on the line yet the check failed,
 *   an in-call timeout included — → `unknown`, Retry and Support, never
 *   a bypass (OK-61777): a connected device that will not prove itself
 *   is exactly what a counterfeit would do.
 *
 * Only the request layer speaks for "our side": a transient HTTP status
 * or the axios transport family. A server API error is judged by its
 * status alone — the class covers rejections too, and a rejection is a
 * verdict, not an outage. The SDK's own NetworkError / BridgeNetworkError
 * rise from the device transport during the certificate read, before any
 * server call, so they land with the other in-call failures.
 */
export function classifyAuthFailureError(
  error: IOneKeyError | undefined,
): IDeviceStageAuthFailureReasonValue {
  const httpStatusCode = (error as { httpStatusCode?: number } | undefined)
    ?.httpStatusCode;
  if (isTransientHttpStatus(httpStatusCode)) {
    return 'unavailable';
  }
  if (error?.className === EOneKeyErrorClassNames.OneKeyServerApiError) {
    return 'unknown';
  }
  if (error?.code === HardwareErrorCode.DefectiveFirmware) {
    return 'defective';
  }
  if (error?.code === HardwareErrorCode.NotAllowInBootloaderMode) {
    return 'unofficialDevice';
  }
  if (isHardwareErrorByCode({ error, code: DEVICE_GONE_CODES })) {
    return 'disconnected';
  }
  if (isTransientNetworkLikeError(error)) {
    return 'network';
  }
  return 'unknown';
}

/** The reasons whose card may offer Continue anyway outside developer
 * mode: only where the device cannot be what stopped the check. */
export function authFailureAllowsContinue(
  reason: IDeviceStageAuthFailureReasonValue | undefined,
): boolean {
  return reason === 'network' || reason === 'unavailable';
}
