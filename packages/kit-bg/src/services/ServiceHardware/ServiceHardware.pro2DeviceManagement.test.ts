/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { DEVICE, LOG_EVENT, UI_EVENT, UI_REQUEST } from '@onekeyfe/hd-core';
import { EDeviceType } from '@onekeyfe/hd-shared';

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
import { hardwareUiStateAtom } from '../../states/jotai/atoms';

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
    getDeviceByQuery: jest.fn(),
    updateDeviceState: jest.fn(),
  },
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    appStatus: {
      getRawData: jest.fn().mockResolvedValue({}),
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
    settingsPersistAtom: {},
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
  it('skips unavailable Pro2 firmware attestation', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    const getSDKInstanceSpy = jest.spyOn(service, 'getSDKInstance');

    await expect(
      service.firmwareAuthenticate({
        device: {
          connectId: 'PRO2_USB',
          deviceType: EDeviceType.Pro2,
        } as never,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        skipVerification: true,
        verified: false,
      }),
    );
    expect(getSDKInstanceSpy).not.toHaveBeenCalled();
  });

  it('does not require unavailable Pro2 attestation before wallet creation', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });

    await expect(
      service.shouldAuthenticateFirmware({
        device: {
          connectId: 'PRO2_USB',
          deviceId: 'PRO2_DEVICE_ID',
          deviceType: EDeviceType.Pro2,
        } as never,
      }),
    ).resolves.toBe(false);
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
    ).resolves.toEqual({ state: baseState });
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

  it('deprecates wallets immediately after a successful device wipe', async () => {
    const updateWalletsDeprecatedState = jest.fn().mockResolvedValue(true);
    const getWalletDevice = jest.fn().mockResolvedValue({
      id: 'db-device-1',
      connectId: 'PRO2_USB',
      deviceId: 'OLD_DEVICE_ID',
    });
    const service = new ServiceHardware({
      backgroundApi: {
        serviceAccount: {
          getWalletDevice,
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

    expect(getWalletDevice).toHaveBeenCalledWith({ walletId: 'hw-wallet-1' });
    expect(updateWalletsDeprecatedState).toHaveBeenCalledWith({
      willUpdateDeprecateMap: { 'hw-wallet-1': true },
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
    expect(hardwareLogSpy).toHaveBeenCalledWith('device state update', {
      changedKeys: ['identity.label'],
      revision: 2,
      source: 'apply-settings',
    });
    expect(JSON.stringify(hardwareLogSpy.mock.calls)).not.toContain(
      'PRO2_SERIAL',
    );
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
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    jest.mocked(appEventBus.emit).mockClear();
    await service.setDeviceLabel({
      walletId: 'wallet-1',
      label: 'Renamed Pro 2',
    });

    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    expect(appEventBus.emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      expect.anything(),
    );
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
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
