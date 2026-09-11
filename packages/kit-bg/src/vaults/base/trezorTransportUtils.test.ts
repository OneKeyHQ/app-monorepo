import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import { callTrezorWithDevice } from './trezorTransportUtils';

import type { IDBDevice } from '../../dbs/local/types';

const dbDevice = {
  id: 'device-record-id',
  connectId: 'USB_CONNECT_ID',
  usbConnectId: 'USB_CONNECT_ID',
  bleConnectId: 'BLE_CONNECT_ID',
  deviceId: 'FEATURES_DEVICE_ID',
} as IDBDevice;

describe('callTrezorWithDevice SDK ownership', () => {
  it('passes the saved USB hint once while leaving target resolution to the SDK', async () => {
    const response = {
      success: true as const,
      payload: { address: 'verified-address' },
    };
    const fn = jest.fn(async () => response);

    await expect(callTrezorWithDevice(dbDevice, fn)).resolves.toBe(response);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('USB_CONNECT_ID');
  });

  it('never replays a business call in App after a transport error', async () => {
    const response = {
      success: false as const,
      payload: {
        code: HardwareErrorCode.DeviceDisconnected,
        error: 'Reply lost',
      },
    };
    const fn = jest.fn(async () => response);

    await expect(callTrezorWithDevice(dbDevice, fn)).resolves.toBe(response);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('requires an expected identity before requesting operation-first resolution', async () => {
    const fn = jest.fn();
    await expect(
      callTrezorWithDevice({ ...dbDevice, deviceId: '' }, fn),
    ).rejects.toThrow('Trezor device identity is required');
    expect(fn).not.toHaveBeenCalled();
  });
});
