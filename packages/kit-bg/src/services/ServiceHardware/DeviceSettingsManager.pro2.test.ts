import { EDeviceType } from '@onekeyfe/hd-shared';
import { DeviceSessionPinType } from '@onekeyfe/hd-transport';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceHomeScreenUtils from '@onekeyhq/shared/src/utils/deviceHomeScreenUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import {
  DEVICE_SETTINGS_ALREADY_MATCHED_MESSAGE,
  DeviceSettingsManager,
  isDeviceSettingsAlreadyMatched,
} from './DeviceSettingsManager';

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

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getWalletDevice: jest.fn(),
    getDeviceByQuery: jest.fn(),
    getDevice: jest.fn(),
    updateDevice: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
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

function buildTrezorDevice(): IDBDevice {
  return {
    ...buildDevice(EDeviceType.Unknown),
    connectId: 'TREZOR_CONNECT_ID',
    deviceId: 'TREZOR_DEVICE_ID',
    vendor: EHardwareVendor.trezor,
    featuresInfo: {
      device_id: 'TREZOR_DEVICE_ID',
      passphrase_protection: false,
      auto_lock_delay_ms: 60_000,
      haptic_feedback: false,
    },
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

describe('isDeviceSettingsAlreadyMatched', () => {
  test('detects the Protocol V2 already-matched payload', () => {
    expect(
      isDeviceSettingsAlreadyMatched({
        message: DEVICE_SETTINGS_ALREADY_MATCHED_MESSAGE,
      }),
    ).toBe(true);
  });

  test('ignores a real settings mutation', () => {
    expect(isDeviceSettingsAlreadyMatched({ message: 'Success' })).toBe(false);
    expect(isDeviceSettingsAlreadyMatched(undefined)).toBe(false);
    expect(isDeviceSettingsAlreadyMatched(null)).toBe(false);
  });
});

describe('DeviceSettingsManager device adapters', () => {
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
    ['setBrightness', { brightness: 60 }, { brightness: 60 }],
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

  test.each(['OneKey-Pro2', 'OneKey_Pro2', 'OneKey　Pro2', '一键Pro2'])(
    'rejects unsupported label %s before calling the SDK',
    async (label) => {
      const deviceSettings = jest.fn();
      const manager = buildManager(buildDevice(EDeviceType.Pro2), {
        deviceSettings,
      } as unknown as CoreApi);

      await expect(
        manager.setDeviceLabel({ walletId: 'wallet-1', label }),
      ).rejects.toThrow('only support ASCII letters, numbers, and spaces');
      expect(deviceSettings).not.toHaveBeenCalled();
    },
  );

  test.each([
    [EDeviceType.Pro2, 'runtime', { pinType: DeviceSessionPinType.Any }],
    [EDeviceType.Touch, 'settings', {}],
  ])(
    'uses conditional unlock with the expected PIN policy when reading %s advanced settings',
    async (deviceType, expectedScope, expectedPinParams) => {
      const device = buildDevice(deviceType);
      jest.spyOn(localDb, 'getWalletDevice').mockResolvedValue(device);
      const unlockDevice = jest.fn(async () => undefined);
      const state = {
        status: {
          initialized: true,
          unlocked: true,
          passphraseProtection: true,
        },
      };
      const getDeviceStateWithUnlock = jest.fn(async () => state);
      const getDeviceStateByWallet = jest.fn(async () => state);
      const backgroundApi = {
        serviceHardware: {
          unlockDevice,
          getDeviceStateWithUnlock,
          getDeviceStateByWallet,
          getDeviceSupportFeatures: jest.fn(async () => ({
            inputPinOnSoftware: { support: true },
          })),
        },
        serviceHardwareUI: {
          withHardwareProcessing: jest.fn(
            async (action: (lease: object) => Promise<unknown>) =>
              action({ deviceKey: 'device-db-id', owner: Symbol('test') }),
          ),
        },
      } as unknown as IBackgroundApi;
      const manager = new DeviceSettingsManager({ backgroundApi });

      await expect(
        manager.getDeviceAdvanceSettings({ walletId: 'wallet-1' }),
      ).resolves.toMatchObject({
        passphraseEnabled: true,
        inputPinOnSoftwareSupport: true,
      });
      expect(getDeviceStateWithUnlock).toHaveBeenCalledWith({
        connectId: device.connectId,
        params: { scope: expectedScope },
        oneKeyOperationLease: expect.objectContaining({
          deviceKey: 'device-db-id',
        }),
        ...expectedPinParams,
      });
      expect(unlockDevice).not.toHaveBeenCalled();
      expect(getDeviceStateByWallet).toHaveBeenCalledTimes(
        deviceType === EDeviceType.Pro2 ? 1 : 0,
      );
    },
  );

  test.each([
    ['Custom Label', 'Custom Label'],
    [null, ''],
  ])(
    'reads the editable label from DeviceState without display-name fallback',
    async (label, expected) => {
      const device = buildDevice(EDeviceType.Pro2);
      jest.spyOn(localDb, 'getWalletDevice').mockResolvedValue(device);
      const getDeviceStateWithUnlock = jest.fn(async () => ({
        identity: {
          label,
          bleName: 'Pro2 6136',
          displayName: 'Pro2 6136',
        },
      }));
      const backgroundApi = {
        serviceHardware: {
          getCompatibleConnectId: jest.fn(async () => device.connectId),
          getDeviceStateWithUnlock,
        },
        serviceHardwareUI: {
          withHardwareProcessing: jest.fn(
            async (action: (lease: object) => Promise<unknown>) =>
              action({ deviceKey: 'device-db-id', owner: Symbol('test') }),
          ),
          closeHardwareUiStateDialog: jest.fn(async () => undefined),
        },
      } as unknown as IBackgroundApi;
      const manager = new DeviceSettingsManager({ backgroundApi });

      await expect(
        manager.getDeviceLabel({ walletId: 'wallet-1' }),
      ).resolves.toBe(expected);
      expect(getDeviceStateWithUnlock).toHaveBeenCalledWith({
        connectId: device.connectId,
        pinType: DeviceSessionPinType.Any,
        params: { scope: 'settings' },
        oneKeyOperationLease: expect.objectContaining({
          deviceKey: 'device-db-id',
        }),
      });
    },
  );

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
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    jest.mocked(localDb.updateDevice).mockClear();

    await manager.setAutoShutDownDelayMs({
      connectId: 'PRO2_CONNECT_ID',
      autoShutdownDelayMs: 300_000,
    });

    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    expect(localDb.updateDevice).not.toHaveBeenCalled();
  });

  test.each([
    ['changePin', { remove: false }, 'deviceChangePin'],
    ['wipeDevice', {}, 'deviceWipe'],
  ] as const)(
    'routes %s through the unified public method',
    async (methodName, params, sdkMethodName) => {
      const sdkMethod = jest.fn(async () => ({
        success: true as const,
        payload: { message: 'Success' },
      }));
      const manager = buildManager(buildDevice(EDeviceType.Pro2), {
        [sdkMethodName]: sdkMethod,
      } as unknown as CoreApi);

      const method = manager[methodName] as (
        input: typeof params & { connectId: string },
      ) => Promise<unknown>;
      await method.call(manager, {
        connectId: 'PRO2_CONNECT_ID',
        ...params,
      });

      if (methodName === 'changePin') {
        expect(sdkMethod).toHaveBeenCalledWith('PRO2_CONNECT_ID', {
          remove: false,
        });
      } else {
        expect(sdkMethod).toHaveBeenCalledWith('PRO2_CONNECT_ID');
      }
    },
  );

  test('routes Pro2 passphrase settings through the unified public method', async () => {
    const deviceSettings = jest.fn(async () => ({
      success: true as const,
      payload: { message: 'Success' },
    }));
    const manager = buildManager(buildDevice(EDeviceType.Pro2), {
      deviceSettings,
    } as unknown as CoreApi);

    await manager.setPassphraseEnabled({
      connectId: 'PRO2_CONNECT_ID',
      passphraseEnabled: true,
    });

    expect(deviceSettings).toHaveBeenCalledWith('PRO2_CONNECT_ID', {
      usePassphrase: true,
    });
  });

  test('shows a success toast when Pro2 passphrase already matches the device', async () => {
    const emit = jest.spyOn(appEventBus, 'emit');
    const deviceSettings = jest.fn(async () => ({
      success: true as const,
      payload: { message: DEVICE_SETTINGS_ALREADY_MATCHED_MESSAGE },
    }));
    const manager = buildManager(buildDevice(EDeviceType.Pro2), {
      deviceSettings,
    } as unknown as CoreApi);

    await expect(
      manager.setPassphraseEnabled({
        connectId: 'PRO2_CONNECT_ID',
        passphraseEnabled: true,
      }),
    ).resolves.toEqual({ message: DEVICE_SETTINGS_ALREADY_MATCHED_MESSAGE });

    expect(emit).toHaveBeenCalledWith(EAppEventBusNames.ShowToast, {
      method: 'success',
      title: ETranslations.global_success,
    });
    emit.mockRestore();
  });

  test('does not toast when Pro2 passphrase actually changes on the device', async () => {
    const emit = jest.spyOn(appEventBus, 'emit');
    const deviceSettings = jest.fn(async () => ({
      success: true as const,
      payload: { message: 'Success' },
    }));
    const manager = buildManager(buildDevice(EDeviceType.Pro2), {
      deviceSettings,
    } as unknown as CoreApi);

    await manager.setPassphraseEnabled({
      connectId: 'PRO2_CONNECT_ID',
      passphraseEnabled: true,
    });

    expect(emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.ShowToast,
      expect.objectContaining({ method: 'success' }),
    );
    emit.mockRestore();
  });

  test.each([
    ['passphrase', 'setPassphraseEnabled', { passphraseEnabled: true }],
    ['auto lock', 'setAutoLockDelayMs', { autoLockDelayMs: 120_000 }],
    [
      'auto shutdown',
      'setAutoShutDownDelayMs',
      { autoShutdownDelayMs: 300_000 },
    ],
    ['language', 'setLanguage', { language: 'en-US' }],
    ['brightness', 'setBrightness', { brightness: 80 }],
    ['haptic feedback', 'setHapticFeedback', { hapticFeedback: true }],
    [
      'label',
      'setDeviceLabel',
      { walletId: 'wallet-1', label: 'Current Label' },
    ],
  ] as const)(
    'waits for the Pro2 DeviceState event after changing %s',
    async (_settingName, methodName, params) => {
      const device = buildDevice(EDeviceType.Pro2);
      jest.spyOn(localDb, 'getDeviceByQuery').mockResolvedValue(device);
      jest.spyOn(localDb, 'getWalletDevice').mockResolvedValue(device);
      let releaseStateSync: (() => void) | undefined;
      let notifyStateSyncStarted: (() => void) | undefined;
      const stateSyncStarted = new Promise<void>((resolve) => {
        notifyStateSyncStarted = resolve;
      });
      const waitForDeviceStateSync = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseStateSync = resolve;
            notifyStateSyncStarted?.();
          }),
      );
      const deviceSettings = jest.fn(async () => ({
        success: true as const,
        payload: { message: 'Success' },
      }));
      const manager = new DeviceSettingsManager({
        backgroundApi: {
          serviceHardware: {
            getCompatibleConnectId: jest.fn(async () => device.connectId),
            waitForDeviceStateSync,
          },
          serviceHardwareUI: {
            withHardwareProcessing: jest.fn(
              async (action: () => Promise<unknown>) => action(),
            ),
          },
        } as unknown as IBackgroundApi,
      });
      jest.spyOn(manager, 'getSDKInstance').mockResolvedValue({
        deviceSettings,
      } as unknown as CoreApi);

      const method = manager[methodName] as (
        input: typeof params & { connectId: string },
      ) => Promise<unknown>;
      let completed = false;
      const settingTask = method
        .call(manager, { connectId: device.connectId, ...params })
        .then(() => {
          completed = true;
        });

      await stateSyncStarted;
      expect(completed).toBe(false);
      expect(waitForDeviceStateSync).toHaveBeenCalledWith({
        connectIds: expect.arrayContaining([
          'PRO2_CONNECT_ID',
          'PRO2_DEVICE_ID',
        ]),
      });
      releaseStateSync?.();
      await settingTask;
      expect(completed).toBe(true);
    },
  );

  test.each([
    [
      'setPassphraseEnabled',
      { passphraseEnabled: true },
      { passphrase_protection: true },
    ],
    [
      'setAutoLockDelayMs',
      { autoLockDelayMs: 120_000 },
      { auto_lock_delay_ms: 120_000 },
    ],
    [
      'setAutoShutDownDelayMs',
      { autoShutdownDelayMs: 300_000 },
      { auto_shutdown_delay_ms: 300_000 },
    ],
    ['setLanguage', { language: 'en-US' }, { language: 'en-US' }],
  ] as const)(
    'persists legacy OneKey %s settings and reads device settings back',
    async (methodName, params, preciseUpdateFields) => {
      const device = buildDevice(EDeviceType.Pro);
      device.featuresInfo = {
        device_id: 'LEGACY_DEVICE_ID',
      } as never;
      const waitForDeviceStateSync = jest.fn(async () => undefined);
      const getDeviceState = jest.fn(async () => undefined);
      const deviceSettings = jest.fn(async () => ({
        success: true as const,
        payload: { message: 'Success' },
      }));
      // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
      jest.mocked(localDb.getDeviceByQuery).mockResolvedValue(device);
      // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
      jest.mocked(localDb.updateDevice).mockClear();
      const manager = new DeviceSettingsManager({
        backgroundApi: {
          serviceHardware: {
            getCompatibleConnectId: jest.fn(async () => device.connectId),
            waitForDeviceStateSync,
            getDeviceState,
          },
          serviceHardwareUI: {
            withHardwareProcessing: jest.fn(
              async (action: () => Promise<unknown>) => action(),
            ),
          },
        } as unknown as IBackgroundApi,
      });
      jest.spyOn(manager, 'getSDKInstance').mockResolvedValue({
        deviceSettings,
      } as unknown as CoreApi);

      const method = manager[methodName] as (
        input: typeof params & { connectId: string },
      ) => Promise<unknown>;
      await method.call(manager, {
        connectId: device.connectId,
        ...params,
      });

      // The V1 refresh path owns the HardwareFeaturesUpdate signal, so the
      // direct DB write must suppress its own event.
      // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
      expect(localDb.updateDevice).toHaveBeenCalledWith({
        features: device.featuresInfo,
        preciseUpdateFields,
        skipFeaturesUpdateEvent: true,
      });
      // V1 mutations now drain pending state-event persists and read the
      // settings back before notifying UI consumers.
      expect(waitForDeviceStateSync).toHaveBeenCalled();
      expect(getDeviceState).toHaveBeenCalledWith(
        expect.objectContaining({ params: { scope: 'settings' } }),
      );
    },
  );

  test('opens the Protocol V1 brightness page without a V2 brightness value', async () => {
    const deviceSettings = jest.fn(async () => ({
      success: true as const,
      payload: { message: 'Success' },
    }));
    const manager = buildManager(buildDevice(EDeviceType.Pro), {
      deviceSettings,
    } as unknown as CoreApi);

    await manager.setBrightness({
      connectId: 'PRO2_CONNECT_ID',
    });

    expect(deviceSettings).toHaveBeenCalledWith('PRO2_CONNECT_ID', {
      changeBrightness: true,
    });
  });

  test.each([EDeviceType.Pro2, EDeviceType.Neo] as const)(
    'uploads a custom wallpaper to %s with generated Base64',
    async (deviceType) => {
      const device = buildDevice(deviceType);
      jest.spyOn(localDb, 'getDevice').mockResolvedValue(device);
      const waitForDeviceStateSync = jest.fn(async () => undefined);
      const deviceUploadWallpaper = jest.fn(async () => ({
        success: true as const,
        payload: { message: 'Success', path: 'vol1:/wallpapers/custom.bin' },
      }));
      const manager = new DeviceSettingsManager({
        backgroundApi: {
          serviceHardware: {
            getCompatibleConnectId: jest.fn(async () => device.connectId),
            waitForDeviceStateSync,
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
          id: `${deviceType} custom wallpaper`,
          resType: 'custom',
          url: `https://example.com/${deviceType}-wallpaper.jpg`,
          screenBase64: '/9j/',
        },
      });

      expect(deviceUploadWallpaper).toHaveBeenCalledWith(device.connectId, {
        jpegBase64: '/9j/',
        fileName: `${deviceType}-custom-wallpaper`,
      });
      expect(waitForDeviceStateSync).toHaveBeenCalledWith({
        connectIds: expect.arrayContaining([device.connectId, device.deviceId]),
      });
      expect(result).toMatchObject({ message: 'Success', applyScreen: true });
    },
  );

  test('allows an empty user upload to clear a monochrome home screen', async () => {
    const device = buildDevice(EDeviceType.Classic);
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    jest.mocked(localDb.getDevice).mockResolvedValueOnce(device);
    jest
      .mocked(deviceHomeScreenUtils.isMonochromeScreen)
      .mockReturnValueOnce(true);
    const manager = new DeviceSettingsManager({
      backgroundApi: {
        serviceHardware: {
          waitForDeviceStateSync: jest.fn(async () => undefined),
          getDeviceState: jest.fn(async () => undefined),
        },
        serviceHardwareUI: {
          withHardwareProcessing: jest.fn(
            async (action: () => Promise<unknown>) => action(),
          ),
        },
      } as unknown as IBackgroundApi,
    });
    const applySettingsToDevice = jest
      .spyOn(manager, 'applySettingsToDevice')
      .mockResolvedValue({ message: 'Success' });

    const result = await manager.setDeviceHomeScreen({
      dbDeviceId: device.id,
      screenItem: {
        id: 'solid-wallpaper',
        resType: 'custom',
        screenHex: '',
        isUserUpload: true,
      },
    });

    expect(applySettingsToDevice).toHaveBeenCalledWith(device.connectId, {
      homescreen: '',
    });
    expect(result).toMatchObject({ message: 'Success', applyScreen: true });
  });

  test.each([
    [
      'setPassphraseEnabled',
      { passphraseEnabled: true },
      { use_passphrase: true },
      { passphrase_protection: true },
    ],
    [
      'setAutoLockDelayMs',
      { autoLockDelayMs: 120_000 },
      { auto_lock_delay_ms: 120_000 },
      { auto_lock_delay_ms: 120_000 },
    ],
    [
      'setHapticFeedback',
      { hapticFeedback: true },
      { haptic_feedback: true },
      { haptic_feedback: true },
    ],
  ] as const)(
    'persists Trezor %s using canonical feature fields',
    async (methodName, params, settings, preciseUpdateFields) => {
      const device = buildTrezorDevice();
      const deviceSettings = jest.fn(async () => ({
        success: true as const,
        payload: {},
      }));
      // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
      jest.mocked(localDb.getDeviceByQuery).mockResolvedValue(device);
      // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
      jest.mocked(localDb.updateDevice).mockClear();
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
          serviceThirdPartyHardware: {
            getAdapterForVendor: jest.fn(async () => ({ deviceSettings })),
            requestTrezorBleConnectIdForDevice: jest.fn(),
          },
        } as unknown as IBackgroundApi,
      });

      const method = manager[methodName] as (
        input: typeof params & { connectId: string },
      ) => Promise<unknown>;
      await method.call(manager, {
        connectId: device.connectId,
        ...params,
      });

      expect(deviceSettings).toHaveBeenCalledWith(device.connectId, settings);
      // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
      expect(localDb.updateDevice).toHaveBeenCalledWith({
        features: device.featuresInfo,
        preciseUpdateFields,
      });
    },
  );
});
