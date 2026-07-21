import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import localDb from '../../dbs/local/localDb';

import ServiceHardware from './ServiceHardware';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    HardwareFeaturesUpdate: 'HardwareFeaturesUpdate',
    SyncDeviceLabelToWalletName: 'SyncDeviceLabelToWalletName',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isJest: true,
    isSupportDesktopBle: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/deviceHomeScreenUtils', () => ({
  __esModule: true,
  DEFAULT_T1_HOME_SCREEN_INFORMATION: {},
  T1_HOME_SCREEN_DEFAULT_IMAGES: [],
  default: {},
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getDeviceByQuery: jest.fn(),
    updateDevice: jest.fn(),
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  EHardwareUiStateAction: {},
  hardwareForceTransportAtom: {
    get: jest.fn(async () => ({ forceTransportType: undefined })),
  },
  hardwareUiStateAtom: {},
  hardwareUiStateCompletedAtom: {},
  settingsPersistAtom: {},
}));

const createService = ({ unlocked }: { unlocked: boolean }) => {
  const cachedFeatures = {
    deviceId: 'PRO2_DEVICE_ID',
    unlocked,
    initialized: true,
    backupRequired: false,
    passphraseProtection: false,
    attachToPinEnabled: false,
    unlockedAttachPin: false,
  };
  // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
  jest.mocked(localDb.getDeviceByQuery).mockResolvedValue({
    id: 'db-device-1',
    connectId: 'PRO2_USB',
    featuresInfo: cachedFeatures,
  } as never);
  const deviceInfoGet = jest.fn().mockResolvedValue({
    success: true,
    payload: {
      device_id: 'PRO2_DEVICE_ID',
      serial_number: 'PRO2_SERIAL',
    },
  });
  const deviceStatusGet = jest.fn().mockResolvedValue({
    success: true,
    payload: {
      device_id: 'PRO2_DEVICE_ID',
      unlocked,
      init_states: true,
      backup_required: false,
    },
  });
  const deviceSettingsGet = jest.fn().mockResolvedValue({
    success: true,
    payload: {
      label: 'OneKey Pro 2',
      language: 'en-US',
    },
  });
  const deviceSettingsPageShow = jest.fn().mockResolvedValue({
    success: true,
    payload: { message: 'Success' },
  });
  const service = new ServiceHardware({
    backgroundApi: {} as unknown as IBackgroundApi,
  });
  service.getCompatibleConnectId = jest.fn().mockResolvedValue('PRO2_USB');
  service.getSDKInstance = jest.fn().mockResolvedValue({
    deviceInfoGet,
    deviceStatusGet,
    deviceSettingsGet,
    deviceSettingsPageShow,
  } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);

  return {
    service,
    deviceInfoGet,
    deviceStatusGet,
    deviceSettingsGet,
    deviceSettingsPageShow,
    cachedFeatures,
  };
};

describe('ServiceHardware.getPro2DeviceManagementSnapshot', () => {
  it('returns only static DeviceInfo and hydrates SDK Features without polling DeviceStatus', async () => {
    const {
      service,
      deviceInfoGet,
      deviceStatusGet,
      deviceSettingsGet,
      cachedFeatures,
    } = createService({ unlocked: false });

    await expect(
      service.getPro2DeviceManagementSnapshot({ connectId: 'ORIGINAL_ID' }),
    ).resolves.toEqual({
      info: {
        device_id: 'PRO2_DEVICE_ID',
        serial_number: 'PRO2_SERIAL',
      },
    });

    expect(deviceInfoGet).toHaveBeenCalledTimes(1);
    expect(deviceStatusGet).not.toHaveBeenCalled();
    expect(deviceSettingsGet).not.toHaveBeenCalled();
    expect(deviceInfoGet).toHaveBeenCalledWith('PRO2_USB', {
      connectProtocol: 'V2',
      targets: {
        hw: true,
        fw: true,
        coprocessor: true,
        se1: true,
        se2: true,
        se3: true,
        se4: true,
      },
      types: {
        version: true,
        build_id: true,
        hash: true,
        specific: true,
      },
    });

    cachedFeatures.unlocked = true;

    await expect(
      service.getPro2DeviceManagementSnapshot({ connectId: 'ORIGINAL_ID' }),
    ).resolves.toEqual({
      info: {
        device_id: 'PRO2_DEVICE_ID',
        serial_number: 'PRO2_SERIAL',
      },
    });

    expect(deviceInfoGet).toHaveBeenCalledTimes(1);
    expect(deviceStatusGet).not.toHaveBeenCalled();
    expect(deviceSettingsGet).toHaveBeenCalledTimes(1);
  });

  it('supports explicit DeviceInfo refresh', async () => {
    const { service, deviceInfoGet } = createService({ unlocked: false });

    await service.getPro2DeviceManagementSnapshot({ connectId: 'PRO2' });
    await service.getPro2DeviceManagementSnapshot({
      connectId: 'PRO2',
      refreshInfo: true,
    });

    expect(deviceInfoGet).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent snapshot requests for one connection', async () => {
    const { service, deviceInfoGet, deviceStatusGet } = createService({
      unlocked: false,
    });

    await Promise.all([
      service.getPro2DeviceManagementSnapshot({ connectId: 'PRO2' }),
      service.getPro2DeviceManagementSnapshot({ connectId: 'PRO2' }),
    ]);

    expect(deviceInfoGet).toHaveBeenCalledTimes(1);
    expect(deviceStatusGet).not.toHaveBeenCalled();
  });
});

