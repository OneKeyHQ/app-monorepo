import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { FirmwareUpdateTasksClear } from '../errors/appErrors';
import { DeviceDisconnectedError } from '../errors/hardwareErrors';
import { EOneKeyErrorClassNames } from '../types/errorTypes';

import {
  classifyFirmwareUpdateFailure,
  isFirmwareUpdateCancellationError,
  resolveFirmwareUpdateErrorCode,
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
    [HardwareErrorCode.BleDeviceBondError, 'device_disconnected'],
    [HardwareErrorCode.BleDeviceDisconnected, 'device_disconnected'],
    [HardwareErrorCode.BlePeerRemovedPairingInformation, 'device_disconnected'],
    [HardwareErrorCode.BleBondInvalid, 'device_disconnected'],
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
});
