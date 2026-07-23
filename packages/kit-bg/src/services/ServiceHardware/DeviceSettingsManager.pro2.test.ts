import { EDeviceType } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import { DeviceSettingsManager } from './DeviceSettingsManager';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice } from '../../dbs/local/types';
import type { CoreApi } from '@onekeyfe/hd-core';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/utils/deviceHomeScreenUtils', () => ({
  __esModule: true,
  default: {
    isMonochromeScreen: jest.fn(() => false),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('jpeg-js', () => ({
  decode: jest.fn(() => ({
    width: 604,
    height: 1024,
    data: new Uint8Array(604 * 1024 * 4),
  })),
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getWalletDevice: jest.fn(),
    getDeviceByQuery: jest.fn(),
    getDevice: jest.fn(),
    updateDevice: jest.fn(),
  },
}));

function buildDevice(deviceType: EDeviceType): IDBDevice {
  return {
    id: 'db-device-1',
    connectId: 'PRO2_CONNECT_ID',
    deviceId: 'PRO2_DEVICE_ID',
    deviceType,
    vendor: EHardwareVendor.onekey,
    name: 'OneKey Pro 2',
    features: '{}',
    settingsRaw: '{}',
    createdAt: 0,
    updatedAt: 0,
  } as IDBDevice;
}

function buildManager(device: IDBDevice, sdk: CoreApi) {
  jest.spyOn(localDb, 'getDeviceByQuery').mockResolvedValue(device);
  jest.spyOn(localDb, 'getWalletDevice').mockResolvedValue(device);
  const manager = new DeviceSettingsManager({
    backgroundApi: {} as IBackgroundApi,
  });
  jest
    .spyOn(manager, '_withDeviceProcessing')
    .mockImplementation(async ({ action }) => {
      const response = await action(sdk, device.connectId, device);
      if (!response.success) throw new OneKeyLocalError('SDK call failed');
      return response.payload;
    });
  return manager;
}