describe('ServiceHardware SDK Features synchronization', () => {
  it('persists normalized SDK Features events into the device database', async () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const instance = {
      on: jest.fn((event: string, listener: (payload: unknown) => void) => {
        listeners.set(event, listener);
      }),
    };
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents(instance as never);

    const features = {
      protocol: 'V2',
      serialNo: 'PRO2_SERIAL',
      label: 'Renamed Pro 2',
    };
    listeners.get('features')?.(features);

    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    expect(localDb.updateDevice).toHaveBeenCalledWith({ features });
  });

  it('does not duplicate label persistence after the SDK Features event', async () => {
    const service = new ServiceHardware({
      backgroundApi: {
        serviceAccount: {
          getWalletSafe: jest.fn().mockResolvedValue({
            associatedDevice: 'db-device-1',
            name: 'Wallet',
          }),
        },
      } as unknown as IBackgroundApi,
    });
    service.deviceSettingsManager.setDeviceLabel = jest
      .fn()
      .mockResolvedValue({ message: 'Success' });
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    jest.mocked(appEventBus.emit).mockClear();
    await service.setDeviceLabel({
      walletId: 'wallet-1',
      label: 'Renamed Pro 2',
    });

    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    expect(appEventBus.emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.HardwareFeaturesUpdate,
      expect.anything(),
    );
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.SyncDeviceLabelToWalletName,
      expect.objectContaining({ label: 'Renamed Pro 2' }),
    );
  });
});

describe('ServiceHardware.fetchHardwareHomeScreen', () => {
  it('uses Pro as the server device type for Pro 2', async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        data: [
          {
            id: 'pro-wallpaper',
            wallpaperType: 'default',
            resType: 'system',
            url: 'https://example.com/pro-wallpaper.png',
            deviceTypes: [EDeviceType.Pro],
          },
        ],
      },
    });
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    Object.defineProperty(service, 'getClient', {
      value: jest.fn().mockResolvedValue({ get }),
    });

    await expect(
      service.fetchHardwareHomeScreen({
        deviceType: EDeviceType.Pro2,
        serialNumber: 'PR9999999999',
        firmwareVersion: '1.0.0',
      }),
    ).resolves.toEqual([
      {
        id: 'pro-wallpaper',
        wallpaperType: 'default',
        resType: 'system',
        url: 'https://example.com/pro-wallpaper.png',
        screenHex: undefined,
        nameHex: undefined,
      },
    ]);
    expect(get).toHaveBeenCalledWith('/utility/v1/wallet-homescreen/list', {
      params: {
        deviceType: EDeviceType.Pro,
        serialNumber: 'PR9999999999',
        firmwareVersion: '1.0.0',
      },
    });
  });
});

describe('ServiceHardware Pro 2 settings API', () => {
  it('opens every firmware-supported settings page', async () => {
    const { service, deviceSettingsPageShow } = createService({
      unlocked: true,
    });

    for (const page of [
      'DeviceReset',
      'DevicePinChange',
      'DevicePassphrase',
      'DeviceAirgap',
    ] as const) {
      await service.showPro2DeviceSettingsPage({
        connectId: 'ORIGINAL_ID',
        page,
      });
    }

    expect(deviceSettingsPageShow.mock.calls).toEqual(
      [
        'DeviceReset',
        'DevicePinChange',
        'DevicePassphrase',
        'DeviceAirgap',
      ].map((page) => ['PRO2_USB', { connectProtocol: 'V2', page }]),
    );
  });
});
