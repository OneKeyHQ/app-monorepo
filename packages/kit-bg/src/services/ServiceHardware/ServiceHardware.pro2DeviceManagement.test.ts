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
    WalletUpdate: 'WalletUpdate',
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

const createService = ({
  unlocked,
  mode = 'normal',
}: {
  unlocked: boolean;
  mode?: 'normal' | 'bootloader' | 'romloader';
}) => {
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
    status: { mode, unlocked },
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
  const getFeatures = jest.fn().mockResolvedValue({
    success: true,
    payload: { protocol: 'V1', label: 'SDK legacy projection' },
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
    getFeatures,
    deviceSettingsPageShow,
  } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);

  return {
    service,
    getDeviceState,
    getFeatures,
    deviceSettingsPageShow,
    state,
  };
};

describe('ServiceHardware.getDeviceState', () => {
  it('queries the live canonical SDK state', async () => {
    const { service, getDeviceState, state } = createService({
      unlocked: false,
    });

    await expect(
      service.getDeviceState({ connectId: 'ORIGINAL_ID' }),
    ).resolves.toBe(state);

    expect(getDeviceState).toHaveBeenCalledWith('PRO2_USB', undefined);
  });

  it('forwards a semantic scope through the same state API', async () => {
    const { service, getDeviceState } = createService({ unlocked: false });

    await service.getDeviceState({
      connectId: 'PRO2',
      params: { scope: 'firmware' },
    });

    expect(getDeviceState).toHaveBeenCalledWith('PRO2_USB', {
      scope: 'firmware',
    });
  });

  it('projects legacy App features from DeviceState without calling SDK getFeatures', async () => {
    const { service, getDeviceState } = createService({ unlocked: true });

    await expect(
      service.getFeaturesWithoutCache({ connectId: 'PRO2' }),
    ).resolves.toMatchObject({
      deviceId: 'PRO2_DEVICE_ID',
      label: 'OneKey Pro 2',
    });
    expect(getDeviceState).toHaveBeenCalledWith('PRO2', undefined);
  });

  it('delegates Protocol V1 compatibility projection to the SDK', async () => {
    const { service, getDeviceState, getFeatures } = createService({
      unlocked: true,
    });
    getDeviceState.mockResolvedValue({
      success: true,
      payload: {
        schemaVersion: 1,
        revision: 2,
        updatedAt: 2,
        protocol: 'V1',
        identity: {
          deviceId: 'CLASSIC_DEVICE_ID',
          serialNo: 'CLASSIC_SERIAL',
          label: 'Classic Wallet',
          bleName: null,
          displayName: 'Classic Wallet',
          deviceType: EDeviceType.Classic1s,
          firmwareType: 'universal',
          model: '1',
          vendor: 'onekey.so',
        },
        status: { mode: 'normal', initialized: true },
        settings: { language: 'en-US' },
        versions: { firmware: '3.11.0', se01Boot: '1.2.0' },
        verification: {
          firmwareBuildId: 'firmware-build',
          se01BootHash: 'abcd',
        },
        capabilities: [],
      },
    } as never);
    getFeatures.mockResolvedValue({
      success: true,
      payload: {
        protocol: 'V1',
        deviceType: EDeviceType.Classic1s,
        onekey_firmware_version: '3.11.0',
        onekey_firmware_build_id: 'firmware-build',
        onekey_se01_boot_version: '1.2.0',
        onekey_se01_boot_hash: 'abcd',
      },
    });

    await expect(
      service.getFeaturesWithoutCache({ connectId: 'CLASSIC' }),
    ).resolves.toMatchObject({
      protocol: 'V1',
      deviceType: EDeviceType.Classic1s,
      onekey_firmware_version: '3.11.0',
      onekey_firmware_build_id: 'firmware-build',
      onekey_se01_boot_version: '1.2.0',
      onekey_se01_boot_hash: 'abcd',
    });
    expect(getFeatures).toHaveBeenCalledWith('CLASSIC', undefined);
  });

  it('projects romloader mode to both legacy bootloader flags', async () => {
    const { service } = createService({ unlocked: false, mode: 'romloader' });

    await expect(
      service.getFeaturesWithoutCache({ connectId: 'PRO2' }),
    ).resolves.toMatchObject({
      bootloaderMode: true,
      bootloader_mode: true,
    });
  });

  it('detects romloader as a legacy bootloader device', async () => {
    const { service } = createService({ unlocked: false, mode: 'romloader' });

    await expect(
      service.getFeaturesWithoutCache({
        connectId: 'PRO2',
        params: { detectBootloaderDevice: true },
      }),
    ).rejects.toBeDefined();
  });
});

