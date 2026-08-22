import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { FirmwareUpdateTasksClear } from '../errors/appErrors';
import { DeviceDisconnectedError } from '../errors/hardwareErrors';
import { EOneKeyErrorClassNames } from '../types/errorTypes';

import {
  isFirmwareUpdateCancellationError,
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
});
