import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { BluetoothUnavailableWhileUsbConnectedError } from '../errors/hardwareErrors';

import { convertDeviceError } from './deviceErrorUtils';

describe('convertDeviceError Bluetooth link disabled', () => {
  it('explains that Bluetooth is unavailable while USB is connected', () => {
    const error = convertDeviceError({
      code: HardwareErrorCode.RuntimeError,
      error: 'Failure_ProcessError,link disabled',
    });

    expect(error).toBeInstanceOf(BluetoothUnavailableWhileUsbConnectedError);
    expect(error).toMatchObject({
      code: HardwareErrorCode.RuntimeError,
      key: 'troubleshooting.desktop_bluetooth_usb_priority',
      payload: {
        code: HardwareErrorCode.RuntimeError,
        error: 'Failure_ProcessError,link disabled',
      },
    });
  });
});
