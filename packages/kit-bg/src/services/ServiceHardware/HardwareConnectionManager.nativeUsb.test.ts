import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

import { hardwareForceTransportAtom } from '../../states/jotai/atoms';

import { HardwareConnectionManager } from './HardwareConnectionManager';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isJest: true,
    isNative: true,
    isNativeAndroid: true,
    isNativeIOS: false,
    isDesktop: false,
    isSupportDesktopBle: false,
    isWeb: false,
    isExtension: false,
  },
}));

const mutablePlatformEnv = platformEnv as unknown as {
  isNativeAndroid: boolean;
  isNativeIOS: boolean;
};

describe('HardwareConnectionManager Android automatic USB + BLE transport', () => {
  beforeEach(() => {
    jest
      .spyOn(hardwareForceTransportAtom, 'get')
      .mockResolvedValue({ forceTransportType: undefined } as never);
    Object.assign(mutablePlatformEnv, {
      isNativeAndroid: true,
      isNativeIOS: false,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    HardwareConnectionManager.resetInstance();
  });

  it('tracks live Android USB presence dynamically and drops stale NativeUsb when disconnected or kill-switched', async () => {
    const isAndroidUsbAutoEnabled = jest.fn().mockResolvedValue(true);
    const manager = HardwareConnectionManager.getInstance({
      backgroundApi: {
        serviceSetting: {
          isAndroidUsbAutoEnabled,
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.NativeUsb),
          setHardwareTransportType: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });

    // No USB device attached yet -> even a stale runtime NativeUsb resolves to BLE.
    await manager.setCurrentTransportType(EHardwareTransportType.NativeUsb);
    await expect(manager.getCurrentTransportType()).resolves.toBe(
      EHardwareTransportType.BLE,
    );

    // USB attach or searchDevices result switches live transport to NativeUsb.
    manager.androidUsbPresence.handleDeviceConnect({
      connectId: 'PR123456',
      serialNo: 'PR123456',
      commType: 'usb',
    });
    await expect(manager.getCurrentTransportType()).resolves.toBe(
      EHardwareTransportType.NativeUsb,
    );

    // Turning kill-switch ON immediately drops live transport back to BLE even before unplug.
    isAndroidUsbAutoEnabled.mockResolvedValue(false);
    await expect(manager.getCurrentTransportType()).resolves.toBe(
      EHardwareTransportType.BLE,
    );

    // Turning kill-switch OFF restores NativeUsb while USB device is present.
    isAndroidUsbAutoEnabled.mockResolvedValue(true);
    await expect(manager.getCurrentTransportType()).resolves.toBe(
      EHardwareTransportType.NativeUsb,
    );

    // USB detach drops back to BLE without leaving stale NativeUsb behind.
    manager.androidUsbPresence.handleDeviceDisconnect({
      connectId: 'PR123456',
      commType: 'usb',
    });
    await expect(manager.getCurrentTransportType()).resolves.toBe(
      EHardwareTransportType.BLE,
    );
  });

  it('drops USB presence when non-BLE searchDevices finds no USB device', async () => {
    const manager = HardwareConnectionManager.getInstance({
      backgroundApi: {
        serviceSetting: {
          isAndroidUsbAutoEnabled: jest.fn().mockResolvedValue(true),
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.NativeUsb),
          setHardwareTransportType: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });

    manager.androidUsbPresence.noteSearchDevicesResult([
      { connectId: 'PR999', serialNo: 'PR999', commType: 'usb' },
    ]);
    await expect(manager.getCurrentTransportType()).resolves.toBe(
      EHardwareTransportType.NativeUsb,
    );

    // A BLE-only channel search must not clobber USB presence.
    manager.androidUsbPresence.noteSearchDevicesResult(
      [{ connectId: 'BLE_MAC', commType: 'ble' }],
      { transportType: 'ble' },
    );
    await expect(manager.getCurrentTransportType()).resolves.toBe(
      EHardwareTransportType.NativeUsb,
    );

    // Empty combined/USB search drops stale USB presence back to BLE.
    manager.androidUsbPresence.noteSearchDevicesResult([]);
    await expect(manager.getCurrentTransportType()).resolves.toBe(
      EHardwareTransportType.BLE,
    );
  });

  it('resolves getTransportTypeForChannel for usb and ble on Android auto vs kill-switch', async () => {
    const isAndroidUsbAutoEnabled = jest.fn().mockResolvedValue(true);
    const manager = HardwareConnectionManager.getInstance({
      backgroundApi: {
        serviceSetting: {
          isAndroidUsbAutoEnabled,
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.NativeUsb),
          setHardwareTransportType: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });

    await expect(
      manager.getTransportTypeForChannel({ transportType: 'usb' }),
    ).resolves.toBe(EHardwareTransportType.NativeUsb);
    await expect(
      manager.getTransportTypeForChannel({ transportType: 'ble' }),
    ).resolves.toBe(EHardwareTransportType.BLE);

    isAndroidUsbAutoEnabled.mockResolvedValue(false);
    await expect(
      manager.getTransportTypeForChannel({ transportType: 'usb' }),
    ).resolves.toBe(EHardwareTransportType.BLE);
  });

  it('keeps a forced NativeUsb firmware lock across the bootloader DISCONNECT', async () => {
    const forceSpy = jest
      .mocked(hardwareForceTransportAtom.get)
      .mockResolvedValue({
        forceTransportType: EHardwareTransportType.NativeUsb,
      } as never);
    const manager = HardwareConnectionManager.getInstance({
      backgroundApi: {
        serviceSetting: {
          isAndroidUsbAutoEnabled: jest.fn().mockResolvedValue(true),
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.NativeUsb),
          setHardwareTransportType: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });
    manager.androidUsbPresence.handleDeviceConnect({
      connectId: 'PR123456',
      serialNo: 'PR123456',
      commType: 'usb',
    });
    // Device reboots into bootloader: USB DISCONNECT clears presence.
    manager.androidUsbPresence.handleDeviceDisconnect({
      connectId: 'PR123456',
      serialNo: 'PR123456',
      commType: 'usb',
    });
    await expect(manager.getCurrentTransportType()).resolves.toBe(
      EHardwareTransportType.NativeUsb,
    );

    // After clearForceTransportType() the live presence decides again.
    forceSpy.mockResolvedValue({ forceTransportType: undefined } as never);
    await expect(manager.getCurrentTransportType()).resolves.toBe(
      EHardwareTransportType.BLE,
    );
  });
});
