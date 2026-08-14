import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  BLE_UNAVAILABLE_WHILE_USB_CONNECTED_ERROR_CODE,
  BluetoothUnavailableWhileUsbConnectedError,
} from '../errors/hardwareErrors';

import { convertDeviceError } from './deviceErrorUtils';

describe('convertDeviceError Bluetooth unavailable while USB is connected', () => {
  it('explains that Bluetooth is unavailable while USB is connected', () => {
    const error = convertDeviceError({
      code: BLE_UNAVAILABLE_WHILE_USB_CONNECTED_ERROR_CODE,
      error: 'firmware wording may change',
    });

    expect(error).toBeInstanceOf(BluetoothUnavailableWhileUsbConnectedError);
    expect(error).toMatchObject({
      code: BLE_UNAVAILABLE_WHILE_USB_CONNECTED_ERROR_CODE,
      key: 'troubleshooting.desktop_bluetooth_usb_priority',
      payload: {
        code: BLE_UNAVAILABLE_WHILE_USB_CONNECTED_ERROR_CODE,
        error: 'firmware wording may change',
      },
    });
  });

  it.each([HardwareErrorCode.DeviceBusy, HardwareErrorCode.RuntimeError])(
    'does not infer the error from an old firmware message for code %s',
    (code) => {
      const error = convertDeviceError({
        code,
        error: 'Failure_ProcessError,link disabled',
      });

      expect(error).not.toBeInstanceOf(
        BluetoothUnavailableWhileUsbConnectedError,
      );
    },
  );

  it('maps the dedicated code without a firmware message', () => {
    const error = convertDeviceError({
      code: BLE_UNAVAILABLE_WHILE_USB_CONNECTED_ERROR_CODE,
    });

    expect(error).toBeInstanceOf(BluetoothUnavailableWhileUsbConnectedError);
  });
});
