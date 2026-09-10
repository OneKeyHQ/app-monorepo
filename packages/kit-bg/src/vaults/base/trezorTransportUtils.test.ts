import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import { callTrezorWithBleFallback } from './trezorTransportUtils';

import type { IDBDevice } from '../../dbs/local/types';

const dbDevice = {
  id: 'device-record-id',
  connectId: 'USB_CONNECT_ID',
  usbConnectId: 'USB_CONNECT_ID',
  bleConnectId: 'BLE_CONNECT_ID',
  deviceId: 'FEATURES_DEVICE_ID',
} as IDBDevice;

describe('callTrezorWithBleFallback SDK ownership', () => {
  it('passes the saved USB hint once while leaving target resolution to the SDK', async () => {
    const response = {
      success: true as const,
      payload: { address: 'verified-address' },
    };
    const fn = jest.fn(async () => response);

    await expect(
      callTrezorWithBleFallback(dbDevice, fn, { replayPolicy: 'read-only' }),
    ).resolves.toBe(response);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('USB_CONNECT_ID');
  });

  it.each(['read-only', 'never'] as const)(
    'never replays a %s business call in App after a transport error',
    async (replayPolicy) => {
      const response = {
        success: false as const,
        payload: {
          code: HardwareErrorCode.DeviceDisconnected,
          error: 'Reply lost',
        },
      };
      const fn = jest.fn(async () => response);

      await expect(
        callTrezorWithBleFallback(dbDevice, fn, { replayPolicy }),
      ).resolves.toBe(response);
      expect(fn).toHaveBeenCalledTimes(1);
    },
  );

  it('requires an expected identity before requesting operation-first resolution', async () => {
    const fn = jest.fn();
    await expect(
      callTrezorWithBleFallback({ ...dbDevice, deviceId: '' }, fn, {
        replayPolicy: 'read-only',
      }),
    ).rejects.toThrow('Trezor device identity is required');
    expect(fn).not.toHaveBeenCalled();
  });
});
