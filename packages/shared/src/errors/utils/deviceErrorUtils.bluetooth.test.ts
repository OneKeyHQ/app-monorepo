import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import platformEnv from '../../platformEnv';
import {
  BleDeviceBondedCanceled,
  BluetoothUnavailableWhileUsbConnectedError,
  ConnectTimeoutError,
  DeviceMethodCallTimeout,
  DeviceNotBonded,
  NeedBluetoothTurnedOn,
  UserCancel,
} from '../errors/hardwareErrors';
import { OneKeyLocalError } from '../errors/localError';
import {
  EOneKeyErrorClassNames,
  ONEKEY_WEBUSB_DEVICE_ACCESS_ERROR_CODE,
} from '../types/errorTypes';

import {
  convertDeviceError,
  convertDeviceResponse,
  isDesktopBlePairingCanceledError,
  isOneKeyHardwareError,
} from './deviceErrorUtils';

describe('isOneKeyHardwareError', () => {
  it.each([
    [
      HardwareErrorCode.BlePoweredOff,
      'hardware.bluetooth_need_turned_on_error',
    ],
    [
      HardwareErrorCode.BleUnsupported,
      'hardware_third_party_transport_not_available',
    ],
    [
      ONEKEY_WEBUSB_DEVICE_ACCESS_ERROR_CODE,
      'global.connection_failed_usb_help_text',
    ],
    [HardwareErrorCode.BridgeNeedsPermission, 'device.grant_usb_access'],
  ])(
    'localizes transport error %s without treating it as an unknown firmware error',
    (code, key) => {
      expect(
        convertDeviceError({ code, error: 'Native transport failure' }),
      ).toMatchObject({
        code,
        key,
        className: EOneKeyErrorClassNames.OneKeyHardwareError,
        payload: { code },
      });
    },
  );

  it('preserves native recovery context when the SDK throws a HardwareError', async () => {
    const params = { operation: 'open', nativeErrorMessage: 'Access denied' };
    await expect(
      convertDeviceResponse(async () => {
        throw Object.assign(new Error('Access denied'), {
          errorCode: HardwareErrorCode.BridgeNeedsPermission,
          params,
        });
      }),
    ).rejects.toMatchObject({
      code: HardwareErrorCode.BridgeNeedsPermission,
      payload: { params },
    });
  });
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

describe('convertDeviceError cancellation', () => {
  it.each([
    HardwareErrorCode.ActionCancelled,
    HardwareErrorCode.CallQueueActionCancelled,
  ])(
    'maps raw cancellation code %s to the localized user-cancel error',
    (code) => {
      const error = convertDeviceError({ code, error: 'Cancelled' });

      expect(error).toBeInstanceOf(UserCancel);
      expect(error).toMatchObject({
        key: 'hardware.user_cancel_error',
      });
    },
  );
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
  it('uses existing pairing-failed feedback for desktop not-bonded errors', () => {
    const originalIsDesktop = platformEnv.isDesktop;
    platformEnv.isDesktop = true;

    try {
      const error = convertDeviceError({
        code: HardwareErrorCode.BleDeviceNotBonded,
        error: 'device is not bonded',
        params: {
          nativeErrorMessage:
            'Notification subscription failed: Encryption is insufficient',
        },
      });

      expect(error).toBeInstanceOf(DeviceNotBonded);
      expect(error).toMatchObject({
        code: HardwareErrorCode.BleDeviceNotBonded,
        key: 'feedback.bluetooth_pairing_failed',
      });
    } finally {
      platformEnv.isDesktop = originalIsDesktop;
    }
  });

  it('keeps the existing unpaired feedback off desktop', () => {
    const originalIsDesktop = platformEnv.isDesktop;
    platformEnv.isDesktop = false;

    try {
      const error = convertDeviceError({
        code: HardwareErrorCode.BleDeviceNotBonded,
      });

      expect(error).toBeInstanceOf(DeviceNotBonded);
      expect(error).toMatchObject({
        key: 'feedback.bluetooth_unpaired',
      });
    } finally {
      platformEnv.isDesktop = originalIsDesktop;
    }
  });

  it('treats a canceled pairing as user cancellation on desktop', () => {
    const originalIsDesktop = platformEnv.isDesktop;
    platformEnv.isDesktop = true;

    try {
      const error = convertDeviceError({
        code: HardwareErrorCode.BleDeviceBondedCanceled,
        error: 'bonding canceled',
      });

      expect(error).toBeInstanceOf(UserCancel);
      expect(error).toMatchObject({
        code: HardwareErrorCode.ActionCancelled,
        key: 'hardware.user_cancel_error',
        autoToast: false,
        payload: {
          code: HardwareErrorCode.BleDeviceBondedCanceled,
        },
      });
      expect(isDesktopBlePairingCanceledError(error)).toBe(true);
    } finally {
      platformEnv.isDesktop = originalIsDesktop;
    }
  });

  it('keeps a canceled pairing distinct from an unpaired device off desktop', () => {
    const originalIsDesktop = platformEnv.isDesktop;
    platformEnv.isDesktop = false;

    try {
      const error = convertDeviceError({
        code: HardwareErrorCode.BleDeviceBondedCanceled,
        error: 'bonding canceled',
      });

      expect(error).toBeInstanceOf(BleDeviceBondedCanceled);
      expect(error).toMatchObject({
        code: HardwareErrorCode.BleDeviceNotBonded,
        key: 'feedback.bluetooth_pairing_failed',
        payload: {
          code: HardwareErrorCode.BleDeviceBondedCanceled,
        },
      });
      expect(isDesktopBlePairingCanceledError(error)).toBe(false);
    } finally {
      platformEnv.isDesktop = originalIsDesktop;
    }
  });
});

describe('convertDeviceResponse thrown SDK errors', () => {
  it('keeps the Bluetooth-off code and key when the transport throws', async () => {
    const thrown = Object.assign(
      new Error('Bluetooth required to be turned on'),
      { errorCode: HardwareErrorCode.BlePermissionError },
    );
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      convertDeviceResponse(async () => {
        throw thrown;
      }),
    ).rejects.toMatchObject({
      code: HardwareErrorCode.BlePermissionError,
      key: 'hardware.bluetooth_need_turned_on_error',
    });
    await expect(
      convertDeviceResponse(async () => {
        throw thrown;
      }),
    ).rejects.toBeInstanceOf(NeedBluetoothTurnedOn);
  });
});
