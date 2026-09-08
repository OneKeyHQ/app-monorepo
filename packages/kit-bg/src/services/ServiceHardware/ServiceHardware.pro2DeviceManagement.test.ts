/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { DEVICE, LOG_EVENT, UI_EVENT, UI_REQUEST } from '@onekeyfe/hd-core';
import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';
import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

import localDb from '../../dbs/local/localDb';
import {
  hardwareUiStateAtom,
  hardwareUiStateCompletedAtom,
  settingsPersistAtom,
} from '../../states/jotai/atoms';

import ServiceHardware from './ServiceHardware';
import serviceHardwareUtils from './serviceHardwareUtils';

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
    HardwareConnectionStateUpdate: 'HardwareConnectionStateUpdate',
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

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Debug: 0, Info: 1, Warning: 2, Error: 3 },
    NativeLogger: { write: jest.fn() },
  }),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isDev: true,
    isJest: true,
    isNative: false,
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
    getExistingDevice: jest.fn(),
    getDeviceSafe: jest.fn(),
    getDeviceByQuery: jest.fn(),
    updateDevice: jest.fn(),
    updateDeviceState: jest.fn(),
    updateDeviceVersionInfo: jest.fn(),
  },
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    appStatus: {
      getRawData: jest.fn().mockResolvedValue({}),
      setRawData: jest.fn().mockResolvedValue({}),
    },
    legacyWalletNames: {
      setRawData: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('../../states/jotai/atoms', () => {
  const { EHardwareUiStateAction: HardwareUiStateAction } = jest.requireActual(
    '@onekeyhq/shared/types/hardwareUi',
  );
  return {
    EHardwareUiStateAction: HardwareUiStateAction,
    hardwareForceTransportAtom: {
      get: jest.fn(async () => ({ forceTransportType: undefined })),
    },
    hardwareUiStateAtom: {
      set: jest.fn(async () => undefined),
    },
    hardwareUiStateCompletedAtom: {
      set: jest.fn(async () => undefined),
    },
    settingsPersistAtom: {
      get: jest.fn(async () => ({ instanceId: 'INSTANCE_ID' })),
    },
  };
});

const createService = ({
  unlocked,
  mode = 'normal',
  passphraseState = 'PRO2_PASSPHRASE_STATE',
}: {
  unlocked: boolean;
  mode?: 'normal' | 'bootloader' | 'romloader';
  passphraseState?: string | null;
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
  // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
  jest.mocked(localDb.getDeviceByQuery).mockResolvedValue({
    id: 'db-device-1',
    connectId: 'PRO2_USB',
    connectProtocol: 'V2',
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
  const openWalletSession = jest.fn().mockImplementation((_connectId, params) =>
    Promise.resolve({
      success: true,
      payload: {
        deviceId: 'PRO2_DEVICE_ID',
        walletType: params.mode === 'select-hidden' ? 'hidden' : 'standard',
        passphraseState:
          params.mode === 'select-hidden'
            ? passphraseState
            : 'PRO2_STANDARD_STATE',
      },
    }),
  );
  const getPassphraseState = jest.fn().mockResolvedValue({
    success: true,
    payload: 'V1_PASSPHRASE_STATE',
  });
  const service = new ServiceHardware({
    backgroundApi: {} as unknown as IBackgroundApi,
  });
  service.getCompatibleConnectId = jest.fn().mockResolvedValue('PRO2_USB');
  service.getSDKInstance = jest.fn().mockResolvedValue({
    getDeviceState,
    getFeatures,
    openWalletSession,
    getPassphraseState,
  } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);

  return {
    service,
    getDeviceState,
    getFeatures,
    openWalletSession,
    getPassphraseState,
    state,
  };
};

describe('ServiceHardware SDK debug logging', () => {
  const mutablePlatformEnv = platformEnv as {
    isDesktop: boolean;
    isDev: boolean;
    isNative: boolean;
  };
  const originalPlatformEnv = {
    isDesktop: mutablePlatformEnv.isDesktop,
    isDev: mutablePlatformEnv.isDev,
    isNative: mutablePlatformEnv.isNative,
  };

  beforeEach(() => {
    mutablePlatformEnv.isDesktop = true;
    mutablePlatformEnv.isDev = true;
    mutablePlatformEnv.isNative = false;
    jest.mocked(NativeLogger.write).mockClear();
  });

  afterEach(() => {
    mutablePlatformEnv.isDesktop = originalPlatformEnv.isDesktop;
    mutablePlatformEnv.isDev = originalPlatformEnv.isDev;
    mutablePlatformEnv.isNative = originalPlatformEnv.isNative;
    jest.restoreAllMocks();
  });

  const registerSdkDebugLogListener = async ({
    showSdkDebugLogs,
  }: {
    showSdkDebugLogs: boolean;
  }) => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const instance = {
      on: jest.fn((event: string, listener: (payload: unknown) => void) => {
        listeners.set(event, listener);
      }),
    };
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    const registerSdkEvents = service.registerSdkEvents.bind(service) as (
      sdkInstance: never,
      options: { showSdkDebugLogs: boolean },
    ) => Promise<void>;

    await registerSdkEvents(instance as never, { showSdkDebugLogs });
    return listeners;
  };

  it('writes every SDK log event to the native sink when native debug logging is enabled', async () => {
    mutablePlatformEnv.isDesktop = false;
    mutablePlatformEnv.isNative = true;
    const listeners = await registerSdkDebugLogListener({
      showSdkDebugLogs: true,
    });

    listeners.get(LOG_EVENT)?.({
      event: LOG_EVENT,
      type: 'log',
      payload: ['DevicePool', 'scan started'],
    });

    expect(NativeLogger.write).toHaveBeenCalledWith(
      LogLevel.Info,
      '[HardwareSDK][bg] DevicePool scan started',
    );
  });

  it('writes every SDK log event to the Desktop console when Desktop debug logging is enabled', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    const listeners = await registerSdkDebugLogListener({
      showSdkDebugLogs: true,
    });

    listeners.get(LOG_EVENT)?.({
      event: LOG_EVENT,
      type: 'log',
      payload: ['DevicePool', 'scan started'],
    });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[HardwareSDK][bg] DevicePool scan started',
    );
    expect(NativeLogger.write).not.toHaveBeenCalled();
  });

  it('does not write SDK log events when Desktop debug logging is disabled', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    const listeners = await registerSdkDebugLogListener({
      showSdkDebugLogs: false,
    });

    listeners.get(LOG_EVENT)?.({
      event: LOG_EVENT,
      type: 'log',
      payload: ['DevicePool', 'scan started'],
    });

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(NativeLogger.write).not.toHaveBeenCalled();
  });
});

