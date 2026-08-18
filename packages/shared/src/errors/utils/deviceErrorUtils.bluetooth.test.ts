import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { BluetoothUnavailableWhileUsbConnectedError } from '../errors/hardwareErrors';
import { OneKeyLocalError } from '../errors/localError';
import { EOneKeyErrorClassNames } from '../types/errorTypes';

import { convertDeviceError, isOneKeyHardwareError } from './deviceErrorUtils';

describe('isOneKeyHardwareError', () => {
  it('recognizes hardware error metadata rehydrated across runtimes', () => {
    const error = Object.assign(new OneKeyLocalError('link disabled'), {
      className: EOneKeyErrorClassNames.OneKeyHardwareError,
      code: HardwareErrorCode.BleUnavailableWhileUsbConnected,
    });

    expect(isOneKeyHardwareError(error)).toBe(true);
  });
});

describe('convertDeviceError Bluetooth unavailable while USB is connected', () => {
  it('explains that Bluetooth is unavailable while USB is connected', () => {
    const error = convertDeviceError({
      code: HardwareErrorCode.BleUnavailableWhileUsbConnected,
      error: 'firmware wording may change',
    });

    expect(error).toBeInstanceOf(BluetoothUnavailableWhileUsbConnectedError);
    expect(error).toMatchObject({
      code: HardwareErrorCode.BleUnavailableWhileUsbConnected,
      key: 'troubleshooting.desktop_bluetooth_usb_priority',
      payload: {
        code: HardwareErrorCode.BleUnavailableWhileUsbConnected,
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
      code: HardwareErrorCode.BleUnavailableWhileUsbConnected,
    });

    expect(error).toBeInstanceOf(BluetoothUnavailableWhileUsbConnectedError);
  });
});
