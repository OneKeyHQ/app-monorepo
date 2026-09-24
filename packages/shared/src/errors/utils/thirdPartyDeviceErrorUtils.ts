import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import { EHardwareVendor } from '../../../types/device';
import * as ThirdPartyErrors from '../errors/thirdPartyHardwareErrors';

import type {
  IHardwareErrorRecoveryHint,
  IOneKeyError,
  IOneKeyHardwareErrorPayload,
} from '../types/errorTypes';

/** Failure payload shape shared by every third-party SDK `{ success: false }` response. */
export interface IThirdPartyDeviceErrorPayload {
  error: string;
  code: number;
  appName?: string;
  params?: IOneKeyHardwareErrorPayload['params'];
  /** Vendor SDK error tag (e.g. Ledger DMK `_tag`), forwarded verbatim. */
  _tag?: string;
  recovery?: unknown;
}

interface IThirdPartyErrorContext {
  vendor?: string;
  chain?: string;
  silentMode?: boolean;
}

// Ledger DMK tags. Kept only as a fallback for SDK builds older than the one
// that mints 10311 / 10312: those left both cases on UnknownError, so the tag
// was the sole signal. Newer builds arrive already coded and skip this.
const LEDGER_FIRMWARE_METADATA_TAGS = new Set([
  'InvalidGetFirmwareMetadataResponseError',
  'GetApplicationsMetadataTaskError',
]);
const LEDGER_SECURE_CHANNEL_TAG = 'SecureChannelError';

export function normalizeThirdPartyDeviceErrorCode(payload: {
  code: number | string | undefined;
  _tag?: string;
}): number | string | undefined {
  const code =
    typeof payload.code === 'string' ? Number(payload.code) : payload.code;
  // Reaching Ledger's catalog is a network round trip either way, so the
  // metadata code shares the network error's copy and its "fix your
  // connection, then retry" remedy.
  if (code === ThirdPartyErrors.THIRD_PARTY_HW_FIRMWARE_METADATA_ERROR_CODE) {
    return ThirdPartyErrors.THIRD_PARTY_HW_NETWORK_ERROR_CODE;
  }
  if (code === ThirdPartyHwErrorCode.UnknownError && payload._tag) {
    if (LEDGER_FIRMWARE_METADATA_TAGS.has(payload._tag)) {
      return ThirdPartyErrors.THIRD_PARTY_HW_NETWORK_ERROR_CODE;
    }
    if (payload._tag === LEDGER_SECURE_CHANNEL_TAG) {
      return ThirdPartyErrors.THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE;
    }
  }
  return Number.isFinite(code) ? code : payload.code;
}

export function isThirdPartyInstallAppUserCancelCode(code: unknown): boolean {
  return (
    (typeof code === 'string' ? Number(code) : code) ===
    ThirdPartyErrors.THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE
  );
}

const HWK_RECOVERY_SCOPES = new Set<IHardwareErrorRecoveryHint['scope']>([
  'call',
  'operation',
  'search-target',
  'transport',
  'not-recoverable',
  'unknown',
]);

export function normalizeThirdPartyHardwareRecoveryHint(
  value: unknown,
): IHardwareErrorRecoveryHint | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const scope = (value as { scope?: unknown }).scope;
  return typeof scope === 'string' &&
    HWK_RECOVERY_SCOPES.has(scope as IHardwareErrorRecoveryHint['scope'])
    ? { scope: scope as IHardwareErrorRecoveryHint['scope'] }
    : undefined;
}

