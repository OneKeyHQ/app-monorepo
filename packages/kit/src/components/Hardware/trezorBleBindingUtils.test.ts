import {
  buildTrezorBleBindingCandidates,
  findTrezorAutoFallbackConnectId,
  getTrezorBleBindingCandidateState,
  getTrezorBleBindingScanOptions,
} from './trezorBleBindingUtils';

import type { ITrezorBleBindingScannedDevice } from './trezorBleBindingUtils';

function device({
  connectId,
  name,
  connectionType,
  rawDeviceId,
}: {
  connectId?: string | null;
  name: string;
  connectionType?: 'usb' | 'ble';
  rawDeviceId?: string;
}): ITrezorBleBindingScannedDevice {
  return {
    connectId,
    name,
    deviceId: '',
    deviceType: 'unknown',
    uuid: '',
    raw: { connectionType, deviceId: rawDeviceId },
  } as ITrezorBleBindingScannedDevice;
}

describe('trezorBleBindingUtils', () => {
  it('uses BLE-only search only for manual binding mode', () => {
    expect(getTrezorBleBindingScanOptions('manual-binding')).toEqual({
      resetSession: true,
      transportType: 'ble',
    });

    expect(getTrezorBleBindingScanOptions('auto-fallback')).toEqual({
      resetSession: true,
      waitForAllTransports: true,
    });
  });

  it('uses the known USB connectId as an automatic fallback when USB is discovered', () => {
    expect(
      findTrezorAutoFallbackConnectId({
        mode: 'auto-fallback',
        devices: [
          device({
            connectId: 'USB_CONNECT_ID',
            name: 'Trezor USB',
            connectionType: 'usb',
          }),
          device({
            connectId: 'BLE_CONNECT_ID',
            name: 'Trezor BLE',
            connectionType: 'ble',
          }),
        ],
        usbConnectId: 'USB_CONNECT_ID',
        featuresDeviceId: 'FEATURES_DEVICE_ID',
      }),
    ).toBe('USB_CONNECT_ID');

    expect(
      findTrezorAutoFallbackConnectId({
        mode: 'manual-binding',
        devices: [
          device({
            connectId: 'USB_CONNECT_ID',
            name: 'Trezor USB',
            connectionType: 'usb',
          }),
        ],
        usbConnectId: 'USB_CONNECT_ID',
        featuresDeviceId: 'FEATURES_DEVICE_ID',
      }),
    ).toBeNull();
  });

  it('recovers a changed Trezor USB connectId from the stable features device_id', () => {
    expect(
      findTrezorAutoFallbackConnectId({
        mode: 'auto-fallback',
        devices: [
          device({
            connectId: 'CURRENT_USB_CONNECT_ID',
            name: 'Trezor Safe 7',
            connectionType: 'usb',
          }),
        ],
        usbConnectId: 'STALE_USB_CONNECT_ID',
        featuresDeviceId: 'CURRENT_USB_CONNECT_ID',
      }),
    ).toBe('CURRENT_USB_CONNECT_ID');
  });

  it('prefers the scanned device identity over a reused stale connectId', () => {
    expect(
      findTrezorAutoFallbackConnectId({
        mode: 'auto-fallback',
        devices: [
          device({
            connectId: 'STALE_USB_CONNECT_ID',
            name: 'Different Trezor',
            connectionType: 'usb',
            rawDeviceId: 'DIFFERENT_DEVICE_ID',
          }),
          device({
            connectId: 'CURRENT_USB_CONNECT_ID',
            name: 'Expected Trezor',
            connectionType: 'usb',
            rawDeviceId: 'FEATURES_DEVICE_ID',
          }),
        ],
        usbConnectId: 'STALE_USB_CONNECT_ID',
        featuresDeviceId: 'FEATURES_DEVICE_ID',
      }),
    ).toBe('CURRENT_USB_CONNECT_ID');
  });

  it('keeps only BLE candidates that are not the known USB device and sorts them naturally', () => {
    const candidates = buildTrezorBleBindingCandidates({
      devices: [
        device({
          connectId: 'USB_CONNECT_ID',
          name: 'Trezor USB',
          connectionType: 'usb',
        }),
        device({
          connectId: 'BLE_10',
          name: 'Trezor 10',
          connectionType: 'ble',
        }),
        device({
          connectId: 'BLE_2',
          name: 'Trezor 2',
          connectionType: 'ble',
        }),
        device({
          name: 'Missing connectId',
          connectionType: 'ble',
        }),
        device({
          connectId: 'UNKNOWN_TRANSPORT',
          name: 'Unknown',
        }),
      ],
      usbConnectId: 'USB_CONNECT_ID',
    });

    expect(candidates.map((item) => item.connectId)).toEqual([
      'BLE_2',
      'BLE_10',
    ]);
  });

  it('marks rejected candidates disabled while keeping other candidates selectable', () => {
    expect(
      getTrezorBleBindingCandidateState({
        connectId: 'BLE_1',
        bindingId: null,
        rejectedConnectIds: { BLE_1: true },
      }),
    ).toEqual({
      isBinding: false,
      isRejected: true,
      disabled: true,
      drillIn: false,
      opacity: 0.5,
    });

    expect(
      getTrezorBleBindingCandidateState({
        connectId: 'BLE_2',
        bindingId: null,
        rejectedConnectIds: { BLE_1: true },
      }),
    ).toEqual({
      isBinding: false,
      isRejected: false,
      disabled: false,
      drillIn: true,
      opacity: 1,
    });
  });

  it('disables other candidates while one candidate is being probed', () => {
    expect(
      getTrezorBleBindingCandidateState({
        connectId: 'BLE_1',
        bindingId: 'BLE_2',
        rejectedConnectIds: {},
      }),
    ).toEqual({
      isBinding: false,
      isRejected: false,
      disabled: true,
      drillIn: false,
      opacity: 0.5,
    });

    expect(
      getTrezorBleBindingCandidateState({
        connectId: 'BLE_2',
        bindingId: 'BLE_2',
        rejectedConnectIds: {},
      }).isBinding,
    ).toBe(true);
  });
});
