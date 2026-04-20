import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import * as ThirdPartyErrors from '../errors/thirdPartyHardwareErrors';
import { OneKeyThirdPartyExtHwErrorCode } from '../errors/thirdPartyHardwareErrors';

import type { IOneKeyHardwareErrorPayload } from '../types/errorTypes';

interface IThirdPartyErrorContext {
  vendor?: string;
  chain?: string;
}

/**
 * Convert a third-party hardware SDK failure payload into a structured
 * OneKeyHardwareError with i18n key and autoToast/dialog behavior.
 *
 * Usage in keyrings:
 * ```ts
 * if (!result.success) {
 *   throw convertThirdPartyDeviceError(result.payload, { vendor: 'ledger', chain: 'sol' });
 * }
 * ```
 */
export function convertThirdPartyDeviceError(
  payload: { error: string; code: number; appName?: string },
  context?: IThirdPartyErrorContext,
) {
  const hwPayload: IOneKeyHardwareErrorPayload = {
    code: payload.code,
    message: payload.error,
  };
  const props = {
    payload: hwPayload,
    ...context,
    appName: payload.appName,
  };

  // OneKey-side extended codes for vendor-specific APDU errors. The SDK
  // (@onekeyfe/hwk-ledger-adapter) is responsible for identifying these and
  // surfacing the matching numeric code — this layer only routes to i18n.
  switch (payload.code as number) {
    case OneKeyThirdPartyExtHwErrorCode.EvmBlindSigningRequired:
      return new ThirdPartyErrors.ThirdPartyEvmBlindSigningRequired(props);
    case OneKeyThirdPartyExtHwErrorCode.EvmClearSignPluginMissing:
      return new ThirdPartyErrors.ThirdPartyEvmClearSignPluginMissing(props);
    case OneKeyThirdPartyExtHwErrorCode.EvmDataTooLarge:
      return new ThirdPartyErrors.ThirdPartyEvmDataTooLarge(props);
    case OneKeyThirdPartyExtHwErrorCode.EvmTxTypeNotSupported:
      return new ThirdPartyErrors.ThirdPartyEvmTxTypeNotSupported(props);
    case OneKeyThirdPartyExtHwErrorCode.AppTooOld:
      return new ThirdPartyErrors.ThirdPartyAppTooOld(props);
    default:
      break;
  }

  switch (payload.code) {
    case ThirdPartyHwErrorCode.AppNotOpen:
      return new ThirdPartyErrors.ThirdPartyAppNotInstalled(props);

    case ThirdPartyHwErrorCode.UserRejected:
      return new ThirdPartyErrors.ThirdPartyUserRejected(props);

    case ThirdPartyHwErrorCode.DeviceLocked:
      return new ThirdPartyErrors.ThirdPartyDeviceLocked(props);

    case ThirdPartyHwErrorCode.WrongApp:
      return new ThirdPartyErrors.ThirdPartyWrongApp(props);

    case ThirdPartyHwErrorCode.DeviceDisconnected:
      return new ThirdPartyErrors.ThirdPartyDeviceDisconnected(props);

    case ThirdPartyHwErrorCode.DeviceMismatch:
      return new ThirdPartyErrors.ThirdPartyDeviceMismatch(props);

    case ThirdPartyHwErrorCode.OperationTimeout:
      return new ThirdPartyErrors.ThirdPartyOperationTimeout(props);

    case ThirdPartyHwErrorCode.MethodNotSupported:
      return new ThirdPartyErrors.ThirdPartyMethodNotSupported(props);

    default:
      return new ThirdPartyErrors.ThirdPartyUnknownError(props);
  }
}