export function isThirdPartyPassphraseAlwaysOnDeviceErrorCode(
  code: unknown,
): boolean {
  return (
    (typeof code === 'string' ? Number(code) : code) ===
    ThirdPartyHwErrorCode.PassphraseAlwaysOnDevice
  );
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
  payload: IThirdPartyDeviceErrorPayload,
  context?: IThirdPartyErrorContext,
) {
  const normalizedCode = normalizeThirdPartyDeviceErrorCode(payload);
  const hwPayload: IOneKeyHardwareErrorPayload = {
    code: normalizedCode,
    message: payload.error,
    params: payload.params,
    recovery: normalizeThirdPartyHardwareRecoveryHint(payload.recovery),
  };
  const props = {
    payload: hwPayload,
    ...context,
    appName: payload.appName,
  };

  switch (normalizedCode) {
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

    // Each Ledger chain app has its own signing settings.
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

    case ThirdPartyErrors.THIRD_PARTY_HW_BLE_PAIRING_CANCELLED_CODE:
      return new ThirdPartyErrors.ThirdPartyBlePairingCancelled(props);

    case ThirdPartyHwErrorCode.PinInvalid:
      return new ThirdPartyErrors.ThirdPartyPinInvalid(props);

    case ThirdPartyHwErrorCode.PinCancelled:
      return new ThirdPartyErrors.ThirdPartyPinCancelled(props);

    case ThirdPartyErrors.THIRD_PARTY_HW_PIN_MISMATCH_CODE:
      return new ThirdPartyErrors.ThirdPartyPinMismatch(props);

    case ThirdPartyHwErrorCode.PassphraseStateMismatch:
      return new ThirdPartyErrors.ThirdPartyPassphraseStateMismatch(props);

    case ThirdPartyHwErrorCode.PassphraseAlwaysOnDevice:
      return new ThirdPartyErrors.ThirdPartyPassphraseAlwaysOnDevice(props);

    case ThirdPartyHwErrorCode.PassphraseRejected:
      // User rejected the passphrase prompt on the device — surface a proper
      // user-reject error instead of falling through to the generic Unknown.
      return new ThirdPartyErrors.ThirdPartyUserRejected(props);

    case ThirdPartyErrors.THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE:
      return new ThirdPartyErrors.ThirdPartyInstallAppUserCancelled(props);

    case ThirdPartyErrors.THIRD_PARTY_HW_APP_ALREADY_INSTALLED_CODE:
      return new ThirdPartyErrors.ThirdPartyAppAlreadyInstalled(props);

    case ThirdPartyHwErrorCode.DevicePermissionDenied:
      return new ThirdPartyErrors.ThirdPartyDevicePermissionDenied({
        ...props,
        reason: payload.params?.permissionDeniedReason,
      });

    case ThirdPartyHwErrorCode.DeviceLocked:
      return new ThirdPartyErrors.ThirdPartyDeviceLocked(props);

    case ThirdPartyHwErrorCode.DeviceOutOfMemory:
      return new ThirdPartyErrors.ThirdPartyDeviceOutOfMemory(props);

    case ThirdPartyErrors.THIRD_PARTY_HW_NETWORK_ERROR_CODE:
      return new ThirdPartyErrors.ThirdPartyNetworkError(props);

    case ThirdPartyErrors.THIRD_PARTY_HW_SECURE_CHANNEL_ERROR_CODE:
      return new ThirdPartyErrors.ThirdPartySecureChannelError(props);

    case ThirdPartyHwErrorCode.WrongApp:
      return new ThirdPartyErrors.ThirdPartyWrongApp(props);

    case ThirdPartyHwErrorCode.DeviceDisconnected:
      return new ThirdPartyErrors.ThirdPartyDeviceDisconnected(props);

    case ThirdPartyErrors.THIRD_PARTY_HW_OPERATION_NOT_FOUND_CODE:
      return new ThirdPartyErrors.ThirdPartyOperationNotFound(props);

    case ThirdPartyErrors.THIRD_PARTY_HW_OPERATION_ENDED_CODE:
      return new ThirdPartyErrors.ThirdPartyOperationEnded(props);

    case ThirdPartyHwErrorCode.DeviceMismatch:
      return new ThirdPartyErrors.ThirdPartyDeviceMismatch(props);

    // A cable swap and a re-scan are different remedies, so this is its own
    // code rather than a flag on DeviceMismatch.
    case ThirdPartyHwErrorCode.DeviceSearchMismatch:
      return new ThirdPartyErrors.ThirdPartyDeviceSearchMismatch(props);

    case ThirdPartyHwErrorCode.DeviceAppStuck:
      return new ThirdPartyErrors.ThirdPartyDeviceAppStuck(props);

    case ThirdPartyHwErrorCode.ChainNotSupported:
      return new ThirdPartyErrors.ThirdPartyChainNotSupported(props);

    case ThirdPartyHwErrorCode.OperationTimeout:
      return new ThirdPartyErrors.ThirdPartyOperationTimeout(props);

    case ThirdPartyHwErrorCode.BlePairingTimeout:
      return new ThirdPartyErrors.ThirdPartyBlePairingTimeout(props);

    case ThirdPartyHwErrorCode.BleBondInvalid:
      return new ThirdPartyErrors.ThirdPartyBleBondInvalid(props);

    case ThirdPartyHwErrorCode.ThpPairingFailed:
      return new ThirdPartyErrors.ThirdPartyThpPairingFailed(props);

    case ThirdPartyHwErrorCode.ThpPairingRequired:
      return new ThirdPartyErrors.ThirdPartyThpPairingRequired(props);

    case ThirdPartyErrors.THIRD_PARTY_HW_DEVICE_PATH_FORBIDDEN_CODE:
      return new ThirdPartyErrors.ThirdPartyPathForbidden(props);

    case ThirdPartyErrors.THIRD_PARTY_HW_BLE_CONNECT_FAILED_CODE:
      return new ThirdPartyErrors.ThirdPartyBleConnectFailed(props);

    // The device or SDK refused the request as malformed (e.g. Keystone's
    // PRS_PARSING_ERROR); retrying the same request cannot help.
    case ThirdPartyHwErrorCode.InvalidParams:
    case ThirdPartyHwErrorCode.MethodNotSupported:
      return new ThirdPartyErrors.ThirdPartyMethodNotSupported(props);

    case ThirdPartyHwErrorCode.DeviceNotFound:
      return new ThirdPartyErrors.ThirdPartyDeviceNotFound(props);

    case ThirdPartyHwErrorCode.DeviceBusy:
      return new ThirdPartyErrors.ThirdPartyDeviceBusy(props);

    case ThirdPartyHwErrorCode.DeviceBusyInternal:
      return new ThirdPartyErrors.ThirdPartyDeviceBusyInternal(props);

    case ThirdPartyHwErrorCode.DeviceNotInitialized:
      return new ThirdPartyErrors.ThirdPartyDeviceNotInitialized(props);

    case ThirdPartyHwErrorCode.DeviceOneDeviceOnly:
      return new ThirdPartyErrors.ThirdPartyDeviceOneDeviceOnly(props);

    case ThirdPartyHwErrorCode.TransportError:
      return new ThirdPartyErrors.ThirdPartyTransportError(props);

    case ThirdPartyHwErrorCode.TransportNotAvailable:
      return new ThirdPartyErrors.ThirdPartyTransportNotAvailable(props);

    case ThirdPartyHwErrorCode.PayloadTooLarge:
      return new ThirdPartyErrors.ThirdPartyPayloadTooLarge(props);

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
  const genuineFailures = failedAccounts.filter((f) => {
    if (f.error.code === ThirdPartyHwErrorCode.AppNotInstalled) return false;
    if (isThirdPartyInstallAppUserCancelCode(f.error.code)) return false;
    // If at least one chain succeeded, transient mid-flow re-pair errors with
    // changed BLE/USB connectId shouldn't fail the flow.
    if (
      addedCount > 0 &&
      f.error.code === ThirdPartyHwErrorCode.DeviceNotFound
    ) {
      return false;
    }
    return true;
  });
  return { allAppNotInstalled, genuineFailures };
}

export function shouldOfferLedgerCoreAppInstallForCreateFailures(params: {
  vendor: EHardwareVendor | undefined;
  allAppNotInstalled: boolean;
  isAutoCreateMultiNetwork: boolean;
}): boolean {
  return (
    params.vendor === EHardwareVendor.ledger &&
    params.allAppNotInstalled &&
    params.isAutoCreateMultiNetwork
  );
}

export function filterThirdPartyHwCreateFailureToasts<
  T extends { error: Pick<IOneKeyError, 'autoToast' | 'code'> },
>(failedAccounts: T[]): T[] {
  let deviceOutOfMemoryShown = false;
  let passphraseAlwaysOnDeviceShown = false;
  return failedAccounts.filter((failedAccount) => {
    if (isThirdPartyInstallAppUserCancelCode(failedAccount.error.code)) {
      return false;
    }
    if (failedAccount.error.autoToast === false) {
      return false;
    }
    if (failedAccount.error.code === ThirdPartyHwErrorCode.DeviceOutOfMemory) {
      if (deviceOutOfMemoryShown) {
        return false;
      }
      deviceOutOfMemoryShown = true;
    }
    if (
      isThirdPartyPassphraseAlwaysOnDeviceErrorCode(failedAccount.error.code)
    ) {
      if (passphraseAlwaysOnDeviceShown) {
        return false;
      }
      passphraseAlwaysOnDeviceShown = true;
    }
    return true;
  });
}
