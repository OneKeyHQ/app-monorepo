import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  const originalIsDesktop = platformEnv.isDesktop;
  const originalIsSupportDesktopBle = platformEnv.isSupportDesktopBle;

  beforeEach(() => {
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    (platformEnv as { isSupportDesktopBle: boolean }).isSupportDesktopBle =
      true;
  });

  afterEach(() => {
    (platformEnv as { isDesktop: boolean | undefined }).isDesktop =
      originalIsDesktop;
    (
      platformEnv as { isSupportDesktopBle: boolean | undefined }
    ).isSupportDesktopBle = originalIsSupportDesktopBle;
  });

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

  it('does not use existing bound BLE connectId outside desktop', async () => {
    (platformEnv as { isDesktop: boolean }).isDesktop = false;
    (platformEnv as { isSupportDesktopBle: boolean }).isSupportDesktopBle =
      false;
    const boundDbDevice = {
      ...dbDevice,
      bleConnectId: 'BLE_CONNECT_ID',
    } as IDBDevice;
    const originalFailure = {
      success: false as const,
      payload: {
        code: HardwareErrorCode.DeviceDisconnected,
        error: 'DeviceDisconnected',
      },
    };
    const fn = jest.fn(async () => originalFailure);
    const requestBleConnectId = jest.fn(async () => 'NEW_BLE_CONNECT_ID');

    await expect(
      callTrezorWithBleFallback(boundDbDevice, fn, { requestBleConnectId }),
    ).resolves.toBe(originalFailure);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('USB_CONNECT_ID');
    expect(requestBleConnectId).not.toHaveBeenCalled();
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

  it('uses bound BLE connectId when primary USB fails with TransportError', async () => {
    const boundDbDevice = {
      ...dbDevice,
      bleConnectId: 'BLE_CONNECT_ID',
    } as IDBDevice;
    const fn = jest
      .fn()
      .mockResolvedValueOnce({
        success: false,
        payload: {
          code: HardwareErrorCode.TransportError,
          error: 'Trezor WebUSB transferIn failed: stall',
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

  it('re-binds and retries when an already-bound BLE connectId also fails', async () => {
    const boundDbDevice = {
      ...dbDevice,
      bleConnectId: 'STALE_BLE_CONNECT_ID',
    } as IDBDevice;
    const fn = jest
      .fn()
      .mockResolvedValueOnce({
        success: false,
        payload: { code: HardwareErrorCode.DeviceNotFound, error: 'not found' },
      })
      .mockResolvedValueOnce({
        success: false,
        payload: { code: HardwareErrorCode.DeviceNotFound, error: 'not found' },
      })
      .mockResolvedValueOnce({ success: true, payload: { address: '0x5678' } });
    const requestBleConnectId = jest.fn(async () => 'NEW_BLE_CONNECT_ID');

    const result = await callTrezorWithBleFallback(boundDbDevice, fn, {
      requestBleConnectId,
    });

    expect(result).toEqual({ success: true, payload: { address: '0x5678' } });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenNthCalledWith(1, 'USB_CONNECT_ID');
    expect(fn).toHaveBeenNthCalledWith(2, 'STALE_BLE_CONNECT_ID');
    expect(fn).toHaveBeenNthCalledWith(3, 'NEW_BLE_CONNECT_ID');
    expect(requestBleConnectId).toHaveBeenCalledTimes(1);
  });

  it('re-binds on a stale bond (BleBondInvalid) without reusing the stored handle', async () => {
    const boundDbDevice = {
      ...dbDevice,
      bleConnectId: 'STALE_BLE_CONNECT_ID',
    } as IDBDevice;
    const fn = jest
      .fn()
      .mockResolvedValueOnce({
        success: false,
        payload: {
          code: HardwareErrorCode.BleBondInvalid,
          error: 'bond invalid',
        },
      })
      .mockResolvedValueOnce({ success: true, payload: { address: '0x5678' } });
    const requestBleConnectId = jest.fn(async () => 'NEW_BLE_CONNECT_ID');

    const result = await callTrezorWithBleFallback(boundDbDevice, fn, {
      requestBleConnectId,
    });

    expect(result).toEqual({ success: true, payload: { address: '0x5678' } });
    // The stale stored handle must NOT be reused for a bond/pairing failure.
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'USB_CONNECT_ID');
    expect(fn).toHaveBeenNthCalledWith(2, 'NEW_BLE_CONNECT_ID');
    expect(requestBleConnectId).toHaveBeenCalledTimes(1);
  });

  it('re-binds on a stale THP credential (ThpPairingFailed)', async () => {
    const fn = jest
      .fn()
      .mockResolvedValueOnce({
        success: false,
        payload: {
          code: HardwareErrorCode.ThpPairingFailed,
          error: 'pairing failed',
        },
      })
      .mockResolvedValueOnce({ success: true, payload: { address: '0x5678' } });
    const requestBleConnectId = jest.fn(async () => 'NEW_BLE_CONNECT_ID');

    const result = await callTrezorWithBleFallback(dbDevice, fn, {
      requestBleConnectId,
    });

    expect(result).toEqual({ success: true, payload: { address: '0x5678' } });
    expect(fn).toHaveBeenNthCalledWith(2, 'NEW_BLE_CONNECT_ID');
    expect(requestBleConnectId).toHaveBeenCalledTimes(1);
  });

  it('returns the bond failure when re-binding produces no new connectId', async () => {
    const boundDbDevice = {
      ...dbDevice,
      bleConnectId: 'STALE_BLE_CONNECT_ID',
    } as IDBDevice;
    const bondFailure = {
      success: false as const,
      payload: {
        code: HardwareErrorCode.BleBondInvalid,
        error: 'bond invalid',
      },
    };
    const fn = jest.fn(async () => bondFailure);
    // OS bond still present → user can't complete re-binding → null.
    const requestBleConnectId = jest.fn(async () => null);

    const result = await callTrezorWithBleFallback(boundDbDevice, fn, {
      requestBleConnectId,
    });

    expect(result).toBe(bondFailure);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(requestBleConnectId).toHaveBeenCalledTimes(1);
  });

  it('returns the retry failure when a re-bound connectId still fails', async () => {
    const boundDbDevice = {
      ...dbDevice,
      bleConnectId: 'STALE_BLE_CONNECT_ID',
    } as IDBDevice;
    const retryFailure = {
      success: false as const,
      payload: {
        code: HardwareErrorCode.BleBondInvalid,
        error: 'still bad after re-bind',
      },
    };
    const fn = jest
      .fn()
      .mockResolvedValueOnce({
        success: false,
        payload: {
          code: HardwareErrorCode.BleBondInvalid,
          error: 'bond invalid',
        },
      })
      // Re-bound to a fresh connectId, but the OS bond is still bad → retry
      // fails again. Must surface that failure once, with no further loop.
      .mockResolvedValueOnce(retryFailure);
    const requestBleConnectId = jest.fn(async () => 'NEW_BLE_CONNECT_ID');

    const result = await callTrezorWithBleFallback(boundDbDevice, fn, {
      requestBleConnectId,
    });

    expect(result).toBe(retryFailure);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(2, 'NEW_BLE_CONNECT_ID');
    expect(requestBleConnectId).toHaveBeenCalledTimes(1);
  });
});
