import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { FirmwareUpdateTasksClear } from '../errors/appErrors';
import { DeviceDisconnectedError } from '../errors/hardwareErrors';
import {
  ECustomOneKeyHardwareError,
  EOneKeyErrorClassNames,
} from '../types/errorTypes';

import { convertDeviceError } from './deviceErrorUtils';
import {
  FIRMWARE_UPDATE_ERROR_DETAIL_MAX_LENGTH,
  buildFirmwareUpdateFailureReport,
  classifyFirmwareUpdateFailure,
  isFirmwareUpdateCancellationError,
  limitFirmwareUpdateErrorDetail,
  resolveFirmwareUpdateErrorCode,
  resolveReportedFirmwareUpdateFailure,
  shouldHideFirmwareUpdateInternalError,
  toUserFacingFirmwareUpdateError,
} from './firmwareUpdateErrorUtils';

jest.mock('../../locale/appLocale', () => ({
  appLocale: {
    intl: {
      formatMessage: ({ id }: { id: string }) =>
        id === 'update.device_disconnected_desc'
          ? 'The device has been disconnected. Please reconnect the device and try again.'
          : id,
    },
  },
}));

describe('firmwareUpdateErrorUtils', () => {
  it('treats updateTasksClear: exitUpdateWorkflow as an internal cancellation', () => {
    const error = new FirmwareUpdateTasksClear({
      message: 'updateTasksClear: exitUpdateWorkflow',
    });

    expect(isFirmwareUpdateCancellationError(error)).toBe(true);
    expect(shouldHideFirmwareUpdateInternalError(error)).toBe(true);
    expect(toUserFacingFirmwareUpdateError(error).message).toBe(
      'The device has been disconnected. Please reconnect the device and try again.',
    );
  });

  it('treats a serialized cancellation payload as an internal cancellation', () => {
    expect(
      isFirmwareUpdateCancellationError({
        className: EOneKeyErrorClassNames.FirmwareUpdateTasksClear,
        message: 'updateTasksClear: exitUpdateWorkflow',
      }),
    ).toBe(true);
  });

  it('maps a device disconnect error to the reconnect copy', () => {
    const error = new DeviceDisconnectedError({
      payload: {
        error: 'DeviceDisconnected',
        code: HardwareErrorCode.BridgeDeviceDisconnected,
        connectId: 'ble-1',
      },
    });

    expect(shouldHideFirmwareUpdateInternalError(error)).toBe(true);
    expect(toUserFacingFirmwareUpdateError(error).message).toBe(
      'The device has been disconnected. Please reconnect the device and try again.',
    );
  });

  it('leaves unrelated firmware errors unchanged', () => {
    const error = {
      message: 'Firmware verification failed',
    };

    expect(isFirmwareUpdateCancellationError(error)).toBe(false);
    expect(toUserFacingFirmwareUpdateError(error).message).toBe(
      'Firmware verification failed',
    );
  });

  it.each([
    [HardwareErrorCode.FirmwareUpdateDownloadFailed, 'download'],
    [HardwareErrorCode.EmmcFileWriteFirmwareError, 'transfer'],
    [HardwareErrorCode.FirmwareError, 'install'],
    [HardwareErrorCode.FirmwareVerificationFailed, 'verification'],
    [HardwareErrorCode.BleTimeoutError, 'timeout'],
    [HardwareErrorCode.BleDeviceDisconnected, 'device_disconnected'],
  ] as const)('classifies firmware error code %s as %s', (code, expected) => {
    expect(classifyFirmwareUpdateFailure({ code })).toBe(expected);
  });

  it.each([
    HardwareErrorCode.PinCancelled,
    HardwareErrorCode.ActionCancelled,
    HardwareErrorCode.CallQueueActionCancelled,
    HardwareErrorCode.DeviceInterruptedFromOutside,
    HardwareErrorCode.DeviceInterruptedFromUser,
    HardwareErrorCode.PollingStop,
    HardwareErrorCode.BleTransportCallCanceled,
  ])('classifies cancellation error code %s as cancelled', (code) => {
    expect(classifyFirmwareUpdateFailure({ code })).toBe('cancelled');
  });

  it('does not replace an SDK cancellation with the disconnected message', () => {
    const error = {
      code: HardwareErrorCode.ActionCancelled,
      message: 'Action cancelled by user',
    };

    expect(shouldHideFirmwareUpdateInternalError(error)).toBe(false);
    expect(toUserFacingFirmwareUpdateError(error).message).toBe(
      'Action cancelled by user',
    );
  });

  it('prefers the raw SDK payload code over a wrapper code', () => {
    const error = {
      code: HardwareErrorCode.RuntimeError,
      payload: {
        code: HardwareErrorCode.FirmwareError,
      },
    };

    expect(classifyFirmwareUpdateFailure(error)).toBe('install');
    expect(resolveFirmwareUpdateErrorCode(error)).toBe(
      String(HardwareErrorCode.FirmwareError),
    );
  });

  it.each([
    [HardwareErrorCode.BleTimeoutError, 'timeout'],
    [HardwareErrorCode.BleDeviceDisconnected, 'device_disconnected'],
  ] as const)(
    'prefers wrapped transport cause code %s for classification as %s',
    (causeCode, expected) => {
      const error = {
        code: HardwareErrorCode.RuntimeError,
        payload: {
          code: HardwareErrorCode.EmmcFileWriteFirmwareError,
          params: { causeCode },
        },
      };

      expect(classifyFirmwareUpdateFailure(error)).toBe(expected);
      expect(resolveFirmwareUpdateErrorCode(error)).toBe(String(causeCode));
    },
  );

  it.each([
    ['ARTIFACT_NETWORK_FAILED: request failed', 'download'],
    ['ARTIFACT_HTTP_503: unavailable', 'download'],
    ['ARTIFACT_TLS_FAILED: validation failed', 'download'],
    ['ARTIFACT_INTEGRITY_FAILED: hash mismatch', 'download'],
    ['ARTIFACT_ARCHIVE_INVALID: invalid package', 'download'],
    ['ARTIFACT_PROTOCOL_INVALID: invalid response', 'download'],
    ['ARTIFACT_CANCELLED', 'cancelled'],
    ['ARTIFACT_LEASE_CREATE_TIMEOUT', 'timeout'],
    ['Protocol V2 firmware install timed out', 'timeout'],
  ] as const)('classifies %s as %s', (message, expected) => {
    expect(classifyFirmwareUpdateFailure({ message })).toBe(expected);
  });

  it('resolves a stable artifact error code from the message', () => {
    expect(
      resolveFirmwareUpdateErrorCode({
        message: 'ARTIFACT_HTTP_503: unavailable',
      }),
    ).toBe('ARTIFACT_HTTP_503');
  });

  it('keeps unknown failures in a bounded fallback category', () => {
    expect(
      classifyFirmwareUpdateFailure({ message: 'unexpected failure' }),
    ).toBe('unknown');
  });

  it.each([
    [ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb, 'requires_web'],
    [ECustomOneKeyHardwareError.FirmwareUpdateBatteryTooLow, 'low_battery'],
    [
      ECustomOneKeyHardwareError.FirmwareUpdateRequiresUsbTransport,
      'requires_usb',
    ],
    [HardwareErrorCode.UseDesktopToUpdateFirmware, 'requires_desktop'],
    [HardwareErrorCode.DeviceCheckDeviceIdError, 'device_mismatch'],
    [ECustomOneKeyHardwareError.NeedOneKeyBridgeUpgrade, 'requires_bridge'],
    [HardwareErrorCode.FirmwareUpdateLimitOneDevice, 'device_limit'],
    [HardwareErrorCode.BleForceCleanRunPromise, 'ble_interrupted'],
  ] as const)(
    'classifies gate or transport code %s as %s',
    (code, expected) => {
      const report = buildFirmwareUpdateFailureReport({ code });

      expect(report.failureType).toBe(expected);
      expect(report.errorCode).toBe(String(code));
      expect(report.failurePhase).toBe(
        expected === 'ble_interrupted' ? 'execution' : 'precondition',
      );
    },
  );

  it('uses the first mapped code instead of a later category', () => {
    const report = buildFirmwareUpdateFailureReport({
      code: HardwareErrorCode.RuntimeError,
      payload: {
        code: HardwareErrorCode.BleTimeoutError,
        params: { causeCode: HardwareErrorCode.FirmwareError },
      },
    });

    expect(report.failureType).toBe('install');
    expect(report.failurePhase).toBe('execution');
    expect(report.errorCode).toBe(String(HardwareErrorCode.FirmwareError));
  });

  it('keeps an unmapped sentinel unknown until a later code maps', () => {
    expect(
      buildFirmwareUpdateFailureReport({
        code: HardwareErrorCode.UnknownError,
      }),
    ).toEqual({
      failureType: 'unknown',
      errorCode: String(HardwareErrorCode.UnknownError),
    });

    expect(
      buildFirmwareUpdateFailureReport({
        code: -99_999,
        payload: { code: HardwareErrorCode.FirmwareError },
      }).failureType,
    ).toBe('install');
  });

  it('keeps a WebUSB write response timeout out of the transfer bucket', () => {
    const converted = convertDeviceError({
      code: HardwareErrorCode.EmmcFileWriteFirmwareError,
      error:
        'transfer data error: Protocol V2 response timeout after 1000ms for FilesystemFileWrite',
      params: { causeCode: 'response-timeout' },
    });
    const report = buildFirmwareUpdateFailureReport(converted);
    const plainTransfer = buildFirmwareUpdateFailureReport(
      convertDeviceError({
        code: HardwareErrorCode.EmmcFileWriteFirmwareError,
        error: 'transfer data error',
      }),
    );

    expect(report).toMatchObject({
      failureType: 'timeout',
      failurePhase: 'execution',
      errorCode: 'response-timeout',
    });
    expect(report.errorDetail).toBeUndefined();
    expect(JSON.stringify(report)).not.toContain('FilesystemFileWrite');
    expect(plainTransfer).toMatchObject({
      failureType: 'transfer',
      errorCode: String(HardwareErrorCode.EmmcFileWriteFirmwareError),
    });
  });

  it('keeps a Protocol V2 install poll timeout out of the install bucket', () => {
    const converted = convertDeviceError({
      code: HardwareErrorCode.FirmwareError,
      error: 'Protocol V2 firmware install timed out',
      params: { firmwareUpdateCode: 'FirmwareInstallTimeout' },
    });
    const report = buildFirmwareUpdateFailureReport(converted);

    expect(report.failureType).toBe('timeout');
    expect(report.failurePhase).toBe('execution');
    expect(report.errorCode).toBe(String(HardwareErrorCode.FirmwareError));
    expect(
      buildFirmwareUpdateFailureReport({
        code: HardwareErrorCode.FirmwareError,
        message: 'Firmware installation failed',
      }).failureType,
    ).toBe('install');
  });

  it('does not report a pure cancellation, but keeps an earlier real failure', () => {
    expect(
      resolveReportedFirmwareUpdateFailure({
        error: { message: 'updateTasksClear: exitUpdateWorkflow' },
      }),
    ).toBeUndefined();

    expect(
      resolveReportedFirmwareUpdateFailure({
        error: { code: HardwareErrorCode.ActionCancelled },
        previous: {
          failureType: 'transfer',
          failurePhase: 'execution',
          errorCode: String(HardwareErrorCode.EmmcFileWriteFirmwareError),
        },
      }),
    ).toEqual({
      failureType: 'transfer',
      failurePhase: 'execution',
      errorCode: String(HardwareErrorCode.EmmcFileWriteFirmwareError),
    });
    expect(
      resolveReportedFirmwareUpdateFailure({
        error: { code: HardwareErrorCode.ActionCancelled },
        previous: {
          failureType: 'unknown',
          errorCode: '-99999',
        },
      }),
    ).toEqual({
      failureType: 'unknown',
      errorCode: '-99999',
    });
  });

  it('still treats a cancellation code anywhere on the error as cancelled', () => {
    expect(
      classifyFirmwareUpdateFailure({
        code: HardwareErrorCode.FirmwareError,
        payload: { code: HardwareErrorCode.ActionCancelled },
      }),
    ).toBe('cancelled');
  });

  it('reports a replaced BLE call as a failed execution, not a cancellation', () => {
    const report = buildFirmwareUpdateFailureReport({
      code: HardwareErrorCode.BleForceCleanRunPromise,
      message: 'Force clean Bluetooth run promise',
    });

    expect(report.failureType).toBe('ble_interrupted');
    expect(
      resolveReportedFirmwareUpdateFailure({
        error: { code: HardwareErrorCode.BleForceCleanRunPromise },
      })?.failureType,
    ).toBe('ble_interrupted');
    expect(report.errorDetail).toBe('Force clean Bluetooth run promise');
  });

  it('keeps the BLE interrupt template after the SDK error is wrapped', () => {
    const converted = convertDeviceError({
      code: HardwareErrorCode.BleForceCleanRunPromise,
      error: 'Force clean Bluetooth run promise',
    });
    const localized = buildFirmwareUpdateFailureReport({
      code: ECustomOneKeyHardwareError.UnknownHardwareError,
      className: EOneKeyErrorClassNames.UnknownHardwareError,
      message: 'wallet_action_failed',
      payload: {
        code: HardwareErrorCode.BleForceCleanRunPromise,
        error: 'Force clean Bluetooth run promise',
      },
    });
    const leaked = buildFirmwareUpdateFailureReport({
      code: HardwareErrorCode.BleForceCleanRunPromise,
      message: 'wallet_action_failed',
      payload: {
        error: 'Force clean Bluetooth run promise connectId SERIAL-1',
        message: 'abandon abandon https://firmware.onekey.so/fw?token=sekret',
      },
    });

    expect(buildFirmwareUpdateFailureReport(converted)).toMatchObject({
      failureType: 'ble_interrupted',
      errorCode: String(HardwareErrorCode.BleForceCleanRunPromise),
      errorDetail: 'Force clean Bluetooth run promise',
    });
    expect(localized).toMatchObject({
      failureType: 'ble_interrupted',
      failurePhase: 'execution',
      errorCode: String(HardwareErrorCode.BleForceCleanRunPromise),
      errorDetail: 'Force clean Bluetooth run promise',
    });
    expect(leaked.errorDetail).toBeUndefined();
    expect(JSON.stringify(leaked)).not.toContain('sekret');
    expect(JSON.stringify(leaked)).not.toContain('SERIAL-1');
  });

  it('drops raw messages and only keeps an allowlisted detail', () => {
    const secret =
      'abandon abandon connectId SERIAL-1 https://firmware.onekey.so/fw?token=sekret';
    const unsafe = buildFirmwareUpdateFailureReport({
      code: ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb,
      className: EOneKeyErrorClassNames.OneKeyHardwareError,
      message: secret,
      payload: {
        message: secret,
        connectId: 'SERIAL-1',
      },
    });
    const safe = buildFirmwareUpdateFailureReport({
      code: -99_999,
      className: EOneKeyErrorClassNames.OneKeyLocalError,
      name: EOneKeyErrorClassNames.OneKeyLocalError,
      message: 'USB not connected',
    });

    expect(unsafe).toEqual({
      failureType: 'requires_web',
      failurePhase: 'precondition',
      errorCode: String(ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb),
      errorName: 'OneKeyHardwareError',
    });
    expect(JSON.stringify(unsafe)).not.toContain('sekret');
    expect(JSON.stringify(unsafe)).not.toContain('SERIAL-1');
    expect(JSON.stringify(unsafe)).not.toContain('abandon');
    expect(safe).toMatchObject({
      failureType: 'unknown',
      errorCode: '-99999',
      errorName: 'OneKeyLocalError',
      errorDetail: 'USB not connected',
    });
    expect(
      buildFirmwareUpdateFailureReport({
        message: 'Protocol V2 firmware install timed out',
      }).errorDetail,
    ).toBeUndefined();
  });

  it('truncates an allowlisted diagnostic at the fixed length', () => {
    const detail = 'U'.repeat(FIRMWARE_UPDATE_ERROR_DETAIL_MAX_LENGTH + 40);

    expect(limitFirmwareUpdateErrorDetail(detail)).toHaveLength(
      FIRMWARE_UPDATE_ERROR_DETAIL_MAX_LENGTH,
    );
    expect(limitFirmwareUpdateErrorDetail(detail).includes(' ')).toBe(false);
  });
});
