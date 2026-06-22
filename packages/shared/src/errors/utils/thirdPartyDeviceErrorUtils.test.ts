import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import { EHardwareVendor } from '../../../types/device';
import {
  EAppEventBusNames,
  HARDWARE_ERROR_DIALOG_TYPES,
  appEventBus,
} from '../../eventBus/appEventBus';
import { THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE } from '../errors/thirdPartyHardwareErrors';

import { convertDeviceError } from './deviceErrorUtils';
import {
  classifyThirdPartyHwCreateFailures,
  convertThirdPartyDeviceError,
  filterThirdPartyHwCreateFailureToasts,
  normalizeThirdPartyDeviceErrorCode,
  shouldOfferLedgerCoreAppInstallForCreateFailures,
} from './thirdPartyDeviceErrorUtils';

describe('convertThirdPartyDeviceError', () => {
  it('maps invalid firmware metadata responses to network errors', () => {
    const error = convertThirdPartyDeviceError({
      code: ThirdPartyHwErrorCode.UnknownError,
      error: 'InvalidGetFirmwareMetadataResponseError',
      _tag: 'InvalidGetFirmwareMetadataResponseError',
    });

    expect(error.code).toBe(ThirdPartyHwErrorCode.NetworkError);
  });

  it('normalizes numeric string error codes before classification', () => {
    expect(
      normalizeThirdPartyDeviceErrorCode({
        code: String(ThirdPartyHwErrorCode.DeviceOutOfMemory),
      }),
    ).toBe(ThirdPartyHwErrorCode.DeviceOutOfMemory);
  });

  it('routes DeviceNotFound to the hardware troubleshooting dialog', () => {
    const emitSpy = jest.spyOn(appEventBus, 'emit').mockImplementation();

    const error = convertThirdPartyDeviceError(
      {
        code: ThirdPartyHwErrorCode.DeviceNotFound,
        error: 'Trezor device not found',
      },
      { vendor: 'Trezor' },
    );

    expect(error.autoToast).toBe(false);
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.ShowHardwareErrorDialog,
      expect.objectContaining({
        errorType: HARDWARE_ERROR_DIALOG_TYPES.DEVICE_NOT_FOUND,
        vendor: 'Trezor',
        errorCode: ThirdPartyHwErrorCode.DeviceNotFound,
        errorMessage: 'Trezor device not found',
      }),
    );

    emitSpy.mockRestore();
  });

  it('does not show the troubleshooting dialog for silent third-party DeviceNotFound', () => {
    const emitSpy = jest.spyOn(appEventBus, 'emit').mockImplementation();

    const error = convertDeviceError(
      {
        code: ThirdPartyHwErrorCode.DeviceNotFound,
        error: 'Trezor device not found',
      },
      { silentMode: true },
    );

    expect(error.code).toBe(ThirdPartyHwErrorCode.DeviceNotFound);
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.ShowHardwareErrorDialog,
      expect.anything(),
    );

    emitSpy.mockRestore();
  });

  it('preserves the vendor when generic conversion delegates to third-party errors', () => {
    const emitSpy = jest.spyOn(appEventBus, 'emit').mockImplementation();

    const error = convertDeviceError(
      {
        code: ThirdPartyHwErrorCode.DeviceNotFound,
        error: 'Trezor device not found',
      },
      { vendor: EHardwareVendor.trezor },
    );

    expect(error.code).toBe(ThirdPartyHwErrorCode.DeviceNotFound);
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.ShowHardwareErrorDialog,
      expect.objectContaining({
        errorType: HARDWARE_ERROR_DIALOG_TYPES.DEVICE_NOT_FOUND,
        vendor: EHardwareVendor.trezor,
      }),
    );

    emitSpy.mockRestore();
  });

  it('preserves passphrase state mismatch as a structured third-party hardware error', () => {
    const error = convertThirdPartyDeviceError({
      code: ThirdPartyHwErrorCode.PassphraseStateMismatch,
      error: 'passphraseState mismatch',
    });

    expect(error.code).toBe(ThirdPartyHwErrorCode.PassphraseStateMismatch);
    expect(error.name).toBe('ThirdPartyHardwareError');
    expect(error.key).toBe('hardware_third_party_device_mismatch');
  });

  it('maps third-party PIN cancel to a structured PIN cancelled error', () => {
    const error = convertThirdPartyDeviceError({
      code: ThirdPartyHwErrorCode.PinCancelled,
      error: 'Trezor device still locked after PIN attempt',
    });

    expect(error.code).toBe(ThirdPartyHwErrorCode.PinCancelled);
    expect(error.name).toBe('ThirdPartyHardwareError');
  });
});

