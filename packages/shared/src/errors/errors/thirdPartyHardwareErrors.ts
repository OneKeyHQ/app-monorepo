/* eslint-disable max-classes-per-file */
import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import { ETranslations } from '../../locale';
import { EOneKeyErrorClassNames } from '../types/errorTypes';
import { normalizeErrorProps } from '../utils/errorUtils';

import { OneKeyHardwareError } from './hardwareErrors';

import type { IOneKeyErrorHardwareProps } from './hardwareErrors';

export const THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE = 10_504;

// ---------------------------------------------------------------------------
// Base class for third-party hardware errors
// ---------------------------------------------------------------------------

export class ThirdPartyHardwareError extends OneKeyHardwareError {
  override className = EOneKeyErrorClassNames.OneKeyHardwareError;

  override name = 'ThirdPartyHardwareError';

  /** Vendor name for i18n interpolation (e.g. "Ledger", "Trezor") */
  vendor?: string;

  /** Chain hint for i18n (e.g. "Ethereum", "Solana") */
  chain?: string;

  /** Ledger app name from device (e.g. "Tron", "Bitcoin", "Ethereum") */
  appName?: string;
}

export enum EThirdPartyDevicePermissionDeniedReason {
  bluetoothTurnedOff = 'bluetoothTurnedOff',
  permissionDenied = 'permissionDenied',
}

// Do NOT pass `defaultMessage` — the locale key's translation already holds
// the human-readable text.

/** App not installed on device */
export class ThirdPartyAppNotInstalled extends ThirdPartyHardwareError {
  constructor(
    props?: IOneKeyErrorHardwareProps & {
      vendor?: string;
      chain?: string;
      appName?: string;
    },
  ) {
    super(
      normalizeErrorProps(
        { ...props, info: { ...props?.info, appName: props?.appName } },
        {
          defaultKey: ETranslations.hardware_third_party_app_not_installed,
        },
      ),
    );
    this.vendor = props?.vendor;
    this.chain = props?.chain;
    this.appName = props?.appName;
  }

  override code = ThirdPartyHwErrorCode.AppNotInstalled;
}

/** Device is locked — user needs to unlock */
export class ThirdPartyDeviceLocked extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_device_locked,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.DeviceLocked;
}

export class ThirdPartyDeviceOutOfMemory extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey:
          ETranslations.hardware_third_party_device_out_of_memory__msg,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.DeviceOutOfMemory;
}

export class ThirdPartyNetworkError extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.global_network_error,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.NetworkError;
}

export class ThirdPartyUserRejected extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_user_rejected,
        defaultAutoToast: true,
      }),
    );
  }

  override code = ThirdPartyHwErrorCode.UserRejected;
}

export class ThirdPartyUserAborted extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_user_cancel_error,
        defaultAutoToast: false,
      }),
    );
  }

  override code = ThirdPartyHwErrorCode.UserAborted;
}

export class ThirdPartyInstallAppUserCancelled extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_user_cancel_error,
        defaultAutoToast: false,
      }),
    );
  }

  override code = THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE;
}

export class ThirdPartyDevicePermissionDenied extends ThirdPartyHardwareError {
  reason?: EThirdPartyDevicePermissionDeniedReason;

  constructor(
    props?: IOneKeyErrorHardwareProps & {
      vendor?: string;
      reason?: EThirdPartyDevicePermissionDeniedReason;
    },
  ) {
    super(
      normalizeErrorProps(
        props
          ? {
              ...props,
              payload: {
                ...props.payload,
                params: {
                  ...props.payload.params,
                  permissionDeniedReason: props.reason,
                },
              },
            }
          : props,
        {
          defaultKey:
            props?.reason ===
            EThirdPartyDevicePermissionDeniedReason.bluetoothTurnedOff
              ? ETranslations.hardware_bluetooth_need_turned_on_error
              : ETranslations.onboarding_bluetooth_permission_needed,
          defaultAutoToast: true,
        },
      ),
    );
    this.vendor = props?.vendor;
    this.reason = props?.reason;
  }

  override code = ThirdPartyHwErrorCode.DevicePermissionDenied;
}

/** Wrong app is open on device */
export class ThirdPartyWrongApp extends ThirdPartyHardwareError {
  constructor(
    props?: IOneKeyErrorHardwareProps & { vendor?: string; chain?: string },
  ) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_wrong_app,
      }),
    );
    this.vendor = props?.vendor;
    this.chain = props?.chain;
  }

  override code = ThirdPartyHwErrorCode.WrongApp;
}

/** Device disconnected */
export class ThirdPartyDeviceDisconnected extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_device_disconnected,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.DeviceDisconnected;
}

/** Chain app wedged (e.g. Ledger BTC 0x6901). User must exit app on device. */
export class ThirdPartyDeviceAppStuck extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(
        { ...props, info: { ...props?.info, vendor: props?.vendor } },
        {
          defaultKey: ETranslations.hardware_third_party_device_app_stuck,
          defaultAutoToast: true,
        },
      ),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.DeviceAppStuck;
}

/** Connected device does not match the stored wallet */
export class ThirdPartyDeviceMismatch extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_device_mismatch,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.DeviceMismatch;
}

/** Operation timed out */
export class ThirdPartyOperationTimeout extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_operation_timeout,
        defaultAutoToast: true,
      }),
    );
  }

  override code = ThirdPartyHwErrorCode.OperationTimeout;
}

/** BLE SMP pairing 30s window expired. Distinct from generic OperationTimeout
 *  so future PIN / passphrase / SSO confirmation timeouts don't collide. */
