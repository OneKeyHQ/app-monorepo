import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  EAppEventBusNames,
  HARDWARE_ERROR_DIALOG_TYPES,
  appEventBus,
} from '../../eventBus/appEventBus';
import {
  BluetoothUnavailableWhileUsbConnectedError,
  ConnectTimeoutError,
  DeviceBondError,
  DeviceMethodCallTimeout,
} from '../errors/hardwareErrors';
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

describe('DeviceMethodCallTimeout', () => {
  it('uses the existing connection-failed help text', () => {
    expect(new DeviceMethodCallTimeout()).toMatchObject({
      key: 'global.connection_failed_help_text',
    });
  });
});

describe('convertDeviceError BLE connection timeout', () => {
  it.each([
    HardwareErrorCode.BleConnectedError,
    HardwareErrorCode.PollingTimeout,
  ])('uses the existing connection-failed help text for code %s', (code) => {
    const error = convertDeviceError({
      code,
      error: 'BLE setup wedged repeatedly',
    });

    expect(error).toBeInstanceOf(ConnectTimeoutError);
    expect(error).toMatchObject({
      key: 'global.connection_failed_help_text',
    });
  });
});

describe('convertDeviceError invalid Bluetooth bond', () => {
  it.each([
    HardwareErrorCode.BleDeviceBondError,
    HardwareErrorCode.BlePeerRemovedPairingInformation,
  ])(
    'tells the user to re-pair the device in system settings for code %s',
    (code) => {
      const error = convertDeviceError({
        code,
      });

      expect(error).toBeInstanceOf(DeviceBondError);
      expect(error).toMatchObject({
        code: HardwareErrorCode.BleDeviceBondError,
        key: 'feedback.try_repairing_device_in_settings',
        autoToast: false,
      });
    },
  );

  it('opens the shared repair dialog for interactive calls', () => {
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    convertDeviceError({
      code: HardwareErrorCode.BlePeerRemovedPairingInformation,
      connectId: 'PRO2_BLE',
    });

    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.ShowHardwareErrorDialog,
      expect.objectContaining({
        errorType: HARDWARE_ERROR_DIALOG_TYPES.BLE_DEVICE_BOND_ERROR,
        errorCode: HardwareErrorCode.BlePeerRemovedPairingInformation,
      }),
    );
    emitSpy.mockRestore();
  });

  it('does not open the repair dialog for silent probes', () => {
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    convertDeviceError(
      {
        code: HardwareErrorCode.BleDeviceBondError,
        connectId: 'PRO2_BLE',
      },
      { silentMode: true },
    );

    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.ShowHardwareErrorDialog,
      expect.anything(),
    );
    emitSpy.mockRestore();
  });
});