describe('DeviceSettingsManager Pro2 adapter', () => {
  test.each([
    ['setLanguage', { language: 'ja-Jpan-JP' }, { language: 'ja-Jpan-JP' }],
    [
      'setAutoLockDelayMs',
      { autoLockDelayMs: 60_000 },
      { autoLockDelayMs: 60_000 },
    ],
    [
      'setAutoShutDownDelayMs',
      { autoShutdownDelayMs: 300_000 },
      { autoShutdownDelayMs: 300_000 },
    ],
    ['setHapticFeedback', { hapticFeedback: true }, { hapticFeedback: true }],
    [
      'setBrightness',
      { brightness: 60 },
      { brightness: 60, changeBrightness: true },
    ],
  ] as const)(
    'routes %s through the protocol-neutral deviceSettings API',
    async (methodName, params, settings) => {
      const deviceSettings = jest.fn(async () => ({
        success: true as const,
        payload: { message: 'Success' },
      }));
      const manager = buildManager(buildDevice(EDeviceType.Pro2), {
        deviceSettings,
      } as unknown as CoreApi);

      const method = manager[methodName] as (
        input: typeof params & { connectId: string },
      ) => Promise<unknown>;
      await method.call(manager, {
        connectId: 'PRO2_CONNECT_ID',
        ...params,
      });

      expect(deviceSettings).toHaveBeenCalledWith('PRO2_CONNECT_ID', settings);
    },
  );

  test('routes label updates through deviceSettings as well', async () => {
    const deviceSettings = jest.fn(async () => ({
      success: true as const,
      payload: { message: 'Success' },
    }));
    const manager = buildManager(buildDevice(EDeviceType.Pro2), {
      deviceSettings,
    } as unknown as CoreApi);

    await manager.setDeviceLabel({
      walletId: 'wallet-1',
      label: 'Renamed Pro 2',
    });

    expect(deviceSettings).toHaveBeenCalledWith('PRO2_CONNECT_ID', {
      label: 'Renamed Pro 2',
    });
  });

  test('relies on the SDK state event instead of manually patching the database', async () => {
    const deviceSettings = jest.fn(async () => ({
      success: true as const,
      payload: { message: 'Success' },
    }));
    const device = buildDevice(EDeviceType.Pro2);
    device.featuresInfo = {
      deviceId: 'PRO2_DEVICE_ID',
      autoLockDelayMs: 60_000,
    } as never;
    const manager = buildManager(device, {
      deviceSettings,
    } as unknown as CoreApi);
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    jest.mocked(localDb.updateDevice).mockClear();

    await manager.setAutoShutDownDelayMs({
      connectId: 'PRO2_CONNECT_ID',
      autoShutdownDelayMs: 300_000,
    });

    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    expect(localDb.updateDevice).not.toHaveBeenCalled();
  });

  test.each([
    ['changePin', { remove: false }, { page: 'DevicePinChange' }],
    ['wipeDevice', {}, { page: 'DeviceReset' }],
  ] as const)(
    'routes %s through deviceSettingsPageShow',
    async (methodName, params, pageParams) => {
      const deviceSettingsPageShow = jest.fn(async () => ({
        success: true as const,
        payload: { message: 'Success' },
      }));
      const manager = buildManager(buildDevice(EDeviceType.Pro2), {
        deviceSettingsPageShow,
      } as unknown as CoreApi);

      const method = manager[methodName] as (
        input: typeof params & { connectId: string },
      ) => Promise<unknown>;
      await method.call(manager, {
        connectId: 'PRO2_CONNECT_ID',
        ...params,
      });

      expect(deviceSettingsPageShow).toHaveBeenCalledWith(
        'PRO2_CONNECT_ID',
        pageParams,
      );
    },
  );

  test('refreshes canonical status after changing the Pro2 passphrase setting', async () => {
    const deviceSettingsPageShow = jest.fn(async () => ({
      success: true as const,
      payload: { message: 'Success' },
    }));
    const getDeviceState = jest.fn(async () => ({
      success: true as const,
      payload: { status: { passphraseProtection: true } },
    }));
    const manager = buildManager(buildDevice(EDeviceType.Pro2), {
      deviceSettingsPageShow,
      getDeviceState,
    } as unknown as CoreApi);

    await manager.setPassphraseEnabled({
      connectId: 'PRO2_CONNECT_ID',
      passphraseEnabled: true,
    });

    expect(deviceSettingsPageShow).toHaveBeenCalledWith('PRO2_CONNECT_ID', {
      page: 'DevicePassphrase',
      fieldName: 'passphrase_enable',
    });
    expect(getDeviceState).toHaveBeenCalledWith('PRO2_CONNECT_ID');
  });

  test('decodes the compressed Pro2 wallpaper in background before upload', async () => {
    const device = buildDevice(EDeviceType.Pro2);
    jest.spyOn(localDb, 'getDevice').mockResolvedValue(device);
    const deviceUploadWallpaper = jest.fn(async () => ({
      success: true as const,
      payload: { message: 'Success', path: 'vol1:/wallpapers/custom.bin' },
    }));
    const manager = new DeviceSettingsManager({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId: jest.fn(async () => device.connectId),
        },
        serviceHardwareUI: {
          withHardwareProcessing: jest.fn(
            async (action: () => Promise<unknown>) => action(),
          ),
        },
      } as unknown as IBackgroundApi,
    });
    jest.spyOn(manager, 'getSDKInstance').mockResolvedValue({
      deviceUploadWallpaper,
    } as unknown as CoreApi);

    const result = await manager.setDeviceHomeScreen({
      dbDeviceId: device.id,
      screenItem: {
        id: 'custom wallpaper',
        resType: 'custom',
        screenHex: 'ffd8ff',
        isUserUpload: true,
      },
    });

    expect(deviceUploadWallpaper).toHaveBeenCalledWith(device.connectId, {
      width: 604,
      height: 1024,
      rgba: expect.any(Uint8Array),
      fileName: 'custom-wallpaper',
    });
    expect(result).toMatchObject({ message: 'Success', applyScreen: true });
  });
});
