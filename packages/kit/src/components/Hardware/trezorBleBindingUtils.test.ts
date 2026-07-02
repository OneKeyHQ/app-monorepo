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
}: {
  connectId?: string | null;
  name: string;
  connectionType?: 'usb' | 'ble';
}): ITrezorBleBindingScannedDevice {
  return {
    connectId,
    name,
    deviceId: '',
    deviceType: 'unknown',
    uuid: '',
    raw: { connectionType },
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
      }),
    ).toBeNull();
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
