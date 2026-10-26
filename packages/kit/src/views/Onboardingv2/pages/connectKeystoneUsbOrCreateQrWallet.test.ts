import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { connectKeystoneUsbOrCreateQrWallet } from './connectKeystoneUsbOrCreateQrWallet';

describe('Keystone USB onboarding fallback', () => {
  it('continues with one QR wallet creation after the USB connection times out', async () => {
    jest.useFakeTimers();
    const createQrWallet = jest.fn().mockResolvedValue(undefined);
    const connectUsb = jest.fn(
      () =>
        new Promise<{ success: false; payload: { code: number } }>(
          (resolve) => {
            setTimeout(
              () =>
                resolve({
                  success: false,
                  payload: { code: HardwareErrorCode.OperationTimeout },
                }),
              15_000,
            );
          },
        ),
    );
    try {
      const pending = connectKeystoneUsbOrCreateQrWallet({
        connectUsb,
        createQrWallet,
        isCurrentAttempt: () => true,
      });
      expect(createQrWallet).not.toHaveBeenCalled();
      jest.advanceTimersByTime(15_000);
      await expect(pending).resolves.toBeUndefined();
      expect(connectUsb).toHaveBeenCalledTimes(1);
      expect(createQrWallet).toHaveBeenCalledTimes(1);
      expect(createQrWallet).toHaveBeenCalledWith();
    } finally {
      jest.useRealTimers();
    }
  });

  it('preserves the connected USB operation without starting QR creation', async () => {
    const connected = {
      success: true as const,
      payload: {
        vendor: EHardwareVendor.keystone,
        operationId: 'test-operation',
        deviceId: 'aabbccdd',
        connectId: 'keystone-wallet:aabbccdd',
        connectionType: 'usb' as const,
        raw: {},
      },
    };
    const createQrWallet = jest.fn();
    await expect(
      connectKeystoneUsbOrCreateQrWallet({
        connectUsb: () => Promise.resolve(connected),
        createQrWallet,
        isCurrentAttempt: () => true,
      }),
    ).resolves.toBe(connected);
    expect(createQrWallet).not.toHaveBeenCalled();
  });

  it.each([
    HardwareErrorCode.DeviceNotFound,
    HardwareErrorCode.DeviceDisconnected,
    HardwareErrorCode.TransportError,
    HardwareErrorCode.TransportNotAvailable,
  ])('falls back for an unavailable USB connection (%s)', async (code) => {
    const createQrWallet = jest.fn().mockResolvedValue(undefined);
    await connectKeystoneUsbOrCreateQrWallet({
      connectUsb: () => Promise.resolve({ success: false, payload: { code } }),
      createQrWallet,
      isCurrentAttempt: () => true,
    });
    expect(createQrWallet).toHaveBeenCalledTimes(1);
  });

  it.each([
    HardwareErrorCode.UserAborted,
    HardwareErrorCode.UserRejected,
    HardwareErrorCode.DeviceMismatch,
    HardwareErrorCode.DeviceBusyInternal,
    HardwareErrorCode.DeviceOneDeviceOnly,
    HardwareErrorCode.DeviceNotInitialized,
  ])('preserves cancellation and device errors (%s)', async (code) => {
    const failed = { success: false as const, payload: { code } };
    const createQrWallet = jest.fn();
    await expect(
      connectKeystoneUsbOrCreateQrWallet({
        connectUsb: () => Promise.resolve(failed),
        createQrWallet,
        isCurrentAttempt: () => true,
      }),
    ).resolves.toBe(failed);
    expect(createQrWallet).not.toHaveBeenCalled();
  });

  it('does not open QR when the setup attempt was cancelled while connecting', async () => {
    const createQrWallet = jest.fn();
    await connectKeystoneUsbOrCreateQrWallet({
      connectUsb: () =>
        Promise.resolve({
          success: false,
          payload: { code: HardwareErrorCode.OperationTimeout },
        }),
      createQrWallet,
      isCurrentAttempt: () => false,
    });
    expect(createQrWallet).not.toHaveBeenCalled();
  });

  it('propagates cancellation of QR creation without retrying USB', async () => {
    const cancelled = new Error('QR scan cancelled');
    const connectUsb = jest.fn().mockResolvedValue({
      success: false,
      payload: { code: HardwareErrorCode.OperationTimeout },
    });
    const createQrWallet = jest.fn().mockRejectedValue(cancelled);
    await expect(
      connectKeystoneUsbOrCreateQrWallet({
        connectUsb,
        createQrWallet,
        isCurrentAttempt: () => true,
      }),
    ).rejects.toBe(cancelled);
    expect(connectUsb).toHaveBeenCalledTimes(1);
    expect(createQrWallet).toHaveBeenCalledTimes(1);
  });
});
