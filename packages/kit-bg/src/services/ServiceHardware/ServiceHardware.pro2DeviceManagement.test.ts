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
    HardwareDeviceStateUpdate: 'HardwareDeviceStateUpdate',
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
    updateDeviceState: jest.fn(),
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
  const state = {
    revision: 1,
    protocol: 'V2',
    identity: {
      deviceId: 'PRO2_DEVICE_ID',
      serialNo: 'PRO2_SERIAL',
      label: 'OneKey Pro 2',
      bleName: 'Pro2 6136',
      displayName: 'OneKey Pro 2',
      deviceType: EDeviceType.Pro2,
    },
    status: { mode: 'normal', unlocked },
    settings: { language: 'en-US' },
    versions: { firmware: '1.0.0' },
  };
  // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
  jest.mocked(localDb.getDeviceByQuery).mockResolvedValue({
    id: 'db-device-1',
    connectId: 'PRO2_USB',
    deviceStateInfo: state,
  } as never);
  const getDeviceState = jest.fn().mockResolvedValue({
    success: true,
    payload: state,
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
    getDeviceState,
    deviceSettingsPageShow,
  } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);

  return {
    service,
    getDeviceState,
    deviceSettingsPageShow,
    state,
  };
};

describe('ServiceHardware.getDeviceState', () => {
  it('queries the canonical SDK state without implicit status refresh', async () => {
    const { service, getDeviceState, state } = createService({
      unlocked: false,
    });

    await expect(
      service.getDeviceState({ connectId: 'ORIGINAL_ID' }),
    ).resolves.toBe(state);

    expect(getDeviceState).toHaveBeenCalledWith('PRO2_USB', undefined);
  });

  it('forwards only explicitly requested refresh sections', async () => {
    const { service, getDeviceState } = createService({ unlocked: false });

    await service.getDeviceState({
      connectId: 'PRO2',
      params: { refresh: ['identity', 'versions'] },
    });

    expect(getDeviceState).toHaveBeenCalledWith('PRO2_USB', {
      refresh: ['identity', 'versions'],
    });
  });
});

describe('ServiceHardware SDK DeviceState synchronization', () => {
  it('persists and broadcasts canonical SDK state events', async () => {
    const listeners = new Map<
      string,
      (payload: unknown) => void | Promise<void>
    >();
    const instance = {
      on: jest.fn(
        (
          event: string,
          listener: (payload: unknown) => void | Promise<void>,
        ) => {
          listeners.set(event, listener);
        },
      ),
    };
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents(instance as never);

    const state = {
      revision: 2,
      protocol: 'V2',
      identity: {
        deviceId: 'PRO2_DEVICE_ID',
        serialNo: 'PRO2_SERIAL',
        label: 'Renamed Pro 2',
        displayName: 'Renamed Pro 2',
      },
    };
    await listeners.get('state')?.({
      connectId: 'PRO2_USB',
      state,
      revision: 2,
      source: 'apply-settings',
      changedKeys: ['identity.label'],
    });

    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    expect(localDb.updateDeviceState).toHaveBeenCalledWith({
      connectId: 'PRO2_USB',
      state,
    });
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      expect.objectContaining({ state, revision: 2 }),
    );
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
      EAppEventBusNames.HardwareDeviceStateUpdate,
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
