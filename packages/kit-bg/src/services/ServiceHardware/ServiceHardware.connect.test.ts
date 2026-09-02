import {
  checkBLEPermissions,
  checkBLEState,
} from '@onekeyhq/shared/src/hardware/blePermissions';
import * as hardwareInstance from '@onekeyhq/shared/src/hardware/instance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import {
  EHardwareCallContext,
  EHardwareVendor,
} from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import simpleDb from '../../dbs/simple/simpleDb';
import { hardwareForceTransportAtom } from '../../states/jotai/atoms';

import { HardwareConnectionManager } from './HardwareConnectionManager';
import ServiceHardware from './ServiceHardware';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice, IDBWallet } from '../../dbs/local/types';
import type { ISimpleDBAppStatus } from '../../dbs/simple/entity/SimpleDbEntityAppStatus';
import type {
  Features,
  SearchDevice,
  UiResponseEvent,
} from '@onekeyfe/hd-core';

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
    SyncDeviceLabelToWalletName: 'SyncDeviceLabelToWalletName',
    UpdateWalletAvatarByDeviceSerialNo: 'UpdateWalletAvatarByDeviceSerialNo',
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
    isNative: false,
    isNativeAndroid: false,
    isSupportDesktopBle: false,
  },
}));

jest.mock('@onekeyhq/shared/src/hardware/blePermissions', () => ({
  checkBLEPermissions: jest.fn(),
  checkBLEState: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/hardware/instance', () => ({
  CoreSDKLoader: jest.fn(async () => ({})),
  getHardwareSDKInstance: jest.fn(),
  resetHardwareSDKInstance: jest.fn(),
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
    getAllDevices: jest.fn(),
    getAllWallets: jest.fn(),
    getDeviceByQuery: jest.fn(),
    updateDeviceConnectProtocol: jest.fn(),
  },
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    appStatus: {
      getRawData: jest.fn(),
      setRawData: jest.fn(),
    },
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  // The real enum: the service builds its skipped/dialog event sets at
  // module scope, so an empty stub collapses both into Set{undefined}
  // and every event-routing assertion below stops proving anything.
  EHardwareUiStateAction: jest.requireActual(
    '@onekeyhq/shared/types/hardwareUi',
  ).EHardwareUiStateAction,
  hardwareForceTransportAtom: {
    get: jest.fn(async () => ({ forceTransportType: undefined })),
  },
  hardwareUiStateAtom: {},
  hardwareUiStateCompletedAtom: {},
  settingsPersistAtom: {
    get: jest.fn(async () => ({})),
  },
}));

const mutablePlatformEnv = platformEnv as unknown as {
  isNative: boolean;
  isNativeAndroid: boolean;
  isSupportDesktopBle: boolean;
};
const mockedLocalDb = jest.mocked(localDb);
const mockedAppStatus = jest.mocked(simpleDb.appStatus);
const mockedCheckBLEPermissions = jest.mocked(checkBLEPermissions);
const mockedCheckBLEState = jest.mocked(checkBLEState);
const mockedHardwareForceTransportAtomGet = jest.mocked(
  hardwareForceTransportAtom.get,
);
let appStatusData: ISimpleDBAppStatus;

function buildDevice({
  features,
  connectProtocol,
  deviceType = 'pro',
}: {
  features?: Features;
  connectProtocol?: 'V1' | 'V2';
  deviceType?: 'pro' | 'pro2' | 'neo';
}) {
  return {
    connectId: 'USB_SERIAL',
    uuid: 'DEVICE_SERIAL',
    deviceId: 'DEVICE_ID',
    deviceType,
    name: 'OneKey Pro',
    commType: 'webusb',
    features,
    connectProtocol,
  } as unknown as SearchDevice;
}

