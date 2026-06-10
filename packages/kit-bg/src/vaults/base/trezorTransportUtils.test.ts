import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import { callTrezorWithBleFallback } from './trezorTransportUtils';

import type { IDBDevice } from '../../dbs/local/types';

const dbDevice = {
  id: 'device-record-id',
  connectId: 'USB_CONNECT_ID',
  usbConnectId: 'USB_CONNECT_ID',
  deviceId: 'FEATURES_DEVICE_ID',
  settingsRaw: JSON.stringify({
    vendor: 'trezor',
    vendorModel: 'T3W1',
    vendorModelName: 'Safe 7',
  }),
} as IDBDevice;

describe('callTrezorWithBleFallback', () => {
  it('prefers usbConnectId over firmware device identity for the primary USB call', async () => {
    const deviceWithFirmwareConnectId = {
      ...dbDevice,
      connectId: 'FEATURES_DEVICE_ID',
      usbConnectId: 'USB_CONNECT_ID',
    } as IDBDevice;
    const fn = jest.fn(async () => ({
      success: true as const,
      payload: { address: '0x1234' },
    }));

    const result = await callTrezorWithBleFallback(
      deviceWithFirmwareConnectId,
      fn,
    );

    expect(result).toEqual({
      success: true,
      payload: { address: '0x1234' },
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('USB_CONNECT_ID');
  });

  it('uses a newly bound BLE connectId and retries the current call when USB cannot find the device', async () => {
    const fn = jest
      .fn()
      .mockResolvedValueOnce({
        success: false,
        payload: {
          code: HardwareErrorCode.DeviceNotFound,
          error: 'DeviceNotFound',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        payload: { address: '0x1234' },
      });
    const requestBleConnectId = jest.fn(async () => 'BLE_CONNECT_ID');

    const result = await callTrezorWithBleFallback(dbDevice, fn, {
      requestBleConnectId,
    });

    expect(result).toEqual({
      success: true,
      payload: { address: '0x1234' },
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'USB_CONNECT_ID');
    expect(fn).toHaveBeenNthCalledWith(2, 'BLE_CONNECT_ID');
    expect(requestBleConnectId).toHaveBeenCalledWith({
      dbDevice,
      usbConnectId: 'USB_CONNECT_ID',
      featuresDeviceId: 'FEATURES_DEVICE_ID',
    });
  });

  it('does not request BLE binding for Trezor models without BLE support', async () => {
    const safe5Device = {
      ...dbDevice,
      settingsRaw: JSON.stringify({
        vendor: 'trezor',
        vendorModel: 'Safe 5',
        vendorModelName: 'Safe 5',
      }),
    } as IDBDevice;
    const originalFailure = {
      success: false as const,
      payload: {
        code: HardwareErrorCode.DeviceNotFound,
        error: 'DeviceNotFound',
      },
    };
    const fn = jest.fn(async () => originalFailure);
    const requestBleConnectId = jest.fn(async () => 'BLE_CONNECT_ID');

    await expect(
      callTrezorWithBleFallback(safe5Device, fn, { requestBleConnectId }),
    ).resolves.toBe(originalFailure);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(requestBleConnectId).not.toHaveBeenCalled();
  });

  it('requests BLE binding from SDK-recognized display model names', async () => {
    const safe7DisplayNameOnlyDevice = {
      ...dbDevice,
      settingsRaw: JSON.stringify({
        vendor: 'trezor',
        vendorModel: 'Safe 7',
        vendorModelName: 'Safe 7',
      }),
    } as IDBDevice;
    const originalFailure = {
      success: false as const,
      payload: {
        code: HardwareErrorCode.DeviceNotFound,
        error: 'DeviceNotFound',
      },
    };
    const fn = jest.fn(async () => originalFailure);
    const requestBleConnectId = jest.fn(async () => 'BLE_CONNECT_ID');

    await expect(
      callTrezorWithBleFallback(safe7DisplayNameOnlyDevice, fn, {
        requestBleConnectId,
      }),
    ).resolves.toBe(originalFailure);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(requestBleConnectId).toHaveBeenCalledTimes(1);
  });

  it('requests BLE binding for Trezor Safe 7 model identifiers', async () => {
    const safe7Device = {
      ...dbDevice,
      settingsRaw: JSON.stringify({
        vendor: 'trezor',
        vendorModel: 'T3W1',
        vendorModelName: 'Safe 7',
      }),
    } as IDBDevice;
    const fn = jest
      .fn()
      .mockResolvedValueOnce({
        success: false,
        payload: {
          code: HardwareErrorCode.DeviceNotFound,
          error: 'DeviceNotFound',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        payload: { address: '0x1234' },
      });
    const requestBleConnectId = jest.fn(async () => 'BLE_CONNECT_ID');

    await expect(
      callTrezorWithBleFallback(safe7Device, fn, { requestBleConnectId }),
    ).resolves.toEqual({
      success: true,
      payload: { address: '0x1234' },
    });
    expect(requestBleConnectId).toHaveBeenCalledTimes(1);
  });

  it('returns the original failure when the user does not bind a BLE device', async () => {
    const originalFailure = {
      success: false as const,
      payload: {
        code: HardwareErrorCode.DeviceDisconnected,
        error: 'DeviceDisconnected',
      },
    };
    const fn = jest.fn(async () => originalFailure);
    const requestBleConnectId = jest.fn(async () => null);

    await expect(
      callTrezorWithBleFallback(dbDevice, fn, { requestBleConnectId }),
    ).resolves.toBe(originalFailure);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses an existing bound BLE connectId without requesting a new binding', async () => {
    const boundDbDevice = {
      ...dbDevice,
      bleConnectId: 'BLE_CONNECT_ID',
    } as IDBDevice;
    const fn = jest
      .fn()
      .mockResolvedValueOnce({
        success: false,
        payload: {
          code: HardwareErrorCode.DeviceDisconnected,
          error: 'DeviceDisconnected',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        payload: { address: '0x5678' },
      });
    const requestBleConnectId = jest.fn(async () => 'NEW_BLE_CONNECT_ID');

    const result = await callTrezorWithBleFallback(boundDbDevice, fn, {
      requestBleConnectId,
    });

    expect(result).toEqual({
      success: true,
      payload: { address: '0x5678' },
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'USB_CONNECT_ID');
    expect(fn).toHaveBeenNthCalledWith(2, 'BLE_CONNECT_ID');
    expect(requestBleConnectId).not.toHaveBeenCalled();
  });

  it('does not request BLE binding for non-transport errors', async () => {
    const originalFailure = {
      success: false as const,
      payload: {
        code: HardwareErrorCode.UserRejected,
        error: 'UserRejected',
      },
    };
    const fn = jest.fn(async () => originalFailure);
    const requestBleConnectId = jest.fn(async () => 'BLE_CONNECT_ID');

    await expect(
      callTrezorWithBleFallback(dbDevice, fn, { requestBleConnectId }),
    ).resolves.toBe(originalFailure);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(requestBleConnectId).not.toHaveBeenCalled();
  });
});