describe('ServiceHardware.getDeviceManagementSnapshot', () => {
  it('refreshes readable settings on the initial device-details load', async () => {
    const { service, getDeviceState } = createService({
      unlocked: true,
    });

    await service.getDeviceManagementSnapshot({ connectId: 'PRO2' });

    expect(getDeviceState).toHaveBeenCalledTimes(1);
    expect(getDeviceState).toHaveBeenCalledWith('PRO2_USB', {
      scope: 'settings',
    });
  });

  it('falls back to live runtime when settings cannot be read', async () => {
    const { service } = createService({ unlocked: false });
    const baseState = {
      protocol: 'V2',
      identity: { serialNo: 'PRO2_SERIAL', displayName: 'OneKey Pro 2' },
      status: { mode: 'normal', unlocked: false },
      settings: {},
      versions: {},
    };
    const getDeviceState = jest
      .fn()
      .mockRejectedValueOnce(new Error('Settings unavailable'))
      .mockResolvedValueOnce(baseState);
    service.getDeviceState = getDeviceState;

    await expect(
      service.getDeviceManagementSnapshot({ connectId: 'PRO2' }),
    ).resolves.toEqual({ state: baseState });
    expect(getDeviceState).toHaveBeenNthCalledWith(1, {
      connectId: 'PRO2_USB',
      params: { scope: 'settings' },
      hardwareCallContext: 'user_interaction_no_ble_dialog',
    });
    expect(getDeviceState).toHaveBeenNthCalledWith(2, {
      connectId: 'PRO2_USB',
      params: undefined,
      hardwareCallContext: 'user_interaction_no_ble_dialog',
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
      changedKeys: ['identity.label'],
      connectId: 'PRO2_USB',
      revision: 2,
      source: 'apply-settings',
      state,
    });
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      expect.objectContaining({ state, revision: 2 }),
    );
  });

  it('still broadcasts the in-memory state when persistence fails', async () => {
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    const updateDeviceStateMock = jest.mocked(localDb.updateDeviceState);
    updateDeviceStateMock.mockReset();
    const listeners = new Map<
      string,
      (payload: unknown) => void | Promise<void>
    >();
    const instance = {
      on: jest.fn(
        (event: string, listener: (payload: unknown) => void | Promise<void>) =>
          listeners.set(event, listener),
      ),
    };
    updateDeviceStateMock.mockRejectedValueOnce(new Error('DB unavailable'));
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents(instance as never);
    const event = {
      connectId: 'PRO2_USB',
      state: {
        revision: 2,
        updatedAt: 2,
        protocol: 'V2',
        identity: { deviceId: 'device-1', serialNo: 'serial-1' },
      },
      revision: 2,
      source: 'apply-settings',
      changedKeys: ['identity.label'],
    };

    await expect(listeners.get('state')?.(event)).resolves.toBeUndefined();
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      event,
    );
  });

  it('deprecates the old wallet and suppresses a reset identity event', async () => {
    // oxlint-disable-next-line typescript/unbound-method -- Jest mocks do not depend on this binding.
    const updateDeviceStateMock = jest.mocked(localDb.updateDeviceState);
    updateDeviceStateMock.mockReset();
    updateDeviceStateMock.mockResolvedValueOnce({
      kind: 'identity-mismatch',
      deviceDbId: 'db-device-1',
      currentDeviceId: 'OLD_DEVICE_ID',
      incomingDeviceId: 'NEW_DEVICE_ID',
    } as never);
    // oxlint-disable-next-line typescript/unbound-method -- Jest mocks do not depend on this binding.
    const emitMock = jest.mocked(appEventBus.emit);
    emitMock.mockClear();
    const listeners = new Map<
      string,
      (payload: unknown) => void | Promise<void>
    >();
    const updateWalletsDeprecatedState = jest.fn().mockResolvedValue(true);
    const service = new ServiceHardware({
      backgroundApi: {
        serviceAccount: {
          getAllHwQrWalletWithDevice: jest.fn().mockResolvedValue({
            'hw-wallet-1': {
              wallet: {
                id: 'hw-wallet-1',
                associatedDevice: 'db-device-1',
              },
              device: { id: 'db-device-1' },
            },
          }),
          updateWalletsDeprecatedState,
        },
      } as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents({
      on: jest.fn(
        (event: string, listener: (payload: unknown) => void | Promise<void>) =>
          listeners.set(event, listener),
      ),
    } as never);
    const event = {
      connectId: 'PRO2_USB',
      revision: 4,
      changedKeys: ['identity.deviceId'],
      state: {
        revision: 4,
        updatedAt: 4,
        identity: {
          serialNo: 'PRO2_SERIAL',
          deviceId: 'NEW_DEVICE_ID',
        },
      },
    };

    await listeners.get('state')?.(event);

    expect(updateWalletsDeprecatedState).toHaveBeenCalledWith({
      willUpdateDeprecateMap: { 'hw-wallet-1': true },
    });
    expect(emitMock).toHaveBeenCalledWith(
      EAppEventBusNames.WalletUpdate,
      undefined,
    );
    expect(emitMock).not.toHaveBeenCalledWith(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      event,
    );
  });

  it('serializes state persistence in SDK event order', async () => {
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    const updateDeviceStateMock = jest.mocked(localDb.updateDeviceState);
    updateDeviceStateMock.mockReset();
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    const emitMock = jest.mocked(appEventBus.emit);
    emitMock.mockClear();
    const listeners = new Map<
      string,
      (payload: unknown) => void | Promise<void>
    >();
    const instance = {
      on: jest.fn(
        (event: string, listener: (payload: unknown) => void | Promise<void>) =>
          listeners.set(event, listener),
      ),
    };
    let resolveFirst:
      | ((value: { kind: 'ignored'; reason: 'device-not-found' }) => void)
      | undefined;
    updateDeviceStateMock.mockImplementationOnce(
      () =>
        new Promise<{
          kind: 'ignored';
          reason: 'device-not-found';
        }>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents(instance as never);
    const listener = listeners.get('state');
    const first = listener?.({
      connectId: 'PRO2_USB',
      state: {
        revision: 1,
        updatedAt: 1,
        identity: { serialNo: 'PRO2_SERIAL' },
      },
      revision: 1,
      source: 'device-info',
      changedKeys: ['identity.bleName'],
    });
    const second = listener?.({
      connectId: 'PRO2_BLE',
      state: {
        revision: 2,
        updatedAt: 2,
        identity: { serialNo: 'PRO2_SERIAL' },
      },
      revision: 2,
      source: 'apply-settings',
      changedKeys: ['identity.label'],
    });

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    expect(localDb.updateDeviceState).toHaveBeenCalledTimes(1);
    expect(emitMock).not.toHaveBeenCalledWith(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      expect.anything(),
    );
    resolveFirst?.({ kind: 'ignored', reason: 'device-not-found' });
    await Promise.all([first, second]);
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock 不依赖 this 绑定
    expect(localDb.updateDeviceState).toHaveBeenCalledTimes(2);
    expect(emitMock).toHaveBeenCalledTimes(2);
  });

  it('does not duplicate label persistence after the SDK state event', async () => {
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
