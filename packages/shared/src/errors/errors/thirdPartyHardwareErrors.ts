/* eslint-disable max-classes-per-file */
import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import { ETranslations } from '../../locale';
import { EOneKeyErrorClassNames } from '../types/errorTypes';
import { normalizeErrorProps } from '../utils/errorUtils';

import { OneKeyHardwareError } from './hardwareErrors';

import type { IOneKeyErrorHardwareProps } from './hardwareErrors';

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

// Do NOT pass `defaultMessage` — the locale key's translation already holds
// the human-readable text.

/**
 * App not installed on device (Ledger 0x6807 "Unknown application name").
 *
 * TODO: when the real `ETranslations.hardware_third_party_app_not_installed`
 * key ships, make the locale value use an `{appName}` ICU placeholder and
 * pass `info: { appName }` here so the toast can interpolate. Mock lookup
 * doesn't do ICU substitution on the id, so the mock phase shows the
 * static fallback text without the app name.
 */
export class ThirdPartyAppNotInstalled extends ThirdPartyHardwareError {
  constructor(
    props?: IOneKeyErrorHardwareProps & {
      vendor?: string;
      chain?: string;
      appName?: string;
    },
  ) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.hardware_third_party_app_not_installed,
      }),
    );
    this.vendor = props?.vendor;
    this.chain = props?.chain;
    this.appName = props?.appName;
  }

  override code = ThirdPartyHwErrorCode.AppNotOpen;
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

/** User rejected the operation on device */
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

/** OS-level device permission (Bluetooth / USB) denied. */
export class ThirdPartyDevicePermissionDenied extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultKey: ETranslations.onboarding_bluetooth_permission_needed,
        defaultAutoToast: true,
      }),
    );
    this.vendor = props?.vendor;
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
