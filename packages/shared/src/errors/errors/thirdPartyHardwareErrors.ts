/* eslint-disable max-classes-per-file */
import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@bytezhang/hardware-wallet-core';

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
}

// ---------------------------------------------------------------------------
// Specific error classes
// ---------------------------------------------------------------------------

/** App not installed on device (Ledger 0x6807 "Unknown application name") */
export class ThirdPartyAppNotInstalled extends ThirdPartyHardwareError {
  constructor(
    props?: IOneKeyErrorHardwareProps & { vendor?: string; chain?: string },
  ) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'ThirdPartyAppNotInstalled',
        defaultKey: ETranslations.hardware_third_party_app_not_installed,
      }),
    );
    this.vendor = props?.vendor;
    this.chain = props?.chain;
  }

  override code = ThirdPartyHwErrorCode.AppNotOpen;
}

/** Device is locked — user needs to unlock */
export class ThirdPartyDeviceLocked extends ThirdPartyHardwareError {
  constructor(props?: IOneKeyErrorHardwareProps & { vendor?: string }) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'ThirdPartyDeviceLocked',
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
        defaultMessage: 'ThirdPartyUserRejected',
        defaultKey: ETranslations.hardware_user_cancel_error,
        defaultAutoToast: true,
      }),
    );
  }

  override code = ThirdPartyHwErrorCode.UserRejected;
}

/** Wrong app is open on device */
export class ThirdPartyWrongApp extends ThirdPartyHardwareError {
  constructor(
    props?: IOneKeyErrorHardwareProps & { vendor?: string; chain?: string },
  ) {
    super(
      normalizeErrorProps(props, {
        defaultMessage: 'ThirdPartyWrongApp',
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
        defaultMessage: 'ThirdPartyDeviceDisconnected',
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
        defaultMessage: 'ThirdPartyDeviceMismatch',
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
        defaultMessage: 'ThirdPartyOperationTimeout',
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
        defaultMessage: 'ThirdPartyMethodNotSupported',
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
        defaultMessage: 'ThirdPartyUnknownError',
        defaultAutoToast: true,
      }),
    );
  }

  override code = ThirdPartyHwErrorCode.UnknownError;
}