export class ThirdPartyBlePairingTimeout extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_bluetooth_pairing_failed,
        defaultAutoToast: true,
      }),
    );
  }

  override code = ThirdPartyHwErrorCode.BlePairingTimeout;
}

/** Chain has no keyring impl for this vendor (e.g. Ledger doesn't support Aptos). */
export class ThirdPartyChainNotSupported extends ThirdPartyHardwareError {
  constructor(
    props?: IOneKeyErrorHardwareProps & { vendor?: string; chain?: string },
  ) {
    super(
      normalizeErrorProps(
        {
          ...props,
          info: {
            ...props?.info,
            vendor: props?.vendor,
            chain: props?.chain,
          },
        },
        {
          defaultKey: ETranslations.hardware_third_party_chain_not_supported,
          defaultAutoToast: true,
        },
      ),
    );
    this.vendor = props?.vendor;
    this.chain = props?.chain;
  }

  override code = ThirdPartyHwErrorCode.ChainNotSupported;
}

/** Method not supported by this vendor/chain */
export class ThirdPartyMethodNotSupported extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_method_not_supported,
        defaultAutoToast: true,
      }),
    );
  }

  override code = ThirdPartyHwErrorCode.MethodNotSupported;
}

/** Fallback for unrecognized errors */
export class ThirdPartyUnknownError extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_unknown_error,
        defaultAutoToast: true,
      }),
    );
  }

  override code = ThirdPartyHwErrorCode.UnknownError;
}

/** Device not detected (BLE not discovered, USB unplugged, etc.) */
export class ThirdPartyDeviceNotFound extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_device_not_found,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.DeviceNotFound;
}

/** Device busy — held by another app (e.g. Ledger Live) */
export class ThirdPartyDeviceBusy extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_device_busy,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.DeviceBusy;
}

/** Multiple USB devices connected — only one allowed at a time */
export class ThirdPartyDeviceOneDeviceOnly extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey:
          ETranslations.hardware_third_party_usb_single_device_only_desc,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.DeviceOneDeviceOnly;
}

/** Transport-layer failure (USB / BLE communication) */
export class ThirdPartyTransportError extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_transport_error,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.TransportError;
}

/** Browser / platform lacks the required transport (e.g. Firefox WebHID) */
export class ThirdPartyTransportNotAvailable extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_transport_not_available,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.TransportNotAvailable;
}

// ---------------------------------------------------------------------------
// EVM-specific Ledger Ethereum App errors (mapped from Ledger APDU codes)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// EVM-specific error classes (chain-specific copy, production-validated)
// ---------------------------------------------------------------------------

/**
 * Ledger APDU 0x6a80 "Invalid data" in EVM context = Blind signing disabled.
 * Surfaces when DMK falls back to `blindSignTransactionFallback` and the
 * device rejects because `Blind signing` is off in the Ethereum app settings.
 */
export class ThirdPartyEvmBlindSigningRequired extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    // NOTE: Do NOT pass `defaultMessage` here. The mock key's value already
    // contains the full human-readable text, and `normalizeErrorProps` joins
    // `[defaultMessage, key]` when i18n lookup returns the id itself — which
    // would duplicate the sentence in the toast.
    super(
      normalizeErrorProps(props, {
        defaultKey:
          ETranslations.hardware_third_party_evm_blind_signing_required,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.EvmBlindSigningRequired;
}

/** Ledger APDU 0x6984 — required clear-sign plugin missing */
export class ThirdPartyEvmClearSignPluginMissing extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey:
          ETranslations.hardware_third_party_evm_clear_sign_plugin_missing,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.EvmClearSignPluginMissing;
}

/** Ledger APDU 0x6a84 — device memory not enough (typically Nano S) */
export class ThirdPartyEvmDataTooLarge extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_evm_data_too_large,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.EvmDataTooLarge;
}

/** Ledger APDU 0x6501 — transaction type not supported by current Ethereum app */
export class ThirdPartyEvmTxTypeNotSupported extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey:
          ETranslations.hardware_third_party_evm_tx_type_not_supported,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.EvmTxTypeNotSupported;
}

// ---------------------------------------------------------------------------
// Generic error classes (non-EVM chains: SOL / TRON / BTC)
// Device screen shows the exact setting name, so one generic copy per bucket.
// ---------------------------------------------------------------------------

/**
 * "Please enable Blind signing and follow the on-device instructions."
 * Covers every non-EVM app-setting toggle that blocks signing:
 *   SOL BlindSigning, TRON Custom Contracts / Data Signing / Sign by Hash.
 */
export class ThirdPartyEnableBlindSigning extends ThirdPartyHardwareError {
  constructor(
    props?: IOneKeyErrorHardwareProps & { vendor?: string; code?: number },
  ) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_enable_blind_signing,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
    this.code = props?.code ?? ThirdPartyHwErrorCode.SolanaBlindSigningRequired;
  }
}

/**
 * "This operation is not supported on your Ledger device."
 * Covers BTC edge cases: wallet policy hmac mismatch, unexpected signing state.
 */
export class ThirdPartyFeatureNotSupported extends ThirdPartyHardwareError {
  constructor(
    props?: IOneKeyErrorHardwareProps & { vendor?: string; code?: number },
  ) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_feature_not_supported,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
    this.code =
      props?.code ?? ThirdPartyHwErrorCode.BtcWalletPolicyHmacMismatch;
  }
}

/** Ledger APDU 0x911c — app too old / command not supported */
export class ThirdPartyAppTooOld extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_app_too_old,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
  }

  override code = ThirdPartyHwErrorCode.AppTooOld;
}