describe('ServiceHardware wallet session compatibility', () => {
  it.each([
    { deviceType: EDeviceType.Pro2, connectId: 'PRO2_USB' },
    { deviceType: EDeviceType.Neo, connectId: 'NEO_USB' },
  ])(
    'sends the same Pro-style UTF-8 challenge to the device and verify API for $deviceType',
    async ({ deviceType, connectId }) => {
      const instanceId = '94537ae5-32e9-4417-860a-1d37c8decb3e';
      jest.mocked(settingsPersistAtom.get).mockResolvedValue({
        instanceId,
      } as never);
      const withHardwareProcessing = jest
        .fn()
        .mockImplementation(async (callback: () => Promise<unknown>) =>
          callback(),
        );
      const closeHardwareUiStateDialog = jest.fn(async () => undefined);
      const backgroundApi = {
        serviceHardwareUI: {
          withHardwareProcessing,
          closeHardwareUiStateDialog,
        },
        serviceHardware: undefined as never as ServiceHardware,
      };
      const service = new ServiceHardware({
        backgroundApi: backgroundApi as never as IBackgroundApi,
      });
      backgroundApi.serviceHardware = service;
      const deviceVerifySpy = jest.fn().mockResolvedValue({
        success: true,
        payload: {
          cert: 'cert',
          signature: 'signature',
        },
      });
      const postMock = jest
        .fn()
        .mockResolvedValue({ data: { code: 0, message: 'OK' } });
      jest.spyOn(service, 'getClient').mockResolvedValue({
        post: postMock,
      } as never);
      jest.spyOn(service, 'getSDKInstance').mockResolvedValue({
        deviceVerify: deviceVerifySpy,
      } as never);
      service.getCompatibleConnectId = jest.fn().mockResolvedValue(connectId);
      await expect(
        service.firmwareAuthenticate({
          device: {
            connectId,
            deviceType,
          } as never,
        }),
      ).resolves.toMatchObject({
        verified: true,
        result: { code: 0, message: 'OK' },
        payload: {
          cert: 'cert',
          signature: 'signature',
        },
      });
      expect(deviceVerifySpy).toHaveBeenCalledTimes(1);
      const deviceVerifyArg = deviceVerifySpy.mock.calls[0]?.[1] as {
        dataHex: string;
      };
      const postArg = postMock.mock.calls[0]?.[1] as {
        data: string;
        deviceType: string;
      };
      const data = postArg?.data ?? '';
      const [uuid, timestamp, random] = data.split('_');
      expect(uuid).toBe(instanceId);
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
      );
      expect(Number.isNaN(Number(timestamp))).toBe(false);
      expect(random).toMatch(/^[0-9A-Za-z]+$/);
      expect(random).toHaveLength(12);
      expect(deviceVerifyArg?.dataHex).toBe(
        Buffer.from(data, 'utf8').toString('hex'),
      );
      expect(postMock).toHaveBeenCalledWith(
        '/wallet/v1/hardware/verify',
        expect.objectContaining({
          deviceType,
          data: expect.stringMatching(
            new RegExp(`^${instanceId}_\\d+_[0-9A-Za-z]{12}$`),
          ),
        }),
      );
      expect(closeHardwareUiStateDialog).toHaveBeenCalled();
    },
  );

  it('does not require unavailable Pro2 attestation before wallet creation', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    jest.spyOn(localDb, 'getExistingDevice').mockResolvedValue(undefined);

    await expect(
      service.shouldAuthenticateFirmware({
        device: {
          connectId: 'PRO2_USB',
          deviceId: 'PRO2_DEVICE_ID',
          deviceType: EDeviceType.Pro2,
        } as never,
      }),
    ).resolves.toBe(true);
  });

  it('uses the GetFeatures-only state scope for Classic-family firmware verification', async () => {
    const { service, state } = createService({ unlocked: true });
    state.protocol = 'V1';
    state.identity.deviceType = EDeviceType.Classic1s;
    service.getDeviceState = jest.fn().mockResolvedValue({
      ...state,
      versions: { ...state.versions, se: '1.1.0.2' },
    } as never);

    await expect(
      service.getFirmwareVerificationFeatures({
        connectId: 'CLASSIC',
        deviceType: EDeviceType.Classic1s,
      }),
    ).resolves.toMatchObject({
      onekey_firmware_version: '1.0.0',
      onekey_se01_version: '1.1.0.2',
    });

    expect(service.getDeviceState).toHaveBeenCalledWith({
      connectId: 'PRO2_USB',
      params: { scope: 'runtime' },
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
  });

  it('opens the Protocol V2 wallet selector after device unlock', async () => {
    const { service, openWalletSession, getPassphraseState } = createService({
      unlocked: false,
    });

    await expect(
      service.getPassphraseStateBase({
        connectId: 'PRO2_USB',
        forceInputPassphrase: true,
      }),
    ).resolves.toBe('PRO2_PASSPHRASE_STATE');

    expect(openWalletSession).toHaveBeenCalledWith('PRO2_USB', {
      mode: 'select-hidden',
    });
    expect(getPassphraseState).not.toHaveBeenCalled();
  });

  it('rejects a hidden-wallet response without passphraseState', async () => {
    const { service, openWalletSession, getPassphraseState } = createService({
      unlocked: true,
      passphraseState: null,
    });

    await expect(
      service.getPassphraseStateBase({
        connectId: 'PRO2_USB',
        forceInputPassphrase: true,
      }),
    ).rejects.toThrow(
      'Protocol V2 hidden wallet response is missing passphraseState',
    );

    expect(openWalletSession).toHaveBeenCalledWith('PRO2_USB', {
      mode: 'select-hidden',
    });
    expect(getPassphraseState).not.toHaveBeenCalled();
  });

  it('uses walletType to keep a Protocol V2 standard wallet out of hidden-wallet storage', async () => {
    const { service, openWalletSession, getPassphraseState } = createService({
      unlocked: true,
      passphraseState: null,
    });

    await expect(
      service.getPassphraseStateBase({
        connectId: 'PRO2_USB',
        forceInputPassphrase: false,
        useEmptyPassphrase: true,
      }),
    ).resolves.toBeUndefined();

    expect(openWalletSession).toHaveBeenCalledWith('PRO2_USB', {
      mode: 'standard',
    });
    expect(getPassphraseState).not.toHaveBeenCalled();
  });

  it('fails closed when the loaded SDK does not expose the Protocol V2 wallet session API', async () => {
    const { service, getDeviceState, getPassphraseState } = createService({
      unlocked: true,
    });
    service.getSDKInstance = jest.fn().mockResolvedValue({
      getDeviceState,
      getPassphraseState,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);

    await expect(
      service.getPassphraseStateBase({
        connectId: 'PRO2_USB',
        forceInputPassphrase: true,
      }),
    ).rejects.toThrow(
      'Protocol V2 wallet session API is unavailable in the loaded hardware SDK',
    );

    expect(getPassphraseState).not.toHaveBeenCalled();
  });

  it('restores the Protocol V1 constraint for getPassphraseState from the device database', async () => {
    const { service, openWalletSession, getPassphraseState } = createService({
      unlocked: true,
    });
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    jest.mocked(localDb.getDeviceByQuery).mockResolvedValueOnce({
      id: 'db-classic-device-1',
      connectId: 'CLASSIC',
      connectProtocol: 'V1',
      deviceStateInfo: { protocol: 'V1' },
    } as never);

    await expect(
      service.getPassphraseStateBase({
        connectId: 'CLASSIC',
        forceInputPassphrase: true,
        useEmptyPassphrase: true,
      }),
    ).resolves.toBe('V1_PASSPHRASE_STATE');

    expect(getPassphraseState).toHaveBeenCalledWith('CLASSIC', {
      initSession: true,
      useEmptyPassphrase: true,
      connectProtocol: 'V1',
    });
    expect(openWalletSession).not.toHaveBeenCalled();
  });

  it('does not detect the protocol while opening a wallet session', async () => {
    const { service, getDeviceState, openWalletSession } = createService({
      unlocked: true,
    });
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    jest.mocked(localDb.getDeviceByQuery).mockResolvedValue(undefined);

    await expect(
      service.getPassphraseStateBase({
        connectId: 'NEW_PRO2',
        forceInputPassphrase: true,
      }),
    ).rejects.toThrow('Hardware connect protocol is unavailable');

    expect(getDeviceState).not.toHaveBeenCalled();
    expect(openWalletSession).not.toHaveBeenCalled();
  });
});

describe('ServiceHardware.getDeviceState', () => {
  it('does not detect or infer the protocol during a normal device-state call', async () => {
    const { service, getDeviceState } = createService({ unlocked: false });
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    jest.mocked(localDb.getDeviceByQuery).mockResolvedValueOnce({
      id: 'db-device-without-protocol',
      connectId: 'PRO2_USB',
      deviceType: EDeviceType.Pro2,
    } as never);

    await expect(
      service.getDeviceState({ connectId: 'PRO2_USB' }),
    ).rejects.toThrow('Hardware connect protocol is unavailable');

    expect(getDeviceState).not.toHaveBeenCalled();
  });

  it('queries the live canonical SDK state', async () => {
    const { service, getDeviceState, state } = createService({
      unlocked: false,
    });

    await expect(
      service.getDeviceState({ connectId: 'ORIGINAL_ID' }),
    ).resolves.toBe(state);

    expect(getDeviceState).toHaveBeenCalledWith('PRO2_USB', {
      connectProtocol: 'V2',
    });
  });

  it('forwards a semantic scope through the same state API', async () => {
    const { service, getDeviceState } = createService({ unlocked: false });

    await service.getDeviceState({
      connectId: 'PRO2',
      params: { scope: 'firmware' },
    });

    expect(getDeviceState).toHaveBeenCalledWith('PRO2_USB', {
      connectProtocol: 'V2',
      scope: 'firmware',
    });
  });

  it.each(['V1', 'V2'] as const)(
    'persists a %s firmware snapshot even when the SDK emits no state event',
    async (protocol) => {
      const { service, getDeviceState, state } = createService({
        unlocked: false,
      });
      const firmwareState = {
        ...state,
        protocol,
        versions: {
          firmware: '4.21.0',
          bluetooth: '2.3.7',
          bootloader: '2.8.4',
        },
      };
      jest.mocked(localDb.getDeviceByQuery).mockResolvedValue({
        id: 'db-device-1',
        connectId: 'PRO_USB',
        connectProtocol: protocol,
        deviceStateInfo: {
          ...firmwareState,
          versions: {
            firmware: '4.16.1',
            bluetooth: '2.3.4',
            bootloader: '2.8.2',
          },
        },
      } as never);
      getDeviceState.mockResolvedValue({
        success: true,
        payload: firmwareState,
      });
      jest.mocked(localDb.updateDeviceState).mockResolvedValue({
        kind: 'updated',
        state: firmwareState,
      } as never);

      await service.getDeviceState({
        connectId: 'PRO_USB',
        params: { scope: 'firmware' },
      });

      expect(localDb.updateDeviceState).toHaveBeenCalledWith({
        changedKeys: [
          'versions.firmware',
          'versions.bluetooth',
          'versions.bootloader',
        ],
        connectId: 'PRO2_USB',
        revision: firmwareState.revision,
        source: 'device-info',
        state: firmwareState,
      });
      expect(appEventBus.emit).toHaveBeenCalledWith(
        EAppEventBusNames.HardwareDeviceStateUpdate,
        expect.objectContaining({ state: firmwareState }),
      );
    },
  );

  it('projects legacy App features from DeviceState without calling SDK getFeatures', async () => {
    const { service, getDeviceState } = createService({ unlocked: true });

    await expect(
      service.getFeaturesWithoutCache({ connectId: 'PRO2' }),
    ).resolves.toMatchObject({
      deviceId: 'PRO2_DEVICE_ID',
      label: 'OneKey Pro 2',
    });
    expect(getDeviceState).toHaveBeenCalledWith('PRO2', {
      connectProtocol: 'V2',
    });
  });

  it('keeps the x-branch BLE-only result contract while using Protocol V2 state API', async () => {
    const { service, getDeviceState, getFeatures } = createService({
      unlocked: true,
    });
    getDeviceState.mockResolvedValue({
      success: true,
      payload: null,
    } as never);

    await expect(
      service.getFeaturesWithoutCache({
        connectId: 'PRO2',
        params: {
          connectProtocol: 'V2',
          retryCount: 0,
          onlyConnectBleDevice: true,
        },
      }),
    ).resolves.toBeNull();

    expect(getDeviceState).toHaveBeenCalledWith('PRO2', {
      connectProtocol: 'V2',
      retryCount: 0,
      onlyConnectBleDevice: true,
    });
    expect(getFeatures).not.toHaveBeenCalled();
  });

  it('delegates Protocol V1 compatibility projection to the SDK', async () => {
    const { service, getDeviceState, getFeatures } = createService({
      unlocked: true,
    });
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    jest.mocked(localDb.getDeviceByQuery).mockResolvedValueOnce({
      id: 'db-classic-device-1',
      connectId: 'CLASSIC',
      deviceStateInfo: { protocol: 'V1' },
    } as never);
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
    expect(getFeatures).toHaveBeenCalledWith('CLASSIC', {
      connectProtocol: 'V1',
    });
    expect(getDeviceState).not.toHaveBeenCalled();
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

describe('ServiceHardware.updateDeviceVersionAfterFirmwareUpdate', () => {
  it('refreshes live firmware state before updating compatibility data', async () => {
    const { service, state } = createService({ unlocked: false });
    const getDeviceState = jest
      .spyOn(service, 'getDeviceState')
      .mockResolvedValue(state as never);
    jest
      .mocked(localDb.updateDeviceVersionInfo)
      .mockResolvedValue(undefined as never);

    await service.updateDeviceVersionAfterFirmwareUpdate({
      releaseResult: {
        originalConnectId: 'PRO2_USB',
        updateInfos: {},
      },
    } as never);

    expect(getDeviceState).toHaveBeenCalledWith({
      connectId: 'PRO2_USB',
      params: { scope: 'firmware' },
      hardwareCallContext: EHardwareCallContext.UPDATE_FIRMWARE,
      silentMode: true,
    });
    expect(getDeviceState.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(localDb.updateDeviceVersionInfo).mock.invocationCallOrder[0],
    );
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
      connectProtocol: 'V2',
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
    ).resolves.toEqual({
      state: baseState,
    });
    expect(getDeviceState).toHaveBeenNthCalledWith(1, {
      connectId: 'PRO2_USB',
      params: { scope: 'settings' },
      hardwareCallContext: 'user_interaction_no_ble_dialog',
      silentMode: true,
    });
    expect(getDeviceState).toHaveBeenNthCalledWith(2, {
      connectId: 'PRO2_USB',
      params: undefined,
      hardwareCallContext: 'user_interaction_no_ble_dialog',
      silentMode: true,
    });
  });

  it('does not coalesce settings and firmware refreshes for the same device', async () => {
    const { service, state } = createService({ unlocked: true });
    let resolveFirstSettings: ((value: typeof state) => void) | undefined;
    let settingsCalls = 0;
    const getDeviceState = jest.fn(
      ({ params }: { params?: { scope?: string } }) => {
        if (params?.scope === 'settings') {
          settingsCalls += 1;
          if (settingsCalls === 1) {
            return new Promise<typeof state>((resolve) => {
              resolveFirstSettings = resolve;
            });
          }
        }
        return Promise.resolve(state);
      },
    );
    service.getDeviceState = getDeviceState as never;

    const settingsRequest = service.getDeviceManagementSnapshot({
      connectId: 'PRO2',
    });
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    const firmwareRequest = service.getDeviceManagementSnapshot({
      connectId: 'PRO2',
      refreshInfo: true,
    });
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    expect(getDeviceState).toHaveBeenCalledWith(
      expect.objectContaining({ params: { scope: 'firmware' } }),
    );
    resolveFirstSettings?.(state);
    await Promise.all([settingsRequest, firmwareRequest]);
  });
});

describe('ServiceHardware SDK DeviceState synchronization', () => {
  it('按设备身份跟踪连接状态，而不是把任意硬件设备视为目标设备在线', async () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents({
      on: jest.fn((event: string, listener: (payload: unknown) => void) =>
        listeners.set(event, listener),
      ),
    } as never);
    jest.mocked(localDb.getDeviceSafe).mockResolvedValue({
      id: 'db-device-a',
      connectId: 'DEVICE_A_USB',
      deviceId: 'DEVICE_A_ID',
    } as never);

    listeners.get(DEVICE.CONNECT)?.({
      device: { connectId: 'DEVICE_B_USB' },
    });
    await expect(
      service.isHardwareDeviceConnected({ deviceDbId: 'db-device-a' }),
    ).resolves.toBe(false);

    listeners.get(DEVICE.CONNECT)?.({
      device: { connectId: 'DEVICE_A_USB' },
    });
    await expect(
      service.getConnectedHardwareDeviceIdentityKeys(),
    ).resolves.toEqual(
      expect.arrayContaining(['DEVICE_A_USB', 'DEVICE_B_USB']),
    );
    await expect(
      service.isHardwareDeviceConnected({ deviceDbId: 'db-device-a' }),
    ).resolves.toBe(true);

    listeners.get(DEVICE.DISCONNECT)?.({
      device: { connectId: 'DEVICE_A_USB' },
    });
    await expect(
      service.getConnectedHardwareDeviceIdentityKeys(),
    ).resolves.toEqual(['DEVICE_B_USB']);
    await expect(
      service.isHardwareDeviceConnected({ deviceDbId: 'db-device-a' }),
    ).resolves.toBe(false);
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.HardwareConnectionStateUpdate,
      undefined,
    );
  });

  it('forwards all tracked identity keys when a device disconnects', async () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const notifyHardwareDeviceConnected = jest
      .fn()
      .mockResolvedValue(undefined);
    const notifyHardwareDeviceDisconnected = jest
      .fn()
      .mockResolvedValue(undefined);
    const service = new ServiceHardware({
      backgroundApi: {
        serviceHardwarePortfolioSync: {
          notifyHardwareDeviceConnected,
          notifyHardwareDeviceDisconnected,
        },
      } as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents({
      on: jest.fn((event: string, listener: (payload: unknown) => void) =>
        listeners.set(event, listener),
      ),
    } as never);

    listeners.get(DEVICE.CONNECT)?.({
      device: {
        connectId: 'PRO2_USB',
        serialNo: 'PRO2_SERIAL',
        uuid: 'PRO2_UUID',
      },
    });
    listeners.get(DEVICE.DISCONNECT)?.({
      device: { connectId: 'PRO2_USB' },
    });

    expect(notifyHardwareDeviceDisconnected).toHaveBeenCalledWith({
      identityKeys: ['PRO2_USB', 'PRO2_UUID', 'PRO2_SERIAL'],
    });
  });

  it('features 到达后补录设备身份并广播连接状态', async () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents({
      on: jest.fn((event: string, listener: (payload: unknown) => void) =>
        listeners.set(event, listener),
      ),
    } as never);

    // DEVICE.CONNECT arrives before features are complete
    listeners.get(DEVICE.CONNECT)?.({
      device: { connectId: 'PRO2_USB' },
    });
    await expect(
      service.getConnectedHardwareDeviceIdentityKeys(),
    ).resolves.toEqual(['PRO2_USB']);
    jest.mocked(appEventBus.emit).mockClear();

    listeners.get(DEVICE.SUPPORT_FEATURES)?.({
      device: {
        connectId: 'PRO2_USB',
        uuid: 'PRO2_UUID',
        deviceId: 'PRO2_DEVICE_ID',
        features: { device_id: 'PRO2_DEVICE_ID' },
      },
    });

    await expect(
      service.getConnectedHardwareDeviceIdentityKeys(),
    ).resolves.toEqual(
      expect.arrayContaining(['PRO2_USB', 'PRO2_UUID', 'PRO2_DEVICE_ID']),
    );
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.HardwareConnectionStateUpdate,
      undefined,
    );

    // An identical features event must not re-broadcast
    jest.mocked(appEventBus.emit).mockClear();
    listeners.get(DEVICE.SUPPORT_FEATURES)?.({
      device: {
        connectId: 'PRO2_USB',
        uuid: 'PRO2_UUID',
        deviceId: 'PRO2_DEVICE_ID',
        features: { device_id: 'PRO2_DEVICE_ID' },
      },
    });
    expect(appEventBus.emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.HardwareConnectionStateUpdate,
      undefined,
    );
  });

  it('SDK 实例替换时清空连接身份并广播连接状态', async () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents({
      on: jest.fn((event: string, listener: (payload: unknown) => void) =>
        listeners.set(event, listener),
      ),
    } as never);
    listeners.get(DEVICE.CONNECT)?.({
      device: { connectId: 'PRO2_USB' },
    });
    await expect(
      service.getConnectedHardwareDeviceIdentityKeys(),
    ).resolves.toEqual(['PRO2_USB']);
    jest.mocked(appEventBus.emit).mockClear();

    // A replaced SDK instance no longer tracks the previous connections
    await service.registerSdkEvents({ on: jest.fn() } as never);

    await expect(
      service.getConnectedHardwareDeviceIdentityKeys(),
    ).resolves.toEqual([]);
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.HardwareConnectionStateUpdate,
      undefined,
    );
  });

  it('resetHardwareSDK 时清空连接身份并广播连接状态', async () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const service = new ServiceHardware({
      backgroundApi: {
        serviceHardwareUI: {
          runExclusiveOneKeyOperation: (fn: () => Promise<void>) => fn(),
        },
      } as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents({
      on: jest.fn((event: string, listener: (payload: unknown) => void) =>
        listeners.set(event, listener),
      ),
    } as never);
    listeners.get(DEVICE.CONNECT)?.({
      device: { connectId: 'PRO2_USB' },
    });
    await expect(
      service.getConnectedHardwareDeviceIdentityKeys(),
    ).resolves.toEqual(['PRO2_USB']);
    jest.mocked(appEventBus.emit).mockClear();

    await service.resetHardwareSDK();

    await expect(
      service.getConnectedHardwareDeviceIdentityKeys(),
    ).resolves.toEqual([]);
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.HardwareConnectionStateUpdate,
      undefined,
    );
  });

  it('普通断连后保留已确认协议，供重连继续固定使用', async () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents({
      on: jest.fn((event: string, listener: (payload: unknown) => void) =>
        listeners.set(event, listener),
      ),
    } as never);
    const internals = service as unknown as {
      deviceProtocolByConnectId: Map<string, 'V1' | 'V2'>;
      rememberDeviceProtocol: (params: {
        connectIds: string[];
        protocol: 'V1' | 'V2';
      }) => Promise<void>;
    };
    await internals.rememberDeviceProtocol({
      connectIds: ['PRO2_USB'],
      protocol: 'V2',
    });

    listeners.get(DEVICE.DISCONNECT)?.({
      device: { connectId: 'PRO2_USB' },
    });

    expect(internals.deviceProtocolByConnectId.get('PRO2_USB')).toBe('V2');
  });

  it('keeps wallets active after a successful device wipe', async () => {
    const updateWalletsDeprecatedState = jest.fn().mockResolvedValue(true);
    const service = new ServiceHardware({
      backgroundApi: {
        serviceAccount: {
          updateWalletsDeprecatedState,
        },
      } as unknown as IBackgroundApi,
    });
    service.deviceSettingsManager.wipeDevice = jest
      .fn()
      .mockResolvedValue({ message: 'Success' });
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on this binding.
    const emitMock = jest.mocked(appEventBus.emit);
    emitMock.mockClear();

    await expect(
      service.wipeDevice({
        walletId: 'hw-wallet-1',
        connectId: 'PRO2_USB',
      }),
    ).resolves.toEqual({ message: 'Success' });

    expect(updateWalletsDeprecatedState).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalledWith(
      EAppEventBusNames.WalletUpdate,
      undefined,
    );
  });

  it('refreshes wallet consumers after a firmware switch deprecates wallets', async () => {
    const updateWalletsDeprecatedState = jest.fn().mockResolvedValue(true);
    const service = new ServiceHardware({
      backgroundApi: {
        serviceAccount: {
          getAllHwQrWalletWithDevice: jest.fn().mockResolvedValue({
            'hw-wallet-1': {
              wallet: { id: 'hw-wallet-1' },
              device: { connectId: 'CLASSIC_USB' },
            },
          }),
          updateWalletsDeprecatedState,
        },
      } as unknown as IBackgroundApi,
    });
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on this binding.
    const emitMock = jest.mocked(appEventBus.emit);
    emitMock.mockClear();

    await service.updateHwWalletsDeprecatedStatus({
      connectId: 'CLASSIC_USB',
    });

    expect(updateWalletsDeprecatedState).toHaveBeenCalledWith({
      willUpdateDeprecateMap: {
        'hw-wallet-1': true,
      },
    });
    expect(emitMock).toHaveBeenCalledWith(
      EAppEventBusNames.WalletUpdate,
      undefined,
    );
  });

  it('applies async hardware UI events in SDK arrival order', async () => {
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
    const setHardwareUiStateMock = jest.mocked(hardwareUiStateAtom.set);
    setHardwareUiStateMock.mockClear();
    const getDeviceByQueryMock = jest.mocked(localDb.getDeviceByQuery);
    getDeviceByQueryMock.mockReset();
    let resolvePinDevice:
      | ((value: Awaited<ReturnType<typeof localDb.getDeviceByQuery>>) => void)
      | undefined;
    getDeviceByQueryMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePinDevice = resolve;
        }),
    );
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents(instance as never);
    const listener = listeners.get(UI_EVENT);

    const pinTask = listener?.({
      type: UI_REQUEST.REQUEST_PIN,
      payload: {
        device: {
          connectId: 'PRO2_USB',
          deviceType: EDeviceType.Pro2,
          features: { mode: 'normal' },
        },
      },
    });
    const passphraseTask = listener?.({
      type: UI_REQUEST.REQUEST_PASSPHRASE,
      payload: {
        device: {
          connectId: 'PRO2_USB',
          deviceType: EDeviceType.Pro2,
          features: { mode: 'normal' },
        },
      },
    });

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    expect(setHardwareUiStateMock).not.toHaveBeenCalled();

    resolvePinDevice?.({
      connectId: 'PRO2_USB',
      deviceType: EDeviceType.Pro2,
      settings: { inputPinOnSoftware: false },
    } as never);
    await Promise.all([pinTask, passphraseTask]);

    const actions = setHardwareUiStateMock.mock.calls.map(([updater]) =>
      typeof updater === 'function'
        ? updater(undefined)?.action
        : updater?.action,
    );
    expect(actions).toEqual([
      EHardwareUiStateAction.EnterPinOnDevice,
      EHardwareUiStateAction.REQUEST_PASSPHRASE,
    ]);
  });

  it('rebinds firmware progress events after the SDK instance changes', async () => {
    const createInstance = () => {
      const listeners = new Map<
        string,
        (payload: unknown) => void | Promise<void>
      >();
      return {
        listeners,
        instance: {
          on: jest.fn(
            (
              event: string,
              listener: (payload: unknown) => void | Promise<void>,
            ) => {
              listeners.set(event, listener);
            },
          ),
        },
      };
    };
    const firstSdk = createInstance();
    const replacementSdk = createInstance();
    const setHardwareUiStateMock = jest.mocked(hardwareUiStateAtom.set);
    setHardwareUiStateMock.mockClear();
    const setCompletedUiStateMock = jest.mocked(
      hardwareUiStateCompletedAtom.set,
    );
    setCompletedUiStateMock.mockClear();
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });

    await service.registerSdkEvents(firstSdk.instance as never);
    await service.registerSdkEvents(replacementSdk.instance as never);
    await replacementSdk.listeners.get(UI_EVENT)?.({
      type: UI_REQUEST.FIRMWARE_PROGRESS,
      payload: {
        device: {
          connectId: 'PRO2_USB',
          deviceType: EDeviceType.Pro2,
        },
        progress: 25,
        progressType: 'transferData',
        transferredBytes: 256_000,
        totalBytes: 1_024_000,
        rateBytesPerSecond: 16_384,
        elapsedMs: 15_625,
        installTargetId: 10,
        installPhase: 'install',
        installPhaseProgress: 45,
      },
    });

    expect(replacementSdk.instance.on).toHaveBeenCalledWith(
      UI_EVENT,
      expect.any(Function),
    );
    const updater = setHardwareUiStateMock.mock.calls.at(-1)?.[0];
    const state = typeof updater === 'function' ? updater(undefined) : updater;
    expect(state).toMatchObject({
      action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
      connectId: 'PRO2_USB',
      payload: {
        firmwareProgress: 25,
        firmwareProgressType: 'transferData',
        firmwareTransferMetrics: {
          transferredBytes: 256_000,
          totalBytes: 1_024_000,
          rateBytesPerSecond: 16_384,
          elapsedMs: 15_625,
        },
        firmwareInstallTargetId: 10,
        firmwareInstallPhase: 'install',
        firmwareInstallPhaseProgress: 45,
      },
    });

    const completedProgressUpdater =
      setCompletedUiStateMock.mock.calls.at(-1)?.[0];
    const completedProgressState =
      typeof completedProgressUpdater === 'function'
        ? completedProgressUpdater(undefined)
        : completedProgressUpdater;

    await replacementSdk.listeners.get(UI_EVENT)?.({
      type: UI_REQUEST.FIRMWARE_TIP,
      payload: {
        device: {
          connectId: 'PRO2_USB',
          deviceType: EDeviceType.Pro2,
        },
        data: { message: 'FirmwareUpdating' },
      },
    });

    const completedTipUpdater = setCompletedUiStateMock.mock.calls.at(-1)?.[0];
    const completedTipState =
      typeof completedTipUpdater === 'function'
        ? completedTipUpdater(completedProgressState)
        : completedTipUpdater;
    expect(completedTipState).toMatchObject({
      action: EHardwareUiStateAction.FIRMWARE_TIP,
      connectId: 'PRO2_USB',
      payload: {
        firmwareTransferMetrics: {
          transferredBytes: 256_000,
          totalBytes: 1_024_000,
          rateBytesPerSecond: 16_384,
          elapsedMs: 15_625,
        },
      },
    });
  });

  it('preserves the firmware tip when the next progress event arrives', async () => {
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
    const setHardwareUiStateMock = jest.mocked(hardwareUiStateAtom.set);
    setHardwareUiStateMock.mockClear();
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents(instance as never);

    await listeners.get(UI_EVENT)?.({
      type: UI_REQUEST.FIRMWARE_TIP,
      payload: {
        device: {
          connectId: 'PRO2_USB',
          deviceType: EDeviceType.Pro2,
        },
        data: { message: 'ConfirmOnDevice' },
      },
    });
    const tipUpdater = setHardwareUiStateMock.mock.calls.at(-1)?.[0];
    const tipState =
      typeof tipUpdater === 'function' ? tipUpdater(undefined) : tipUpdater;

    await listeners.get(UI_EVENT)?.({
      type: UI_REQUEST.FIRMWARE_PROGRESS,
      payload: {
        device: {
          connectId: 'PRO2_USB',
          deviceType: EDeviceType.Pro2,
        },
        progress: 0,
        progressType: 'installingFirmware',
        installTargetId: 10,
        installPhase: 'prepare',
        installPhaseProgress: 0,
      },
    });
    const progressUpdater = setHardwareUiStateMock.mock.calls.at(-1)?.[0];
    const progressState =
      typeof progressUpdater === 'function'
        ? progressUpdater(tipState)
        : progressUpdater;

    expect(progressState).toMatchObject({
      action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
      connectId: 'PRO2_USB',
      payload: {
        firmwareProgress: 0,
        firmwareProgressType: 'installingFirmware',
        firmwareInstallTargetId: 10,
        firmwareInstallPhase: 'prepare',
        firmwareInstallPhaseProgress: 0,
        firmwareTipData: { message: 'ConfirmOnDevice' },
      },
    });
  });

  it('preserves queued firmware progress across the expected install disconnect', async () => {
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
    const setHardwareUiStateMock = jest.mocked(hardwareUiStateAtom.set);
    setHardwareUiStateMock.mockClear();
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents(instance as never);
    const uiListener = listeners.get(UI_EVENT);

    const createProgressEvent = (progress: number) => ({
      type: UI_REQUEST.FIRMWARE_PROGRESS,
      payload: {
        device: {
          connectId: 'PRO2_USB',
          deviceType: EDeviceType.Pro2,
        },
        progress,
        progressType: 'transferData',
      },
    });

    await uiListener?.(createProgressEvent(1));
    const progress25 = uiListener?.(createProgressEvent(25));
    const progress50 = uiListener?.(createProgressEvent(50));
    await listeners.get(DEVICE.DISCONNECT)?.({
      device: { connectId: 'PRO2_USB' },
    });
    await Promise.all([progress25, progress50]);

    const firmwareProgressValues = setHardwareUiStateMock.mock.calls
      .map(([updater]) =>
        typeof updater === 'function' ? updater(undefined) : updater,
      )
      .filter(
        (state) => state?.action === EHardwareUiStateAction.FIRMWARE_PROGRESS,
      )
      .map((state) => state?.payload?.firmwareProgress);
    expect(firmwareProgressValues).toEqual([1, 25, 50]);
  });

  it('forwards device transfer progress to the hardware UI state', async () => {
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
    const setHardwareUiStateMock = jest.mocked(hardwareUiStateAtom.set);
    setHardwareUiStateMock.mockClear();
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents(instance as never);

    await listeners.get(UI_EVENT)?.({
      type: UI_REQUEST.DEVICE_PROGRESS,
      payload: {
        progress: 42,
        transferredBytes: 420,
        totalBytes: 1000,
        rateBytesPerSecond: 210,
        elapsedMs: 2000,
      },
    });

    const updater = setHardwareUiStateMock.mock.calls.at(-1)?.[0];
    const state = typeof updater === 'function' ? updater(undefined) : updater;
    expect(state).toMatchObject({
      action: EHardwareUiStateAction.DEVICE_PROGRESS,
      payload: {
        deviceProgress: {
          progress: 42,
          transferredBytes: 420,
          totalBytes: 1000,
          rateBytesPerSecond: 210,
          elapsedMs: 2000,
        },
      },
    });
  });

  it('clears device progress when the matching Protocol V2 interaction closes', async () => {
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
    const setHardwareUiStateMock = jest.mocked(hardwareUiStateAtom.set);
    setHardwareUiStateMock.mockClear();
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents(instance as never);
    const listener = listeners.get(UI_EVENT);

    await listener?.({
      type: UI_REQUEST.DEVICE_PROGRESS,
      payload: {
        device: {
          connectId: 'PRO2_USB',
          deviceType: EDeviceType.Pro2,
        },
        interaction: {
          interactionId: 'interaction-progress',
          phaseId: 'interaction-progress:phase-1',
          sequence: 1,
          phase: 'processing',
          transition: 'start',
          protocol: 'V2',
        },
        progress: 100,
      },
    });
    await listener?.({
      type: UI_REQUEST.CLOSE_UI_WINDOW,
      payload: {
        device: {
          connectId: 'PRO2_USB',
          deviceType: EDeviceType.Pro2,
        },
        interactionId: 'interaction-progress',
        phaseId: 'interaction-progress:phase-1',
        sequence: 2,
        phase: 'processing',
        transition: 'finish',
        outcome: 'succeeded',
        protocol: 'V2',
      },
    });

    expect(setHardwareUiStateMock).toHaveBeenLastCalledWith(undefined);
  });

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
    const hardwareLogSpy = jest
      .spyOn(serviceHardwareUtils, 'hardwareLog')
      .mockImplementation(() => undefined);
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

    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    expect(localDb.updateDeviceState).toHaveBeenCalledWith(
      expect.objectContaining({
        changedKeys: ['identity.label'],
        connectId: 'PRO2_USB',
        revision: 2,
        sdkEventSequence: 1,
        sdkInstanceEpoch: 1,
        source: 'apply-settings',
        state,
      }),
    );
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      expect.objectContaining({ state, revision: 2 }),
    );
    expect(hardwareLogSpy).toHaveBeenCalledWith(
      'device state update',
      expect.objectContaining({
        changedKeys: ['identity.label'],
        connectId: 'PRO2_USB',
        serialNo: 'PRO2_SERIAL',
        revision: 2,
        source: 'apply-settings',
      }),
    );
    // Full identifiers are limited to the state receipt diagnostic.
    const otherLogs = JSON.stringify(
      hardwareLogSpy.mock.calls.filter(
        ([name]) => name !== 'device state update',
      ),
    );
    expect(otherLogs).not.toContain('PRO2_SERIAL');
    expect(otherLogs).not.toContain('PRO2_USB');
    hardwareLogSpy.mockRestore();
  });

  it('still broadcasts the in-memory state when persistence fails', async () => {
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
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
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    expect(appEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      event,
    );
  });

  it('does not broadcast an event rejected as stale by persistence', async () => {
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    const updateDeviceStateMock = jest.mocked(localDb.updateDeviceState);
    updateDeviceStateMock.mockReset();
    updateDeviceStateMock.mockResolvedValueOnce({
      kind: 'ignored',
      reason: 'stale',
    });
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    const emitMock = jest.mocked(appEventBus.emit);
    emitMock.mockClear();
    const listeners = new Map<
      string,
      (payload: unknown) => void | Promise<void>
    >();
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents({
      on: jest.fn(
        (event: string, listener: (payload: unknown) => void | Promise<void>) =>
          listeners.set(event, listener),
      ),
    } as never);
    const event = {
      connectId: 'PRO2_USB',
      revision: 1,
      changedKeys: ['status.unlocked'],
      source: 'device-status',
      state: {
        revision: 1,
        updatedAt: 1,
        protocol: 'V2',
        identity: { serialNo: 'PRO2_SERIAL', deviceId: 'PRO2_DEVICE_ID' },
      },
    };

    await listeners.get('state')?.(event);

    expect(emitMock).not.toHaveBeenCalledWith(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      event,
    );
    expect(
      (
        service as unknown as {
          deviceProtocolByConnectId: Map<string, 'V1' | 'V2'>;
        }
      ).deviceProtocolByConnectId.has('PRO2_USB'),
    ).toBe(false);
  });

  it('cleans the device event queue when an App subscriber throws', async () => {
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    jest.mocked(localDb.updateDeviceState).mockResolvedValueOnce({
      kind: 'updated',
      deviceDbId: 'db-device-1',
      state: {} as never,
    });
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    const emitMock = jest.mocked(appEventBus.emit);
    emitMock.mockImplementationOnce(() => {
      throw new OneKeyLocalError('Subscriber failed');
    });
    const listeners = new Map<
      string,
      (payload: unknown) => void | Promise<void>
    >();
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    await service.registerSdkEvents({
      on: jest.fn(
        (event: string, listener: (payload: unknown) => void | Promise<void>) =>
          listeners.set(event, listener),
      ),
    } as never);

    await expect(
      listeners.get('state')?.({
        connectId: 'PRO2_USB',
        revision: 2,
        changedKeys: ['status.unlocked'],
        source: 'device-status',
        state: {
          revision: 2,
          updatedAt: 2,
          protocol: 'V2',
          identity: {
            serialNo: 'PRO2_SERIAL',
            deviceId: 'PRO2_DEVICE_ID',
          },
        },
      }),
    ).resolves.toBeUndefined();
    expect(
      (
        service as unknown as {
          deviceStateSyncQueues: Map<string, Promise<void>>;
        }
      ).deviceStateSyncQueues.size,
    ).toBe(0);
  });

  it('keeps the old wallet active and suppresses a reset identity event', async () => {
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
    const notifyHardwareDeviceIdentityMismatch = jest
      .fn()
      .mockResolvedValue(undefined);
    const service = new ServiceHardware({
      backgroundApi: {
        serviceAccount: {
          updateWalletsDeprecatedState,
        },
        serviceHardwarePortfolioSync: {
          notifyHardwareDeviceIdentityMismatch,
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

    expect(updateWalletsDeprecatedState).not.toHaveBeenCalled();
    expect(notifyHardwareDeviceIdentityMismatch).toHaveBeenCalledWith({
      deviceDbId: 'db-device-1',
      expectedDeviceId: 'OLD_DEVICE_ID',
    });
    expect(emitMock).not.toHaveBeenCalledWith(
      EAppEventBusNames.WalletUpdate,
      undefined,
    );
    expect(emitMock).not.toHaveBeenCalledWith(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      event,
    );
  });

  it('serializes state persistence in SDK event order', async () => {
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    const updateDeviceStateMock = jest.mocked(localDb.updateDeviceState);
    updateDeviceStateMock.mockReset();
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
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
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    expect(localDb.updateDeviceState).toHaveBeenCalledTimes(1);
    expect(emitMock).not.toHaveBeenCalledWith(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      expect.anything(),
    );
    resolveFirst?.({ kind: 'ignored', reason: 'device-not-found' });
    await Promise.all([first, second]);
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    expect(localDb.updateDeviceState).toHaveBeenCalledTimes(2);
    expect(emitMock).toHaveBeenCalledTimes(2);
  });

  it.each([EDeviceType.Pro2, EDeviceType.Neo])(
    'writes the %s label back to app state after changing the device label',
    async (deviceType) => {
      const setWalletNameAndAvatar = jest.fn().mockResolvedValue(undefined);
      const currentState = {
        protocol: 'V2',
        revision: 4,
        updatedAt: 100,
        identity: {
          deviceId: 'DEVICE_ID',
          serialNo: 'DEVICE_SERIAL',
          deviceType,
          label: 'Old label',
        },
        status: {},
        settings: {},
        versions: {},
      };
      jest.mocked(localDb.getDeviceSafe).mockResolvedValue({
        id: 'db-device-1',
        connectId: 'DEVICE_CONNECT_ID',
        deviceStateInfo: currentState,
      } as never);
      jest.mocked(localDb.updateDeviceState).mockResolvedValue({
        kind: 'updated',
        deviceDbId: 'db-device-1',
        state: currentState,
      } as never);
      const service = new ServiceHardware({
        backgroundApi: {
          serviceAccount: {
            getWalletSafe: jest.fn().mockResolvedValue({
              associatedDevice: 'db-device-1',
              name: 'Wallet',
            }),
            setWalletNameAndAvatar,
          },
        } as unknown as IBackgroundApi,
      });
      service.deviceSettingsManager.setDeviceLabel = jest
        .fn()
        .mockResolvedValue({ message: 'Success' });
      // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
      jest.mocked(appEventBus.emit).mockClear();
      await service.setDeviceLabel({
        walletId: 'hw-wallet-1',
        label: 'Renamed Pro 2',
      });

      // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
      expect(localDb.updateDeviceState).toHaveBeenCalledWith(
        expect.objectContaining({
          changedKeys: ['identity.label'],
          connectId: 'DEVICE_CONNECT_ID',
          revision: 5,
          source: 'settings-write',
          state: expect.objectContaining({
            revision: 5,
            identity: expect.objectContaining({
              deviceType,
              label: 'Renamed Pro 2',
            }),
          }),
        }),
      );
      expect(appEventBus.emit).toHaveBeenCalledWith(
        EAppEventBusNames.HardwareDeviceStateUpdate,
        expect.objectContaining({
          changedKeys: ['identity.label'],
          revision: 5,
        }),
      );
      // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
      expect(setWalletNameAndAvatar).toHaveBeenCalledWith({
        walletId: 'hw-wallet-1',
        name: 'Renamed Pro 2',
        shouldCheckDuplicate: false,
      });
      expect(appEventBus.emit).not.toHaveBeenCalledWith(
        EAppEventBusNames.SyncDeviceLabelToWalletName,
        expect.anything(),
      );
    },
  );
});

describe('ServiceHardware.fetchHardwareHomeScreen', () => {
  it.each([EDeviceType.Pro2, EDeviceType.Neo] as const)(
    'requests %s homescreens with the native device type',
    async (deviceType) => {
      const get = jest.fn().mockResolvedValue({
        data: {
          data: [
            {
              id: `${deviceType}-wallpaper`,
              wallpaperType: 'default',
              resType: 'custom',
              url: `https://example.com/${deviceType}-wallpaper.png`,
              deviceTypes: [deviceType],
            },
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
          deviceType,
          serialNumber: 'PR9999999999',
          firmwareVersion: '1.0.0',
        }),
      ).resolves.toEqual([
        {
          id: `${deviceType}-wallpaper`,
          wallpaperType: 'default',
          resType: 'custom',
          url: `https://example.com/${deviceType}-wallpaper.png`,
          screenHex: undefined,
          nameHex: undefined,
        },
      ]);
      expect(get).toHaveBeenCalledWith('/utility/v1/wallet-homescreen/list', {
        params: {
          deviceType,
          serialNumber: 'PR9999999999',
          firmwareVersion: '1.0.0',
        },
      });
    },
  );
});

describe('ServiceHardware.fetchFirmwareVerifyHash', () => {
  it.each([EDeviceType.Pro2, EDeviceType.Neo] as const)(
    'requests firmware/detail with the native %s device type',
    async (deviceType) => {
      const get = jest.fn().mockResolvedValue({
        data: {
          data: {
            firmwares: [],
          },
        },
      });
      const backgroundApi = {
        serviceHardware: undefined as never as ServiceHardware,
      };
      const service = new ServiceHardware({
        backgroundApi: backgroundApi as never as IBackgroundApi,
      });
      backgroundApi.serviceHardware = service;
      jest.spyOn(service, 'getClient').mockResolvedValue({
        get,
      } as never);

      await service.hardwareVerifyManager.fetchFirmwareVerifyHash({
        deviceType,
        firmwareVersion: '1.0.0',
        bluetoothVersion: '1.0.0',
        bootloaderVersion: '1.0.0',
        firmwareType: EFirmwareType.Universal,
      });

      expect(get).toHaveBeenCalledWith('/utility/v1/firmware/detail', {
        params: {
          deviceType,
          system: '1.0.0',
          bluetooth: '1.0.0',
          bootloader: '1.0.0',
          firmwareType: 'universal',
        },
      });
    },
  );
});

describe('ServiceHardware.cancel Pro2 operation', () => {
  const createCancelService = ({
    deviceType = EDeviceType.Pro2,
  }: {
    deviceType?: EDeviceType | null;
  } = {}) => {
    const sdkCancel = jest.fn();
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    service.getSDKInstance = jest.fn().mockResolvedValue({
      cancel: sdkCancel,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);
    service.getCompatibleConnectId = jest
      .fn()
      .mockResolvedValue('PRO2_BLE_CONNECT_ID');
    jest.mocked(localDb.getDeviceByQuery).mockResolvedValue(
      deviceType
        ? ({
            connectId: 'PRO2_SERIAL',
            deviceType,
          } as never)
        : undefined,
    );
    return { sdkCancel, service };
  };

  it('sends an explicit user Cancel immediately', async () => {
    const { sdkCancel, service } = createCancelService();

    const cancelPromise = service.cancel({
      connectId: 'PRO2_SERIAL',
      immediate: true,
    });

    clearTimeout(service.cancelTimer);
    await cancelPromise;

    expect(sdkCancel).toHaveBeenCalledTimes(1);
    expect(sdkCancel).toHaveBeenCalledWith('PRO2_BLE_CONNECT_ID');
  });

  it('sends Cancel for Neo as well', async () => {
    const { sdkCancel, service } = createCancelService({
      deviceType: EDeviceType.Neo,
    });

    await service.cancel({
      connectId: 'NEO_SERIAL',
      immediate: true,
    });

    expect(sdkCancel).toHaveBeenCalledTimes(1);
  });

  it('lets the SDK decide Cancel for Classic or Pro1', async () => {
    const { sdkCancel, service } = createCancelService({
      deviceType: EDeviceType.Classic,
    });

    await service.cancel({
      connectId: 'CLASSIC_SERIAL',
      immediate: true,
    });

    expect(sdkCancel).toHaveBeenCalledTimes(1);
  });

  it('lets the SDK decide Cancel when the device type is unknown', async () => {
    const { sdkCancel, service } = createCancelService({ deviceType: null });

    await service.cancel({
      connectId: 'UNKNOWN_SERIAL',
      immediate: true,
    });

    expect(sdkCancel).toHaveBeenCalledTimes(1);
  });

  it('still cancels when the caller supplies Unknown', async () => {
    const { sdkCancel, service } = createCancelService({
      deviceType: EDeviceType.Pro2,
    });

    await service.cancel({
      connectId: 'PRO2_SERIAL',
      immediate: true,
      deviceType: EDeviceType.Unknown,
    });

    expect(sdkCancel).toHaveBeenCalledTimes(1);
    expect(sdkCancel).toHaveBeenCalledWith('PRO2_BLE_CONNECT_ID');
  });

  it('keeps automatic cleanup cancellation debounced', async () => {
    const { sdkCancel, service } = createCancelService();

    await service.cancel({ connectId: 'PRO2_SERIAL' });
    clearTimeout(service.cancelTimer);

    expect(sdkCancel).not.toHaveBeenCalled();
  });
});