describe('ServiceHardware.connect WebUSB reuse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HardwareConnectionManager.resetInstance();
    mutablePlatformEnv.isNative = false;
    mutablePlatformEnv.isNativeAndroid = false;
    mutablePlatformEnv.isSupportDesktopBle = false;
    mockedLocalDb.getAllDevices.mockResolvedValue({ devices: [] });
    mockedLocalDb.getAllWallets.mockResolvedValue({ wallets: [] });
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(undefined);
    mockedLocalDb.updateDeviceConnectProtocol.mockResolvedValue(undefined);
    appStatusData = {
      hardwareConnectProtocolMigrationVersion: 1,
    } as ISimpleDBAppStatus;
    mockedAppStatus.getRawData.mockImplementation(() =>
      Promise.resolve(appStatusData),
    );
    mockedAppStatus.setRawData.mockImplementation((dataOrBuilder) => {
      const nextValue =
        typeof dataOrBuilder === 'function'
          ? dataOrBuilder(appStatusData)
          : dataOrBuilder;
      return Promise.resolve(nextValue).then((value) => {
        appStatusData = value;
        return value;
      });
    });
    mockedCheckBLEPermissions.mockResolvedValue(true);
    mockedCheckBLEState.mockResolvedValue(true);
    mockedHardwareForceTransportAtomGet.mockResolvedValue({
      forceTransportType: undefined,
    });
  });

  it('Protocol V2 硬件调用边界不再固定等待', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    }) as unknown as {
      getKnownDeviceProtocol: jest.Mock;
      waitForLegacyHardwareCallBoundary(connectId: string): Promise<void>;
    };
    service.getKnownDeviceProtocol = jest.fn().mockResolvedValue('V2');
    const waitSpy = jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    await service.waitForLegacyHardwareCallBoundary('PRO2_USB');

    expect(waitSpy).not.toHaveBeenCalled();
    waitSpy.mockRestore();
  });

  it('Protocol V1 和未知协议保留硬件调用边界等待', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    }) as unknown as {
      getKnownDeviceProtocol: jest.Mock;
      waitForLegacyHardwareCallBoundary(connectId: string): Promise<void>;
    };
    service.getKnownDeviceProtocol = jest
      .fn()
      .mockResolvedValueOnce('V1')
      .mockResolvedValueOnce(undefined);
    const waitSpy = jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    await service.waitForLegacyHardwareCallBoundary('PRO_USB');
    await service.waitForLegacyHardwareCallBoundary('UNKNOWN_USB');

    expect(waitSpy).toHaveBeenNthCalledWith(1, 600);
    expect(waitSpy).toHaveBeenNthCalledWith(2, 600);
    waitSpy.mockRestore();
  });

  it('升级时仅迁移历史 OneKey 硬件设备的连接协议', async () => {
    appStatusData = {};
    mockedLocalDb.getAllWallets.mockResolvedValue({
      wallets: [
        {
          id: 'hw-wallet-legacy',
          type: 'hw',
          associatedDevice: 'legacy-onekey-device',
        } as IDBWallet,
        {
          id: 'hw-wallet-observed-v2',
          type: 'hw',
          associatedDevice: 'observed-v2-device',
        } as IDBWallet,
        {
          id: 'hw-wallet-prefilled',
          type: 'hw',
          associatedDevice: 'prefilled-device',
        } as IDBWallet,
        {
          id: 'qr-wallet',
          type: 'qr',
          associatedDevice: 'qr-device',
        } as IDBWallet,
        {
          id: 'hw-wallet-ledger',
          type: 'hw',
          associatedDevice: 'ledger-device',
        } as IDBWallet,
      ],
    });
    mockedLocalDb.getAllDevices.mockResolvedValue({
      devices: [
        {
          id: 'legacy-onekey-device',
          vendor: EHardwareVendor.onekey,
        } as IDBDevice,
        {
          id: 'observed-v2-device',
          vendor: EHardwareVendor.onekey,
          deviceStateInfo: { protocol: 'V2' },
        } as IDBDevice,
        {
          id: 'prefilled-device',
          vendor: EHardwareVendor.onekey,
          connectProtocol: 'V2',
        } as IDBDevice,
        {
          id: 'qr-device',
          vendor: EHardwareVendor.onekey,
        } as IDBDevice,
        {
          id: 'ledger-device',
          vendor: EHardwareVendor.ledger,
        } as IDBDevice,
      ],
    });
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });

    await service.migrateExistingDeviceConnectProtocols();

    expect(mockedLocalDb.updateDeviceConnectProtocol.mock.calls).toEqual([
      [
        {
          dbDeviceId: 'legacy-onekey-device',
          connectProtocol: 'V1',
        },
      ],
      [
        {
          dbDeviceId: 'observed-v2-device',
          connectProtocol: 'V2',
        },
      ],
    ]);
    expect(appStatusData).toMatchObject({
      hardwareConnectProtocolMigrationVersion: 1,
    });
  });

  it('连接协议迁移完成后不重复扫描数据库', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });

    await service.migrateExistingDeviceConnectProtocols();
    await service.migrateExistingDeviceConnectProtocols();

    expect(mockedLocalDb.getAllDevices.mock.calls).toHaveLength(0);
    expect(mockedLocalDb.getAllWallets.mock.calls).toHaveLength(0);
    expect(mockedLocalDb.updateDeviceConnectProtocol.mock.calls).toHaveLength(
      0,
    );
  });

  it('连接协议迁移失败时保留重试机会且不写完成标记', async () => {
    appStatusData = {};
    mockedLocalDb.getAllWallets.mockResolvedValue({
      wallets: [
        {
          id: 'hw-wallet-legacy',
          type: 'hw',
          associatedDevice: 'legacy-onekey-device',
        } as IDBWallet,
      ],
    });
    mockedLocalDb.getAllDevices.mockResolvedValue({
      devices: [
        {
          id: 'legacy-onekey-device',
          vendor: EHardwareVendor.onekey,
        } as IDBDevice,
      ],
    });
    mockedLocalDb.updateDeviceConnectProtocol.mockRejectedValueOnce(
      new Error('db write failed'),
    );
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });

    await expect(
      service.migrateExistingDeviceConnectProtocols(),
    ).rejects.toThrow('db write failed');
    expect(appStatusData).not.toMatchObject({
      hardwareConnectProtocolMigrationVersion: 1,
    });

    await expect(
      service.migrateExistingDeviceConnectProtocols(),
    ).resolves.toBeUndefined();
    expect(mockedLocalDb.updateDeviceConnectProtocol.mock.calls).toHaveLength(
      2,
    );
    expect(appStatusData).toMatchObject({
      hardwareConnectProtocolMigrationVersion: 1,
    });
  });

  it('复用首次 WebUSB 通讯结果，后续调用固定已探测协议', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    jest
      .spyOn(service, 'getCompatibleConnectId')
      .mockResolvedValue('USB_SERIAL');
    const connectDevice = jest
      .spyOn(service, 'connectDevice')
      .mockResolvedValue({ label: 'OneKey Pro' } as Features);
    const features = { label: 'OneKey Pro' } as Features;

    await expect(
      service.connect({
        device: buildDevice({ features, connectProtocol: 'V1' }),
      }),
    ).resolves.toBe(features);
    expect(connectDevice).not.toHaveBeenCalled();

    await service.connect({
      device: buildDevice({}),
    });
    expect(connectDevice).toHaveBeenCalledWith({
      connectId: 'USB_SERIAL',
      params: { connectProtocol: 'V1' },
    });
  });

  it('onboarding 复用 WebUSB 搜索结果后持久化已确认协议', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    jest
      .spyOn(service, 'getCompatibleConnectId')
      .mockResolvedValue('USB_SERIAL');
    const connectDevice = jest
      .spyOn(service, 'connectDevice')
      .mockResolvedValue({ label: 'OneKey Pro 2' } as Features);
    const features = { label: 'OneKey Pro 2' } as Features;

    await expect(
      service.connect({
        device: buildDevice({ features, connectProtocol: 'V2' }),
        forceProtocolDetection: true,
      }),
    ).resolves.toBe(features);
    expect(connectDevice).not.toHaveBeenCalled();
    expect(appStatusData.hardwareConnectProtocolByConnectId).toMatchObject({
      usb_serial: { protocol: 'V2' },
      device_serial: { protocol: 'V2' },
    });

    await service.connect({ device: buildDevice({}) });
    expect(connectDevice).toHaveBeenCalledWith({
      connectId: 'USB_SERIAL',
      params: { connectProtocol: 'V2' },
    });
  });

  it.each(['pro2', 'neo'] as const)(
    'force-refreshes %s after update instead of reusing WebUSB loader state',
    async (deviceType) => {
      const service = new ServiceHardware({
        backgroundApi: {} as IBackgroundApi,
      });
      jest
        .spyOn(service, 'getCompatibleConnectId')
        .mockResolvedValue('USB_SERIAL');
      const freshFeatures = {
        protocol: 'V2',
        deviceType,
        deviceId: 'FRESH_DEVICE_ID',
        bootloaderMode: false,
      } as unknown as Features;
      const connectDevice = jest
        .spyOn(service, 'connectDevice')
        .mockResolvedValue(freshFeatures);
      const cachedLoaderFeatures = {
        protocol: 'V2',
        deviceType,
        bootloaderMode: true,
      } as unknown as Features;

      await expect(
        service.connect({
          device: buildDevice({
            features: cachedLoaderFeatures,
            connectProtocol: 'V2',
            deviceType,
          }),
          forceFeaturesRefresh: true,
        }),
      ).resolves.toBe(freshFeatures);
      expect(connectDevice).toHaveBeenCalledWith({
        connectId: 'USB_SERIAL',
        params: { connectProtocol: 'V2' },
      });
    },
  );

  it('不再吞掉 WebUSB 重连错误并伪装成成功', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    jest
      .spyOn(service, 'getCompatibleConnectId')
      .mockResolvedValue('USB_SERIAL');
    jest
      .spyOn(service, 'connectDevice')
      .mockRejectedValue(new Error('WebUSB reconnect failed'));

    await expect(
      service.connect({ device: buildDevice({ connectProtocol: 'V1' }) }),
    ).rejects.toThrow('WebUSB reconnect failed');
  });

  it('桌面 BLE 搜索结果直接使用 Noble peripheral id，不替换成 USB 序列号', async () => {
    mutablePlatformEnv.isSupportDesktopBle = true;
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    const getCompatibleConnectId = jest
      .spyOn(service, 'getCompatibleConnectId')
      .mockResolvedValue('PRB50B0127B');
    const connectDevice = jest
      .spyOn(service, 'connectDevice')
      .mockResolvedValue({ label: 'OneKey Pro' } as Features);
    const blePeripheralId = '7d0dce8f968b0d819cd4ed8aab37f1e5';

    await service.connect({
      device: {
        connectId: blePeripheralId,
        uuid: blePeripheralId,
        deviceId: null,
        deviceType: 'pro',
        name: 'Pro 9B6B',
        commType: 'electron-ble',
      } as unknown as SearchDevice,
    });

    expect(getCompatibleConnectId).not.toHaveBeenCalled();
    expect(connectDevice).toHaveBeenCalledWith({
      connectId: blePeripheralId,
      params: {},
      hardwareTransportType: EHardwareTransportType.DesktopWebBle,
    });
  });

  it('桌面 BLE 候选即使携带 features 也必须真实连接验证', async () => {
    mutablePlatformEnv.isSupportDesktopBle = true;
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    const connectDevice = jest
      .spyOn(service, 'connectDevice')
      .mockResolvedValue({ deviceId: 'PRO2_DEVICE_ID' } as Features);
    const blePeripheralId = 'f7e440001d2c1c79509d55dfdc8201ff';

    await service.connect({
      device: {
        connectId: blePeripheralId,
        uuid: blePeripheralId,
        deviceId: null,
        deviceType: 'pro2',
        name: 'Pro 2 0088',
        commType: 'electron-ble',
        features: { deviceId: 'PRO2_DEVICE_ID' },
      } as SearchDevice,
      hardwareTransportType: EHardwareTransportType.DesktopWebBle,
    });

    expect(connectDevice).toHaveBeenCalledWith({
      connectId: blePeripheralId,
      params: {},
      hardwareTransportType: EHardwareTransportType.DesktopWebBle,
    });
  });

  it('onboarding 首次连接忽略搜索阶段的协议提示', async () => {
    mutablePlatformEnv.isSupportDesktopBle = true;
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    const connectDevice = jest
      .spyOn(service, 'connectDevice')
      .mockResolvedValue({ label: 'OneKey Pro' } as Features);
    const blePeripheralId = 'PRO_BLE_ID';

    await service.connect({
      device: {
        connectId: blePeripheralId,
        connectProtocol: 'V2',
        uuid: blePeripheralId,
        deviceId: null,
        deviceType: 'pro2',
        name: 'Pro 2',
        commType: 'electron-ble',
      } as SearchDevice,
      connectProtocol: 'V2',
      forceProtocolDetection: true,
    });

    expect(connectDevice).toHaveBeenCalledWith({
      connectId: blePeripheralId,
      params: { forceProtocolDetection: true },
      hardwareTransportType: EHardwareTransportType.DesktopWebBle,
    });
  });

  it('onboarding 首次连接自动探测协议，并在后续调用固定探测结果', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    const connectId = 'PRO_BLE_ID';
    const getDeviceState = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        protocol: 'V1',
        identity: { serialNo: 'PRO_SERIAL' },
      },
    });
    const getFeatures = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        label: 'OneKey Pro',
        protocol: 'V1',
      },
    });
    jest.spyOn(service, 'getSDKInstance').mockResolvedValue({
      getDeviceState,
      getFeatures,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);
    (
      service as unknown as {
        deviceProtocolByConnectId: Map<string, 'V1' | 'V2'>;
      }
    ).deviceProtocolByConnectId.set(connectId, 'V2');

    await service._getFeaturesLowLevel({
      connectId,
      params: { forceProtocolDetection: true },
    });

    expect(getDeviceState).toHaveBeenCalledWith(connectId, {
      forceProtocolDetection: true,
    });
    expect(getFeatures).toHaveBeenCalledWith(connectId, {
      connectProtocol: 'V1',
    });

    getDeviceState.mockClear();
    getFeatures.mockClear();
    await service._getFeaturesLowLevel({ connectId });

    expect(getDeviceState).not.toHaveBeenCalled();
    expect(getFeatures).toHaveBeenCalledWith(connectId, {
      connectProtocol: 'V1',
    });
  });

  it('后台 device-state probe 不持久化临时 transport', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    const connectId = 'PRO2_CONNECT_ID';
    const getDeviceState = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        identity: { deviceId: 'PRO2_DEVICE_ID' },
        protocol: 'V2',
        status: { unlocked: true },
      },
    });
    const getSDKInstance = jest
      .spyOn(service, 'getSDKInstance')
      .mockResolvedValue({
        getDeviceState,
      } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);
    (
      service as unknown as {
        deviceProtocolByConnectId: Map<string, 'V1' | 'V2'>;
      }
    ).deviceProtocolByConnectId.set(connectId, 'V2');

    await service._getDeviceStateLowLevel({
      connectId,
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
      hardwareTransportType: EHardwareTransportType.WEBUSB,
      persistTransportType: false,
      params: { scope: 'runtime' },
      silentMode: true,
    });

    expect(getSDKInstance).toHaveBeenCalledWith({
      connectId,
      connectProtocol: 'V2',
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
      hardwareTransportType: EHardwareTransportType.WEBUSB,
      persistTransportType: false,
    });
  });

  it.each([
    {
      platformName: 'iOS',
      isNativeAndroid: false,
      connectId: 'IOS_CBPERIPHERAL_UUID',
      storedBleConnectId: 'ios_cbperipheral_uuid',
      connectProtocol: 'V1' as const,
      deviceType: 'pro',
    },
    {
      platformName: 'Android',
      isNativeAndroid: true,
      connectId: 'AA:BB:CC:DD:EE:FF',
      storedBleConnectId: 'AA:BB:CC:DD:EE:FF',
      connectProtocol: 'V2' as const,
      deviceType: 'pro2',
    },
  ])(
    'keeps the current $platformName BLE connectId and forwards $connectProtocol',
    async ({
      isNativeAndroid,
      connectId,
      storedBleConnectId,
      connectProtocol,
      deviceType,
    }) => {
      mutablePlatformEnv.isNative = true;
      mutablePlatformEnv.isNativeAndroid = isNativeAndroid;
      mockedLocalDb.getDeviceByQuery.mockResolvedValue({
        id: 'db-device',
        connectId: 'USB_SERIAL',
        usbConnectId: 'USB_SERIAL',
        bleConnectId: storedBleConnectId,
        deviceId: 'DEVICE_ID',
        connectProtocol,
        vendor: EHardwareVendor.onekey,
        name: 'OneKey',
        features: '{}',
        settingsRaw: '{}',
        createdAt: 0,
        updatedAt: 0,
      } as IDBDevice);

      const service = new ServiceHardware({
        backgroundApi: {
          serviceSetting: {
            getHardwareTransportType: jest
              .fn()
              .mockResolvedValue(EHardwareTransportType.BLE),
          },
        } as unknown as IBackgroundApi,
      });
      const connectDevice = jest
        .spyOn(service, 'connectDevice')
        .mockResolvedValue({ label: 'OneKey' } as Features);

      await service.connect({
        device: {
          connectId,
          uuid: connectId,
          deviceId: 'DEVICE_ID',
          deviceType,
          name: 'OneKey',
          commType: 'ble',
          connectProtocol,
        } as unknown as SearchDevice,
        connectProtocol,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });

      expect(connectDevice).toHaveBeenCalledWith({
        connectId,
        params: { connectProtocol },
        hardwareTransportType: EHardwareTransportType.BLE,
      });
    },
  );

  it('uses the explicit Android USB transport without running stale BLE prechecks', async () => {
    mutablePlatformEnv.isNative = true;
    mutablePlatformEnv.isNativeAndroid = true;
    mockedCheckBLEPermissions.mockResolvedValue(false);

    const service = new ServiceHardware({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.BLE),
        },
      } as unknown as IBackgroundApi,
    });
    const connectDevice = jest
      .spyOn(service, 'connectDevice')
      .mockResolvedValue({ label: 'OneKey' } as Features);

    await expect(
      service.connect({
        device: buildDevice({ connectProtocol: 'V1' }),
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        hardwareTransportType: EHardwareTransportType.WEBUSB,
      }),
    ).resolves.toEqual({ label: 'OneKey' });

    expect(mockedCheckBLEPermissions).not.toHaveBeenCalled();
    expect(mockedCheckBLEState).not.toHaveBeenCalled();
    expect(connectDevice).toHaveBeenCalledWith({
      connectId: 'USB_SERIAL',
      params: { connectProtocol: 'V1' },
      hardwareTransportType: EHardwareTransportType.WEBUSB,
    });
  });

  it('按设备及 USB/BLE 端点隔离绑定已确认协议', async () => {
    const setDeviceConnectProtocol = jest.fn();
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    const internals = service as unknown as {
      activeHardwareSDKInstance: {
        setDeviceConnectProtocol: typeof setDeviceConnectProtocol;
      };
      rememberDeviceProtocol: (params: {
        connectIds: string[];
        protocol: 'V1' | 'V2';
      }) => Promise<void>;
    };
    internals.activeHardwareSDKInstance = { setDeviceConnectProtocol };

    await internals.rememberDeviceProtocol({
      connectIds: ['DEVICE_A_USB', 'DEVICE_A_BLE'],
      protocol: 'V2',
    });
    await internals.rememberDeviceProtocol({
      connectIds: ['DEVICE_B_USB', 'DEVICE_B_BLE'],
      protocol: 'V1',
    });

    expect(setDeviceConnectProtocol.mock.calls).toEqual([
      ['DEVICE_A_USB', 'V2'],
      ['DEVICE_A_BLE', 'V2'],
      ['DEVICE_B_USB', 'V1'],
      ['DEVICE_B_BLE', 'V1'],
    ]);
  });

  it('钱包设备记录创建前也持久化端点协议，并可由新服务实例恢复', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    const internals = service as unknown as {
      rememberDeviceProtocol: (params: {
        connectIds: string[];
        protocol: 'V1' | 'V2';
      }) => Promise<void>;
    };

    await internals.rememberDeviceProtocol({
      connectIds: ['DEVICE_USB', 'DEVICE_BLE'],
      protocol: 'V2',
    });

    expect(appStatusData.hardwareConnectProtocolByConnectId).toMatchObject({
      device_usb: { protocol: 'V2' },
      device_ble: { protocol: 'V2' },
    });

    const restoredService = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    const restoredInternals = restoredService as unknown as {
      getKnownDeviceProtocol: (
        connectId: string,
      ) => Promise<'V1' | 'V2' | undefined>;
    };
    await expect(
      restoredInternals.getKnownDeviceProtocol('DEVICE_BLE'),
    ).resolves.toBe('V2');
  });

  it('冷启动时从持久化恢复协议并绑定同一设备的 USB/BLE 端点', async () => {
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-device',
      connectId: 'DEVICE_USB',
      usbConnectId: 'DEVICE_USB',
      bleConnectId: 'DEVICE_BLE',
      deviceId: 'DEVICE_ID',
      connectProtocol: 'V2',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro 2',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice);
    const setDeviceConnectProtocol = jest.fn();
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    const internals = service as unknown as {
      getKnownDeviceProtocol: (connectId: string) => Promise<'V1' | 'V2'>;
      bindRememberedDeviceProtocols: (instance: {
        setDeviceConnectProtocol: typeof setDeviceConnectProtocol;
      }) => void;
    };

    await expect(internals.getKnownDeviceProtocol('DEVICE_USB')).resolves.toBe(
      'V2',
    );
    internals.bindRememberedDeviceProtocols({ setDeviceConnectProtocol });

    expect(setDeviceConnectProtocol).toHaveBeenCalledWith('DEVICE_USB', 'V2');
    expect(setDeviceConnectProtocol).toHaveBeenCalledWith('DEVICE_BLE', 'V2');
  });

  it('普通设备调用缺少数据库或缓存协议时拒绝初始化 SDK', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });

    await expect(
      service.getSDKInstance({ connectId: 'UNKNOWN_DEVICE' }),
    ).rejects.toThrow('Hardware connect protocol is unavailable');
  });

  it('桌面 BLE 初始化不执行 Bridge fallback', async () => {
    const checkBridgeStatus = jest
      .fn()
      .mockRejectedValue(new Error('Bridge is unavailable'));
    const switchTransport = jest.fn();
    const sdkInstance = { checkBridgeStatus, switchTransport };
    jest
      .mocked(hardwareInstance.getHardwareSDKInstance)
      .mockResolvedValue(sdkInstance as never);
    const service = new ServiceHardware({
      backgroundApi: {
        serviceDevSetting: {
          getFirmwareUpdateDevSettings: jest.fn().mockResolvedValue(false),
        },
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.DesktopWebBle),
          setHardwareTransportType: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });
    service.checkSdkVersionValid = jest.fn();
    service.registerSdkEvents = jest.fn();
    jest
      .spyOn(service.connectionManager, 'getCurrentTransportType')
      .mockResolvedValue(EHardwareTransportType.DesktopWebBle);
    jest
      .spyOn(service.connectionManager, 'setCurrentTransportType')
      .mockResolvedValue(undefined);

    await service.getSDKInstance({
      connectId: undefined,
      hardwareTransportType: EHardwareTransportType.DesktopWebBle,
    });

    expect(checkBridgeStatus).not.toHaveBeenCalled();
    expect(switchTransport).not.toHaveBeenCalled();
  });

  it('串行执行不同 transport 的 SDK 生命周期切换', async () => {
    let resolveFirstInstance: ((value: object) => void) | undefined;
    const firstInstancePromise = new Promise<object>((resolve) => {
      resolveFirstInstance = resolve;
    });
    const firstInstance = { name: 'webusb-sdk' };
    const secondInstance = { name: 'desktop-ble-sdk' };
    const getHardwareSDKInstance = jest.mocked(
      hardwareInstance.getHardwareSDKInstance,
    );
    getHardwareSDKInstance
      .mockReturnValueOnce(firstInstancePromise as never)
      .mockResolvedValueOnce(secondInstance as never);
    const service = new ServiceHardware({
      backgroundApi: {
        serviceDevSetting: {
          getFirmwareUpdateDevSettings: jest.fn().mockResolvedValue(false),
        },
      } as unknown as IBackgroundApi,
    });
    service.checkSdkVersionValid = jest.fn();
    service.registerSdkEvents = jest.fn();
    jest
      .spyOn(service.connectionManager, 'getCurrentTransportType')
      .mockResolvedValue(EHardwareTransportType.WEBUSB);
    jest
      .spyOn(service.connectionManager, 'setCurrentTransportType')
      .mockResolvedValue(undefined);

    const firstCall = service.getSDKInstance({
      connectId: undefined,
      hardwareTransportType: EHardwareTransportType.WEBUSB,
    });
    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve();
    }
    const secondCall = service.getSDKInstance({
      connectId: undefined,
      hardwareTransportType: EHardwareTransportType.DesktopWebBle,
    });
    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve();
    }

    expect(getHardwareSDKInstance).toHaveBeenCalledTimes(1);
    expect(hardwareInstance.resetHardwareSDKInstance).not.toHaveBeenCalled();

    resolveFirstInstance?.(firstInstance);
    await expect(firstCall).resolves.toBe(firstInstance);
    await expect(secondCall).resolves.toBe(secondInstance);

    expect(getHardwareSDKInstance).toHaveBeenCalledTimes(2);
    expect(hardwareInstance.resetHardwareSDKInstance).toHaveBeenCalledTimes(1);
  });

  it('手动 reset 等待正在初始化的 SDK 生命周期完成', async () => {
    let resolveInstance: ((value: object) => void) | undefined;
    const instancePromise = new Promise<object>((resolve) => {
      resolveInstance = resolve;
    });
    const sdkInstance = { name: 'initializing-sdk' };
    jest
      .mocked(hardwareInstance.getHardwareSDKInstance)
      .mockReturnValueOnce(instancePromise as never);
    const runExclusiveOneKeyOperation = jest.fn(
      async (operation: () => Promise<unknown>) => operation(),
    );
    const service = new ServiceHardware({
      backgroundApi: {
        serviceDevSetting: {
          getFirmwareUpdateDevSettings: jest.fn().mockResolvedValue(false),
        },
        serviceHardwareUI: {
          runExclusiveOneKeyOperation,
        },
      } as unknown as IBackgroundApi,
    });
    service.checkSdkVersionValid = jest.fn();
    service.registerSdkEvents = jest.fn();
    jest
      .spyOn(service.connectionManager, 'getCurrentTransportType')
      .mockResolvedValue(EHardwareTransportType.WEBUSB);
    jest
      .spyOn(service.connectionManager, 'setCurrentTransportType')
      .mockResolvedValue(undefined);

    const initialization = service.getSDKInstance({
      connectId: undefined,
      hardwareTransportType: EHardwareTransportType.WEBUSB,
    });
    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve();
    }
    const reset = service.resetHardwareSDK();
    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve();
    }

    expect(hardwareInstance.resetHardwareSDKInstance).not.toHaveBeenCalled();

    resolveInstance?.(sdkInstance);
    await expect(initialization).resolves.toBe(sdkInstance);
    await expect(reset).resolves.toBeUndefined();

    expect(runExclusiveOneKeyOperation).toHaveBeenCalledTimes(1);
    expect(hardwareInstance.resetHardwareSDKInstance).toHaveBeenCalledTimes(1);
  });

  it('显式 transport 不会绕过固件流程的 force transport 锁', async () => {
    mockedHardwareForceTransportAtomGet.mockResolvedValue({
      forceTransportType: EHardwareTransportType.WEBUSB,
    });
    const sdkInstance = { name: 'forced-webusb-sdk' };
    jest
      .mocked(hardwareInstance.getHardwareSDKInstance)
      .mockResolvedValue(sdkInstance as never);
    const service = new ServiceHardware({
      backgroundApi: {
        serviceDevSetting: {
          getFirmwareUpdateDevSettings: jest.fn().mockResolvedValue(false),
        },
      } as unknown as IBackgroundApi,
    });
    service.checkSdkVersionValid = jest.fn();
    service.registerSdkEvents = jest.fn();
    jest
      .spyOn(service.connectionManager, 'getCurrentTransportType')
      .mockResolvedValue(EHardwareTransportType.WEBUSB);
    const setCurrentTransportType = jest
      .spyOn(service.connectionManager, 'setCurrentTransportType')
      .mockResolvedValue(undefined);
    const internals = service as unknown as {
      activeHardwareTransportType: EHardwareTransportType;
    };
    internals.activeHardwareTransportType = EHardwareTransportType.WEBUSB;

    await expect(
      service.getSDKInstance({
        connectId: undefined,
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      }),
    ).resolves.toBe(sdkInstance);

    expect(hardwareInstance.getHardwareSDKInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        hardwareTransportType: EHardwareTransportType.WEBUSB,
      }),
    );
    expect(setCurrentTransportType).toHaveBeenCalledWith(
      EHardwareTransportType.WEBUSB,
    );
    expect(hardwareInstance.resetHardwareSDKInstance).not.toHaveBeenCalled();
  });

  it('桌面后台显式 transport 可跳过持久化用户偏好', async () => {
    mutablePlatformEnv.isSupportDesktopBle = true;
    mockedHardwareForceTransportAtomGet.mockResolvedValue({
      forceTransportType: EHardwareTransportType.DesktopWebBle,
    });
    const sdkInstance = { name: 'active-webusb-sdk' };
    jest
      .mocked(hardwareInstance.getHardwareSDKInstance)
      .mockResolvedValue(sdkInstance as never);
    const service = new ServiceHardware({
      backgroundApi: {
        serviceDevSetting: {
          getFirmwareUpdateDevSettings: jest.fn().mockResolvedValue(false),
        },
      } as unknown as IBackgroundApi,
    });
    service.checkSdkVersionValid = jest.fn();
    service.registerSdkEvents = jest.fn();
    jest
      .spyOn(service.connectionManager, 'getCurrentTransportType')
      .mockResolvedValue(EHardwareTransportType.WEBUSB);
    jest
      .spyOn(service.connectionManager, 'shouldSwitchTransportType')
      .mockResolvedValue({
        shouldSwitch: false,
        targetType: EHardwareTransportType.WEBUSB,
      });
    const setCurrentTransportType = jest
      .spyOn(service.connectionManager, 'setCurrentTransportType')
      .mockResolvedValue(undefined);
    const internals = service as unknown as {
      activeHardwareTransportType: EHardwareTransportType;
    };
    internals.activeHardwareTransportType = EHardwareTransportType.WEBUSB;

    await expect(
      service.getSDKInstance({
        connectId: undefined,
        hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
        hardwareTransportType: EHardwareTransportType.WEBUSB,
        persistTransportType: false,
      }),
    ).resolves.toBe(sdkInstance);

    expect(hardwareInstance.getHardwareSDKInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        hardwareTransportType: EHardwareTransportType.WEBUSB,
      }),
    );
    expect(setCurrentTransportType).not.toHaveBeenCalled();
    expect(hardwareInstance.resetHardwareSDKInstance).not.toHaveBeenCalled();
  });

  it('后台 transport 探测不会改写用户持久化设置', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    const getTransportTypeForChannel = jest
      .spyOn(service.connectionManager, 'getTransportTypeForChannel')
      .mockResolvedValue(EHardwareTransportType.WEBUSB);
    const shouldSwitchTransportType = jest
      .spyOn(service.connectionManager, 'shouldSwitchTransportType')
      .mockResolvedValue({
        shouldSwitch: true,
        targetType: EHardwareTransportType.DesktopWebBle,
      });
    const resolveTransportType = jest.spyOn(
      service.connectionManager,
      'resolveTransportType',
    );
    const setCurrentTransportType = jest.spyOn(
      service.connectionManager,
      'setCurrentTransportType',
    );

    await expect(
      service.prepareHardwareTransport({
        connectId: 'PRO2_CONNECT_ID',
        hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
        persistTransportType: false,
        requestedTransportType: 'usb',
      }),
    ).resolves.toBe(EHardwareTransportType.WEBUSB);
    await expect(
      service.prepareHardwareTransport({
        connectId: 'PRO2_CONNECT_ID',
        hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
        persistTransportType: false,
      }),
    ).resolves.toBe(EHardwareTransportType.DesktopWebBle);

    expect(getTransportTypeForChannel).toHaveBeenCalledWith({
      connectProtocol: undefined,
      transportType: 'usb',
    });
    expect(shouldSwitchTransportType).toHaveBeenCalledWith({
      connectId: 'PRO2_CONNECT_ID',
      connectProtocol: undefined,
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
    });
    expect(resolveTransportType).not.toHaveBeenCalled();
    expect(setCurrentTransportType).not.toHaveBeenCalled();
  });

  it('Passphrase 回包直接发送给当前 SDK，不重新执行传输选择', async () => {
    const uiResponse = jest.fn();
    const service = new ServiceHardware({
      backgroundApi: {} as IBackgroundApi,
    });
    const shouldSwitchTransportType = jest.spyOn(
      service.connectionManager,
      'shouldSwitchTransportType',
    );
    const internals = service as unknown as {
      activeHardwareSDKInstance: { uiResponse: typeof uiResponse };
      sendUiResponseToActiveSdk?: (response: UiResponseEvent) => Promise<void>;
    };
    internals.activeHardwareSDKInstance = { uiResponse };
    const response = {
      type: 'ui-receive_passphrase',
      payload: {
        value: 'hidden wallet',
        passphraseOnDevice: false,
        attachPinOnDevice: false,
        save: false,
      },
      interactionId: 'pro-ble-interaction',
      deviceId: 'pro-device',
    } as UiResponseEvent;

    expect(typeof internals.sendUiResponseToActiveSdk).toBe('function');
    await internals.sendUiResponseToActiveSdk?.(response);

    expect(uiResponse).toHaveBeenCalledWith(response);
    expect(shouldSwitchTransportType).not.toHaveBeenCalled();
  });
});
