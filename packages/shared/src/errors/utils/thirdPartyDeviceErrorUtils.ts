import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import * as ThirdPartyErrors from '../errors/thirdPartyHardwareErrors';

import type {
  IOneKeyError,
  IOneKeyHardwareErrorPayload,
} from '../types/errorTypes';

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
  payload: {
    error: string;
    code: number;
    appName?: string;
    params?: IOneKeyHardwareErrorPayload['params'];
  },
  context?: IThirdPartyErrorContext,
) {
  const hwPayload: IOneKeyHardwareErrorPayload = {
    code: payload.code,
    message: payload.error,
    params: payload.params,
  };
  const props = {
    payload: hwPayload,
    ...context,
    appName: payload.appName,
  };

  switch (payload.code) {
    // EVM-specific (chain-specific copy, production-validated)
    case ThirdPartyHwErrorCode.EvmBlindSigningRequired:
      return new ThirdPartyErrors.ThirdPartyEvmBlindSigningRequired(props);
    case ThirdPartyHwErrorCode.EvmClearSignPluginMissing:
      return new ThirdPartyErrors.ThirdPartyEvmClearSignPluginMissing(props);
    case ThirdPartyHwErrorCode.EvmDataTooLarge:
      return new ThirdPartyErrors.ThirdPartyEvmDataTooLarge(props);
    case ThirdPartyHwErrorCode.EvmTxTypeNotSupported:
      return new ThirdPartyErrors.ThirdPartyEvmTxTypeNotSupported(props);
    case ThirdPartyHwErrorCode.AppTooOld:
      return new ThirdPartyErrors.ThirdPartyAppTooOld(props);

    // Non-EVM generic: "Please enable Blind signing and follow device prompts"
    case ThirdPartyHwErrorCode.SolanaBlindSigningRequired:
    case ThirdPartyHwErrorCode.TronCustomContractRequired:
    case ThirdPartyHwErrorCode.TronDataSigningRequired:
    case ThirdPartyHwErrorCode.TronSignByHashRequired:
      return new ThirdPartyErrors.ThirdPartyEnableBlindSigning({
        ...props,
        code: payload.code,
      });

    // Non-EVM generic: "This operation is not supported on your Ledger device"
    case ThirdPartyHwErrorCode.BtcWalletPolicyHmacMismatch:
    case ThirdPartyHwErrorCode.BtcUnexpectedState:
      return new ThirdPartyErrors.ThirdPartyFeatureNotSupported({
        ...props,
        code: payload.code,
      });

    case ThirdPartyHwErrorCode.AppNotInstalled:
      return new ThirdPartyErrors.ThirdPartyAppNotInstalled(props);

    case ThirdPartyHwErrorCode.UserRejected:
      return new ThirdPartyErrors.ThirdPartyUserRejected(props);

    case ThirdPartyHwErrorCode.UserAborted:
      return new ThirdPartyErrors.ThirdPartyUserAborted(props);

    case ThirdPartyHwErrorCode.DevicePermissionDenied:
      return new ThirdPartyErrors.ThirdPartyDevicePermissionDenied({
        ...props,
        reason: payload.params?.permissionDeniedReason,
      });

    case ThirdPartyHwErrorCode.DeviceLocked:
      return new ThirdPartyErrors.ThirdPartyDeviceLocked(props);

    case ThirdPartyHwErrorCode.WrongApp:
      return new ThirdPartyErrors.ThirdPartyWrongApp(props);

    case ThirdPartyHwErrorCode.DeviceDisconnected:
      return new ThirdPartyErrors.ThirdPartyDeviceDisconnected(props);

    case ThirdPartyHwErrorCode.DeviceMismatch:
      return new ThirdPartyErrors.ThirdPartyDeviceMismatch(props);

    case ThirdPartyHwErrorCode.DeviceAppStuck:
      return new ThirdPartyErrors.ThirdPartyDeviceAppStuck(props);

    case ThirdPartyHwErrorCode.ChainNotSupported:
      return new ThirdPartyErrors.ThirdPartyChainNotSupported(props);

    case ThirdPartyHwErrorCode.OperationTimeout:
      return new ThirdPartyErrors.ThirdPartyOperationTimeout(props);

    case ThirdPartyHwErrorCode.BlePairingTimeout:
      return new ThirdPartyErrors.ThirdPartyBlePairingTimeout(props);

    case ThirdPartyHwErrorCode.MethodNotSupported:
      return new ThirdPartyErrors.ThirdPartyMethodNotSupported(props);

    case ThirdPartyHwErrorCode.DeviceNotFound:
      return new ThirdPartyErrors.ThirdPartyDeviceNotFound(props);

    case ThirdPartyHwErrorCode.DeviceBusy:
      return new ThirdPartyErrors.ThirdPartyDeviceBusy(props);

    case ThirdPartyHwErrorCode.DeviceOneDeviceOnly:
      return new ThirdPartyErrors.ThirdPartyDeviceOneDeviceOnly(props);

    case ThirdPartyHwErrorCode.TransportError:
      return new ThirdPartyErrors.ThirdPartyTransportError(props);

    case ThirdPartyHwErrorCode.TransportNotAvailable:
      return new ThirdPartyErrors.ThirdPartyTransportNotAvailable(props);

    default:
      return new ThirdPartyErrors.ThirdPartyUnknownError(props);
  }
}

// Classify a third-party HW batch address-create result. Shared by the auto
// (AccountSelectorActions) and manual (useAccountSelectorCreateAddress) paths so
// the bare-device AppNotInstalled rule lives in one place.
// - allAppNotInstalled: zero chains succeeded and every failure is AppNotInstalled
//   (the device has no app for these chains).
// - genuineFailures: failures other than AppNotInstalled (surface these).
export function classifyThirdPartyHwCreateFailures<
  T extends { error: Pick<IOneKeyError, 'code'> },
>(params: {
  addedCount: number;
  failedAccounts: T[];
}): { allAppNotInstalled: boolean; genuineFailures: T[] } {
  const { addedCount, failedAccounts } = params;
  const allAppNotInstalled =
    addedCount === 0 &&
    failedAccounts.length > 0 &&
    failedAccounts.every(
      (f) => f.error.code === ThirdPartyHwErrorCode.AppNotInstalled,
    );
  const genuineFailures = failedAccounts.filter(
    (f) => f.error.code !== ThirdPartyHwErrorCode.AppNotInstalled,
  );
  return { allAppNotInstalled, genuineFailures };
}