describe('convertDeviceError', () => {
  it('preserves invalid firmware metadata tags for third-party hardware errors', () => {
    const sdkPayload = {
      code: ThirdPartyHwErrorCode.UnknownError,
      error: 'InvalidGetFirmwareMetadataResponseError',
      _tag: 'InvalidGetFirmwareMetadataResponseError',
    };
    const error = convertDeviceError(sdkPayload);

    expect(error.code).toBe(ThirdPartyHwErrorCode.NetworkError);
  });

  it('maps all-network install cancel code before generic hardware fallback', () => {
    const error = convertDeviceError({
      code: THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE,
      error: 'User declined to install Tron',
    });

    expect(error.code).toBe(THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE);
    expect(error.autoToast).toBe(false);
  });
});

describe('classifyThirdPartyHwCreateFailures', () => {
  it('keeps device out-of-memory failures when at least one account succeeded', () => {
    const failedAccount = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceOutOfMemory,
      },
    };
    const result = classifyThirdPartyHwCreateFailures({
      addedCount: 1,
      failedAccounts: [failedAccount],
    });

    expect(result.allAppNotInstalled).toBe(false);
    expect(result.genuineFailures).toEqual([failedAccount]);
  });

  it('drops all-network install cancel failures from genuine failures', () => {
    const installCancel = {
      error: {
        code: THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE,
      },
    };
    const deviceOutOfMemory = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceOutOfMemory,
      },
    };
    const result = classifyThirdPartyHwCreateFailures({
      addedCount: 1,
      failedAccounts: [installCancel, deviceOutOfMemory],
    });

    expect(result.allAppNotInstalled).toBe(false);
    expect(result.genuineFailures).toEqual([deviceOutOfMemory]);
  });

  it('drops device-not-found failures when at least one account succeeded', () => {
    const deviceNotFoundFailure = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceNotFound,
      },
    };
    const result = classifyThirdPartyHwCreateFailures({
      addedCount: 1,
      failedAccounts: [deviceNotFoundFailure],
    });

    expect(result.allAppNotInstalled).toBe(false);
    expect(result.genuineFailures).toEqual([]);
  });

  it('keeps device-not-found failures when no account succeeded', () => {
    const deviceNotFoundFailure = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceNotFound,
      },
    };
    const result = classifyThirdPartyHwCreateFailures({
      addedCount: 0,
      failedAccounts: [deviceNotFoundFailure],
    });

    expect(result.allAppNotInstalled).toBe(false);
    expect(result.genuineFailures).toEqual([deviceNotFoundFailure]);
  });
});

describe('shouldOfferLedgerCoreAppInstallForCreateFailures', () => {
  it('only offers Ledger core app install for all-network auto-create failures', () => {
    expect(
      shouldOfferLedgerCoreAppInstallForCreateFailures({
        vendor: EHardwareVendor.ledger,
        allAppNotInstalled: true,
        isAutoCreateMultiNetwork: true,
      }),
    ).toBe(true);

    expect(
      shouldOfferLedgerCoreAppInstallForCreateFailures({
        vendor: EHardwareVendor.trezor,
        allAppNotInstalled: true,
        isAutoCreateMultiNetwork: true,
      }),
    ).toBe(false);
  });
});

describe('filterThirdPartyHwCreateFailureToasts', () => {
  it('keeps only one device out-of-memory failure for toast display', () => {
    const first = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceOutOfMemory,
        message: 'Not enough space',
      },
    };
    const second = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceOutOfMemory,
        message: 'Not enough space',
      },
    };

    expect(filterThirdPartyHwCreateFailureToasts([first, second])).toEqual([
      first,
    ]);
  });

  it('drops failures explicitly marked as autoToast=false', () => {
    const first = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceOutOfMemory,
        message: 'Not enough space',
      },
    };
    const muted = {
      error: {
        code: ThirdPartyHwErrorCode.DeviceOutOfMemory,
        message: 'Not enough space',
        autoToast: false,
      },
    };

    expect(filterThirdPartyHwCreateFailureToasts([first, muted])).toEqual([
      first,
    ]);
  });

  it('drops all-network install cancel failures even without autoToast=false', () => {
    const installCancel = {
      error: {
        code: THIRD_PARTY_HW_INSTALL_APP_USER_CANCEL_CODE,
        message: 'User declined to install Tron',
      },
    };

    expect(filterThirdPartyHwCreateFailureToasts([installCancel])).toEqual([]);
  });
});
