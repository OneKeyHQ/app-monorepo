import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { DeviceSessionPinType } from '@onekeyfe/hd-transport';
import axios from 'axios';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  checkBLEPermissions,
  checkBLEState,
} from '@onekeyhq/shared/src/hardware/blePermissions';
import {
  getHardwareSDKInstance,
  resetHardwareSDKInstance,
} from '@onekeyhq/shared/src/hardware/instance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import {
  EHardwareCallContext,
  EHardwareVendor,
} from '@onekeyhq/shared/types/device';
import type { IOneKeyDeviceFeaturesWithAppParams } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import { hardwareForceTransportAtom } from '../../states/jotai/atoms';
import { hardwareForceTransportAtom as desktopHardwareForceTransportAtom } from '../../states/jotai/atoms/desktopBluetooth';
import { getFirmwareManifestSnapshot } from '../ServiceFirmwareUpdate/FirmwareManifestProvider';

import { HardwareConnectionManager } from './HardwareConnectionManager';
import ServiceHardware from './ServiceHardware';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice } from '../../dbs/local/types';
import type { RemoteConfigResponse, SearchDevice } from '@onekeyfe/hd-core';

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
    RequestHardwareUIDialog: 'RequestHardwareUIDialog',
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
    isSupportDesktopBle: true,
    isNative: false,
    isNativeAndroid: false,
  },
}));

jest.mock('@onekeyhq/shared/src/hardware/blePermissions', () => ({
  checkBLEPermissions: jest.fn(),
  checkBLEState: jest.fn(),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/hardware/instance', () => ({
  CoreSDKLoader: jest.fn(),
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
    getDeviceByQuery: jest.fn(),
    updateDeviceConnectId: jest.fn(),
    updateDeviceBleConnectIdAndCleanStaleAliases: jest.fn(),
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

jest.mock('../../states/jotai/atoms', () => ({
  EHardwareUiStateAction: {
    BLUETOOTH_PERMISSION: 'ui-bluetooth_permission',
    LOCATION_PERMISSION: 'ui-location_permission',
    LOCATION_SERVICE_PERMISSION: 'ui-location_service_permission',
  },
  hardwareForceTransportAtom: {
    get: jest.fn(async () => ({ forceTransportType: undefined })),
  },
  hardwareUiStateAtom: {},
  hardwareUiStateCompletedAtom: {},
  settingsPersistAtom: {
    get: jest.fn(async () => ({ hardwareConnectSrc: undefined })),
  },
}));

jest.mock('../ServiceFirmwareUpdate/FirmwareManifestProvider', () => ({
  getFirmwareManifestSnapshot: jest.fn(),
}));

jest.mock('../../states/jotai/atoms/desktopBluetooth', () => ({
  desktopBluetoothAtom: {
    get: jest.fn(async () => ({ isRequestedPermission: true })),
    set: jest.fn(),
  },
  hardwareForceTransportAtom: {
    get: jest.fn(async () => ({ forceTransportType: undefined })),
    set: jest.fn(),
  },
}));

const mockedLocalDb = jest.mocked(localDb);
const mockedCheckBLEPermissions = jest.mocked(checkBLEPermissions);
const mockedCheckBLEState = jest.mocked(checkBLEState);
const mockedAxios = jest.mocked(axios);
const mockedAppEventBus = jest.mocked(appEventBus);
const mockedGetFirmwareManifestSnapshot = jest.mocked(
  getFirmwareManifestSnapshot,
);
const mockedGetHardwareSDKInstance = jest.mocked(getHardwareSDKInstance);
const mockedResetHardwareSDKInstance = jest.mocked(resetHardwareSDKInstance);
const mutablePlatformEnv = platformEnv as unknown as {
  isDesktop: boolean;
  isJest: boolean;
  isSupportDesktopBle: boolean;
  isNative: boolean;
  isNativeAndroid: boolean;
};

describe('ServiceHardware.getCompatibleConnectId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HardwareConnectionManager.resetInstance();
    Object.assign(mutablePlatformEnv, {
      isDesktop: true,
      isJest: true,
      isSupportDesktopBle: true,
      isNative: false,
      isNativeAndroid: false,
    });
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(undefined);
    mockedLocalDb.updateDeviceBleConnectIdAndCleanStaleAliases.mockResolvedValue(
      { cleanedRecordIds: [] },
    );
    mockedCheckBLEPermissions.mockResolvedValue(true);
    mockedCheckBLEState.mockResolvedValue(true);
    mockedAxios.post.mockReset();
    jest.mocked(hardwareForceTransportAtom.get).mockResolvedValue({
      forceTransportType: undefined,
    });
    jest.mocked(desktopHardwareForceTransportAtom.get).mockResolvedValue({
      forceTransportType: undefined,
    });
  });

  it.each([
    {
      platformName: 'iOS',
      isNativeAndroid: false,
      bleConnectId: 'F7E44000-1D2C-1C79-509D-55DFDC8201FF',
    },
    {
      platformName: 'Android',
      isNativeAndroid: true,
      bleConnectId: 'AA:BB:CC:DD:EE:FF',
    },
  ])(
    'uses the bound BLE connectId on $platformName',
    async ({ isNativeAndroid, bleConnectId }) => {
      Object.assign(mutablePlatformEnv, {
        isDesktop: false,
        isSupportDesktopBle: false,
        isNative: true,
        isNativeAndroid,
      });
      const dbDevice = {
        id: 'db-pro2-device',
        connectId: 'PRB09B0088A',
        usbConnectId: 'PRB09B0088A',
        bleConnectId,
        deviceId: 'PRO2_DEVICE_ID',
        vendor: EHardwareVendor.onekey,
        name: 'OneKey Pro 2',
        features: '{}',
        settingsRaw: '{}',
        createdAt: 0,
        updatedAt: 0,
      } as IDBDevice;
      // The stale featuresDeviceId matches no record, so the
      // identity-qualified lookup misses and the connectId-only
      // fallback must still resolve the record.
      mockedLocalDb.getDeviceByQuery.mockImplementation(async (query) =>
        query.featuresDeviceId && query.featuresDeviceId !== dbDevice.deviceId
          ? undefined
          : dbDevice,
      );

      await expect(
        new ServiceHardware({
          backgroundApi: {
            serviceSetting: {
              getHardwareTransportType: jest
                .fn()
                .mockResolvedValue(EHardwareTransportType.BLE),
            },
          } as unknown as IBackgroundApi,
        }).getCompatibleConnectId({
          connectId: 'PRB09B0088A',
          featuresDeviceId: 'STALE_DEVICE_ID',
          hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        }),
      ).resolves.toBe(bleConnectId);

      expect(mockedLocalDb.getDeviceByQuery.mock.calls).toEqual([
        [{ connectId: 'PRB09B0088A', featuresDeviceId: 'STALE_DEVICE_ID' }],
        [{ connectId: 'PRB09B0088A' }],
      ]);
    },
  );

  it('uses the bound Noble peripheral ID before stale device info on desktop', async () => {
    const bleConnectId = 'f7e440001d2c1c79509d55dfdc8201ff';
    const dbDevice = {
      id: 'db-pro2-device',
      connectId: 'PRB09B0088A',
      usbConnectId: 'PRB09B0088A',
      bleConnectId,
      deviceId: 'PRO2_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro 2',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    // Stale identity must not veto the connectId match: the
    // identity-qualified lookup misses, the connectId-only fallback hits.
    mockedLocalDb.getDeviceByQuery.mockImplementation(async (query) =>
      query.featuresDeviceId && query.featuresDeviceId !== dbDevice.deviceId
        ? undefined
        : dbDevice,
    );

    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    service.connectionManager.shouldSwitchTransportType = Object.assign(
      jest.fn().mockResolvedValue({
        shouldSwitch: true,
        targetType: EHardwareTransportType.DesktopWebBle,
      }),
      {
        clear: jest.fn(),
        delete: jest.fn(),
      },
    ) as typeof service.connectionManager.shouldSwitchTransportType;

    await expect(
      service.getCompatibleConnectId({
        connectId: 'PRB09B0088A',
        featuresDeviceId: 'STALE_DEVICE_ID',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toBe(bleConnectId);

    // Later protocol lookups may re-query by the record's own connectId;
    // only the resolution order of the leading lookups matters here.
    expect(mockedLocalDb.getDeviceByQuery.mock.calls.slice(0, 2)).toEqual([
      [{ connectId: 'PRB09B0088A', featuresDeviceId: 'STALE_DEVICE_ID' }],
      [{ connectId: 'PRB09B0088A' }],
    ]);
  });

  it('prefers the identity-matched record when a stale wipe leftover shares the connectId', async () => {
    const liveBleConnectId = '714d4c59ef4af3df00d92885755c4a58';
    const staleDevice = {
      id: 'db-stale-pre-wipe',
      connectId: 'PRB09B0058A',
      usbConnectId: 'PRB09B0058A',
      bleConnectId: undefined,
      deviceId: 'PRE_WIPE_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    const liveDevice = {
      id: 'db-live-device',
      connectId: 'PRB09B0058A',
      usbConnectId: 'PRB09B0058A',
      bleConnectId: liveBleConnectId,
      deviceId: 'POST_WIPE_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    // Store order is arbitrary: connectId-only lookups resolve the stale
    // pre-wipe record (no bleConnectId), which used to re-open the pairing
    // dialog on every call while repairs kept writing to the live record.
    mockedLocalDb.getDeviceByQuery.mockImplementation(async (query) => {
      if (query.featuresDeviceId) {
        return query.featuresDeviceId === liveDevice.deviceId &&
          (!query.connectId || query.connectId === liveDevice.connectId)
          ? liveDevice
          : undefined;
      }
      return query.connectId === staleDevice.connectId
        ? staleDevice
        : undefined;
    });
    const showBluetoothDevicePairingDialog = jest.fn();

    const service = new ServiceHardware({
      backgroundApi: {
        serviceHardwareUI: { showBluetoothDevicePairingDialog },
        serviceSetting: { setHardwareTransportType: jest.fn() },
      } as unknown as IBackgroundApi,
    });
    service.connectionManager.shouldSwitchTransportType = Object.assign(
      jest.fn().mockResolvedValue({
        shouldSwitch: true,
        targetType: EHardwareTransportType.DesktopWebBle,
      }),
      {
        clear: jest.fn(),
        delete: jest.fn(),
      },
    ) as typeof service.connectionManager.shouldSwitchTransportType;

    await expect(
      service.getCompatibleConnectId({
        connectId: 'PRB09B0058A',
        featuresDeviceId: 'POST_WIPE_DEVICE_ID',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toBe(liveBleConnectId);

    expect(mockedLocalDb.getDeviceByQuery.mock.calls[0]).toEqual([
      { connectId: 'PRB09B0058A', featuresDeviceId: 'POST_WIPE_DEVICE_ID' },
    ]);
    expect(showBluetoothDevicePairingDialog).not.toHaveBeenCalled();
  });

  it('de-aliases stale siblings after a verified pairing repair', async () => {
    const liveBleConnectId = '714d4c59ef4af3df00d92885755c4a58';
    const liveDevice = {
      id: 'db-live-device',
      connectId: 'PRB09B0058A',
      usbConnectId: 'PRB09B0058A',
      bleConnectId: undefined,
      deviceId: 'POST_WIPE_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(liveDevice);

    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    jest.spyOn(service, 'searchDevices').mockResolvedValue({
      success: true,
      payload: [
        {
          connectId: liveBleConnectId,
          name: 'Pro 76D1',
          commType: 'electron-ble',
        },
      ],
    } as never);
    jest
      .spyOn(service, 'connect')
      .mockResolvedValue({ deviceId: 'POST_WIPE_DEVICE_ID' } as never);

    await expect(
      service.repairBleConnectIdWithProgress({
        connectId: 'PRB09B0058A',
        featuresDeviceId: 'POST_WIPE_DEVICE_ID',
        features: {
          ble_name: 'Pro 76D1',
        } as unknown as IOneKeyDeviceFeaturesWithAppParams,
      }),
    ).resolves.toBe(liveBleConnectId);

    // The verified repair persists the binding and retires the pre-wipe
    // sibling's aliases atomically so the next connectId-only lookup cannot
    // fall back to the stale record, and a failed cleanup rolls back the
    // binding so the repair stays retryable.
    expect(
      mockedLocalDb.updateDeviceBleConnectIdAndCleanStaleAliases.mock.calls,
    ).toEqual([
      [
        {
          dbDeviceId: liveDevice.id,
          bleConnectId: liveBleConnectId,
          verifiedDeviceId: 'POST_WIPE_DEVICE_ID',
        },
      ],
    ]);
    expect(mockedLocalDb.updateDeviceConnectId.mock.calls).toHaveLength(0);
  });

  it('repairs to the live-identity record when the dialog carries a stale expected id', async () => {
    const liveBleConnectId = '714d4c59ef4af3df00d92885755c4a58';
    const staleDevice = {
      id: 'db-stale-pre-wipe',
      connectId: 'PRB09B0058A',
      usbConnectId: 'PRB09B0058A',
      bleConnectId: undefined,
      deviceId: 'PRE_WIPE_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    const liveDevice = {
      id: 'db-live-device',
      connectId: 'PRB09B0058A',
      usbConnectId: 'PRB09B0058A',
      bleConnectId: liveBleConnectId,
      deviceId: 'POST_WIPE_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    // A connectId-only caller resolves the stale pre-wipe record, so the
    // pairing dialog derives its expected id from that record's frozen
    // features. Only the identity read over the live connection can route
    // the binding (and the stale-alias cleanup) to the live record.
    mockedLocalDb.getDeviceByQuery.mockImplementation(async (query) => {
      if (query.featuresDeviceId === liveDevice.deviceId) {
        return liveDevice;
      }
      if (query.featuresDeviceId === staleDevice.deviceId) {
        return staleDevice;
      }
      return undefined;
    });

    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    jest.spyOn(service, 'searchDevices').mockResolvedValue({
      success: true,
      payload: [
        {
          connectId: liveBleConnectId,
          name: 'Pro 76D1',
          commType: 'electron-ble',
        },
      ],
    } as never);
    jest
      .spyOn(service, 'connect')
      .mockResolvedValue({ deviceId: 'POST_WIPE_DEVICE_ID' } as never);

    await expect(
      service.repairBleConnectIdWithProgress({
        connectId: 'PRB09B0058A',
        featuresDeviceId: 'PRE_WIPE_DEVICE_ID',
        features: {
          ble_name: 'Pro 76D1',
        } as unknown as IOneKeyDeviceFeaturesWithAppParams,
      }),
    ).resolves.toBe(liveBleConnectId);

    expect(
      mockedLocalDb.updateDeviceBleConnectIdAndCleanStaleAliases.mock.calls,
    ).toEqual([
      [
        {
          dbDeviceId: liveDevice.id,
          bleConnectId: liveBleConnectId,
          verifiedDeviceId: 'POST_WIPE_DEVICE_ID',
        },
      ],
    ]);
  });

  it('keeps failing closed when no record matches the live identity', async () => {
    const liveBleConnectId = '714d4c59ef4af3df00d92885755c4a58';
    // Device was wiped but not yet re-onboarded: no record carries the
    // post-wipe identity, so the repair must not bind or clean anything.
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(undefined);

    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    jest.spyOn(service, 'searchDevices').mockResolvedValue({
      success: true,
      payload: [
        {
          connectId: liveBleConnectId,
          name: 'Pro 76D1',
          commType: 'electron-ble',
        },
      ],
    } as never);
    jest
      .spyOn(service, 'connect')
      .mockResolvedValue({ deviceId: 'POST_WIPE_DEVICE_ID' } as never);
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await expect(
        service.repairBleConnectIdWithProgress({
          connectId: 'PRB09B0058A',
          featuresDeviceId: 'PRE_WIPE_DEVICE_ID',
          features: {
            ble_name: 'Pro 76D1',
          } as unknown as IOneKeyDeviceFeaturesWithAppParams,
        }),
      ).rejects.toThrow();
    } finally {
      consoleError.mockRestore();
    }

    expect(
      mockedLocalDb.updateDeviceBleConnectIdAndCleanStaleAliases.mock.calls,
    ).toHaveLength(0);
  });

  it('falls back to the persisted USB connectId for an offline background task', async () => {
    const dbDevice = {
      id: 'db-pro2-device',
      connectId: 'PRB09B0088A',
      usbConnectId: 'PRB09B0088A',
      bleConnectId: undefined,
      deviceId: 'PRO2_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro 2',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(dbDevice);

    const service = new ServiceHardware({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.DesktopWebBle),
        },
      } as unknown as IBackgroundApi,
    });

    await expect(
      service.getCompatibleConnectId({
        connectId: dbDevice.connectId,
        featuresDeviceId: dbDevice.deviceId,
        hardwareCallContext: EHardwareCallContext.BACKGROUND_TASK,
      }),
    ).resolves.toBe(dbDevice.connectId);
  });

  it('keeps an explicitly pinned USB transport and endpoint together in a background call', async () => {
    const dbDevice = {
      id: 'db-pro2-device',
      connectId: 'PRO2_USB_ID',
      usbConnectId: 'PRO2_USB_ID',
      bleConnectId: 'PRO2_BLE_ID',
      deviceId: 'PRO2_DEVICE_ID',
      connectProtocol: 'V2',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro 2',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(dbDevice);
    const service = new ServiceHardware({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.DesktopWebBle),
        },
      } as unknown as IBackgroundApi,
    });

    await expect(
      service.getCompatibleConnectId({
        connectId: dbDevice.connectId,
        hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
        hardwareTransportType: EHardwareTransportType.WEBUSB,
      }),
    ).resolves.toBe(dbDevice.usbConnectId);
  });

  it('uses the persisted USB setting instead of stale BLE runtime state for a desktop background task', async () => {
    const service = new ServiceHardware({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.WEBUSB),
          setHardwareTransportType: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });
    await service.connectionManager.setCurrentTransportType(
      EHardwareTransportType.DesktopWebBle,
    );
    const detectUSBDeviceAvailability = jest.spyOn(
      service.connectionManager,
      'detectUSBDeviceAvailability',
    );
    const detectBluetoothAvailability = jest.spyOn(
      service.connectionManager,
      'detectBluetoothAvailability',
    );

    await expect(
      service.connectionManager.shouldSwitchTransportType({
        connectId: 'USB_ID',
        hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
      }),
    ).resolves.toEqual({
      shouldSwitch: false,
      targetType: EHardwareTransportType.WEBUSB,
    });
    expect(detectUSBDeviceAvailability).not.toHaveBeenCalled();
    expect(detectBluetoothAvailability).not.toHaveBeenCalled();
  });

  it('keeps the USB fallback reachable for a desktop background device read', async () => {
    const service = new ServiceHardware({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.DesktopWebBle),
        },
      } as unknown as IBackgroundApi,
    });
    const getCompatibleConnectId = jest
      .spyOn(service, 'getCompatibleConnectId')
      .mockResolvedValue('USB_ID');
    const getDeviceStateWithMutex = jest
      .spyOn(
        service as unknown as {
          _getDeviceStateWithMutex: ServiceHardware['getDeviceState'];
        },
        '_getDeviceStateWithMutex',
      )
      .mockResolvedValue({
        identity: { deviceId: 'DEVICE_ID' },
        protocol: 'V2',
      } as never);

    await expect(
      service.getDeviceState({
        connectId: 'USB_ID',
        hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
      }),
    ).resolves.toEqual(expect.objectContaining({ protocol: 'V2' }));
    expect(getCompatibleConnectId).toHaveBeenCalledWith({
      connectId: 'USB_ID',
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
      hardwareTransportType: undefined,
    });
    expect(getDeviceStateWithMutex).toHaveBeenCalledWith(
      expect.objectContaining({ connectId: 'USB_ID' }),
    );
  });

  it('allows only the scoped connected-only desktop BLE background call', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    const getCompatibleConnectId = jest
      .spyOn(service, 'getCompatibleConnectId')
      .mockResolvedValue('PRO2_BLE_ID');
    const getDeviceStateWithMutex = jest
      .spyOn(
        service as unknown as {
          _getDeviceStateWithMutex: ServiceHardware['getDeviceState'];
        },
        '_getDeviceStateWithMutex',
      )
      .mockResolvedValue({
        identity: { deviceId: 'PRO2_DEVICE_ID' },
        protocol: 'V2',
      } as never);

    await expect(
      service.getDeviceState({
        connectId: 'PRO2_BLE_ID',
        desktopBleReuseConnectedOnly: true,
        hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      }),
    ).resolves.toEqual(expect.objectContaining({ protocol: 'V2' }));

    expect(getCompatibleConnectId).toHaveBeenCalledWith({
      connectId: 'PRO2_BLE_ID',
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
      hardwareTransportType: EHardwareTransportType.DesktopWebBle,
    });
    expect(getDeviceStateWithMutex).toHaveBeenCalledWith(
      expect.objectContaining({
        connectId: 'PRO2_BLE_ID',
        desktopBleReuseConnectedOnly: true,
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      }),
    );
  });

  it('guards the desktop BLE state read without passing unsupported SDK params', async () => {
    const originalDesktopApi = globalThis.desktopApi;
    const beginConnectedOnlyScope = jest.fn().mockReturnValue(1);
    const endConnectedOnlyScope = jest.fn();
    globalThis.desktopApi = {
      nobleBle: {
        beginConnectedOnlyScope,
        endConnectedOnlyScope,
      },
    } as never;
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    const getDeviceState = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        identity: { deviceId: 'PRO2_DEVICE_ID', serialNo: 'PRO2_SERIAL' },
        protocol: 'V2',
      },
    });
    service.getSDKInstance = jest.fn().mockResolvedValue({
      getDeviceState,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);
    jest
      .spyOn(
        service as unknown as {
          rememberDeviceProtocol: () => Promise<void>;
        },
        'rememberDeviceProtocol',
      )
      .mockResolvedValue(undefined);

    try {
      await expect(
        service._getDeviceStateLowLevel({
          connectId: 'PRO2_BLE_ID',
          desktopBleReuseConnectedOnly: true,
          hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
          hardwareTransportType: EHardwareTransportType.DesktopWebBle,
          params: { connectProtocol: 'V2' },
        }),
      ).resolves.toEqual(expect.objectContaining({ protocol: 'V2' }));
      expect(beginConnectedOnlyScope).toHaveBeenCalledWith('PRO2_BLE_ID');
      expect(getDeviceState).toHaveBeenCalledWith('PRO2_BLE_ID', {
        connectProtocol: 'V2',
      });
      expect(endConnectedOnlyScope).toHaveBeenCalledWith('PRO2_BLE_ID', 1);
    } finally {
      globalThis.desktopApi = originalDesktopApi;
    }
  });

  it('uses the USB connectId for desktop firmware preflight', async () => {
    const dbDevice = {
      id: 'db-pro2-device',
      connectId: 'PRB09B0088A',
      usbConnectId: 'PRB09B0088A',
      bleConnectId: 'f7e440001d2c1c79509d55dfdc8201ff',
      deviceId: 'PRO2_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro 2',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(dbDevice);
    const withHardwareProcessing = jest.fn(
      async (callback: () => Promise<unknown>) => callback(),
    );
    const service = new ServiceHardware({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.DesktopWebBle),
          setHardwareTransportType: jest.fn(),
        },
        serviceHardwareUI: { withHardwareProcessing },
      } as unknown as IBackgroundApi,
    });
    const getFeaturesWithoutCache = jest
      .spyOn(service, 'getFeaturesWithoutCache')
      .mockResolvedValue({ success: true } as any);

    await expect(
      service.checkDeviceReachableForFirmwareUpdate({
        connectId: dbDevice.usbConnectId as string,
      }),
    ).resolves.toBe(dbDevice.usbConnectId);
    expect(getFeaturesWithoutCache).toHaveBeenCalledWith({
      connectId: dbDevice.usbConnectId,
      params: {
        retryCount: 1,
        forceProtocolDetection: false,
      },
      hardwareTransportType: EHardwareTransportType.WEBUSB,
    });
  });

  it.each([
    ['missing', undefined],
    ['USB-aliasing', 'PRB09B0088A'],
  ])(
    'pairs a %s BLE connectId instead of passing the USB serial to Noble',
    async (_caseName, storedBleConnectId) => {
      const bleConnectId = 'f7e440001d2c1c79509d55dfdc8201ff';
      const dbDevice = {
        id: 'db-pro2-device',
        connectId: 'PRB09B0088A',
        usbConnectId: 'PRB09B0088A',
        bleConnectId: storedBleConnectId,
        deviceId: 'PRO2_DEVICE_ID',
        vendor: EHardwareVendor.onekey,
        name: 'OneKey Pro 2',
        features: '{}',
        settingsRaw: '{}',
        createdAt: 0,
        updatedAt: 0,
      } as IDBDevice;
      mockedLocalDb.getDeviceByQuery.mockResolvedValue(dbDevice);
      jest.mocked(hardwareForceTransportAtom.get).mockResolvedValue({
        forceTransportType: EHardwareTransportType.DesktopWebBle,
      });

      const showBluetoothDevicePairingDialog = jest.fn();
      const setHardwareTransportType = jest.fn();
      const createCallback = jest.fn(
        ({ resolve }: { resolve: (value: string) => void }) => {
          resolve(bleConnectId);
          return 'ble-pairing-promise';
        },
      );
      const service = new ServiceHardware({
        backgroundApi: {
          servicePromise: { createCallback },
          serviceHardwareUI: { showBluetoothDevicePairingDialog },
          serviceSetting: { setHardwareTransportType },
        } as unknown as IBackgroundApi,
      });
      service.connectionManager.shouldSwitchTransportType = Object.assign(
        jest.fn().mockResolvedValue({
          shouldSwitch: false,
          targetType: EHardwareTransportType.DesktopWebBle,
        }),
        {
          clear: jest.fn(),
          delete: jest.fn(),
        },
      ) as typeof service.connectionManager.shouldSwitchTransportType;

      await expect(
        service.getCompatibleConnectId({
          connectId: 'PRB09B0088A',
          featuresDeviceId: dbDevice.deviceId,
          hardwareCallContext: EHardwareCallContext.UPDATE_FIRMWARE,
        }),
      ).resolves.toBe(bleConnectId);

      expect(setHardwareTransportType).toHaveBeenCalledWith(
        EHardwareTransportType.DesktopWebBle,
      );

      expect(showBluetoothDevicePairingDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          device: dbDevice,
          usbConnectId: 'PRB09B0088A',
          promiseId: 'ble-pairing-promise',
        }),
      );
    },
  );

  it('binds a live BLE connectId silently instead of showing the pairing dialog', async () => {
    const liveBleConnectId = '714d4c59ef4af3df00d92885755c4a58';
    const dbDevice = {
      id: 'db-pro2-device',
      connectId: 'PRB09B0088A',
      usbConnectId: 'PRB09B0088A',
      bleConnectId: undefined,
      deviceId: 'PRO2_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro 2',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    // The live BLE connectId matches no record; the featuresDeviceId
    // fallback resolves the USB-created record without a BLE binding.
    mockedLocalDb.getDeviceByQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(dbDevice);
    const showBluetoothDevicePairingDialog = jest.fn();
    const service = new ServiceHardware({
      backgroundApi: {
        serviceHardwareUI: { showBluetoothDevicePairingDialog },
        serviceSetting: { setHardwareTransportType: jest.fn() },
      } as unknown as IBackgroundApi,
    });
    service.connectionManager.shouldSwitchTransportType = Object.assign(
      jest.fn().mockResolvedValue({
        shouldSwitch: false,
        targetType: EHardwareTransportType.DesktopWebBle,
      }),
      {
        clear: jest.fn(),
        delete: jest.fn(),
      },
    ) as typeof service.connectionManager.shouldSwitchTransportType;
    // V2 state projections expose only the raw device_id field (no
    // SDK-normalized deviceId) — the identity check must handle that shape.
    const getFeaturesSpy = jest
      .spyOn(service, 'getFeaturesWithoutCache')
      .mockResolvedValue({ device_id: 'PRO2_DEVICE_ID' } as any);
    jest
      .spyOn(
        service as unknown as {
          getKnownDeviceProtocol: (
            connectId?: string,
          ) => Promise<'V1' | 'V2' | undefined>;
        },
        'getKnownDeviceProtocol',
      )
      .mockResolvedValue('V1');
    // Live traffic was just observed on this connectId (paired by evidence).
    service.recordLiveConnectIdEvidence(liveBleConnectId);

    await expect(
      service.getCompatibleConnectId({
        connectId: liveBleConnectId,
        featuresDeviceId: dbDevice.deviceId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toBe(liveBleConnectId);

    // silentMode must be set: a failed probe would otherwise emit the
    // global DeviceNotFound error dialog from the error constructor.
    // The probe must pin the remembered protocol instead of forcing
    // re-detection — a V2 Ping into an active V1 session can go unanswered
    // (SDK error 713) and would spuriously fall back to the pairing dialog.
    expect(getFeaturesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        connectId: liveBleConnectId,
        silentMode: true,
        hardwareCallContext:
          EHardwareCallContext.USER_INTERACTION_NO_BLE_DIALOG,
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
        params: expect.objectContaining({
          retryCount: 1,
          connectProtocol: 'V1',
          timeout: 10_000,
        }),
      }),
    );
    // The verified bind persists the binding and retires stale sibling
    // aliases in ONE transaction — committing the binding alone would make
    // a failed cleanup permanent (the bind path is never re-entered).
    expect(
      mockedLocalDb.updateDeviceBleConnectIdAndCleanStaleAliases.mock.calls,
    ).toEqual([
      [
        {
          dbDeviceId: dbDevice.id,
          bleConnectId: liveBleConnectId,
          verifiedDeviceId: 'PRO2_DEVICE_ID',
        },
      ],
    ]);
    expect(mockedLocalDb.updateDeviceConnectId.mock.calls).toHaveLength(0);
    expect(showBluetoothDevicePairingDialog).not.toHaveBeenCalled();
  });

  it('falls back to the pairing dialog when silent BLE binding fails', async () => {
    const liveBleConnectId = '714d4c59ef4af3df00d92885755c4a58';
    const pairedBleConnectId = 'f7e440001d2c1c79509d55dfdc8201ff';
    const dbDevice = {
      id: 'db-pro2-device',
      connectId: 'PRB09B0088A',
      usbConnectId: 'PRB09B0088A',
      bleConnectId: undefined,
      deviceId: 'PRO2_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro 2',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    mockedLocalDb.getDeviceByQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(dbDevice);
    const showBluetoothDevicePairingDialog = jest.fn();
    const createCallback = jest.fn(
      ({ resolve }: { resolve: (value: string) => void }) => {
        resolve(pairedBleConnectId);
        return 'ble-pairing-promise';
      },
    );
    const service = new ServiceHardware({
      backgroundApi: {
        servicePromise: { createCallback },
        serviceHardwareUI: { showBluetoothDevicePairingDialog },
        serviceSetting: { setHardwareTransportType: jest.fn() },
      } as unknown as IBackgroundApi,
    });
    service.connectionManager.shouldSwitchTransportType = Object.assign(
      jest.fn().mockResolvedValue({
        shouldSwitch: false,
        targetType: EHardwareTransportType.DesktopWebBle,
      }),
      {
        clear: jest.fn(),
        delete: jest.fn(),
      },
    ) as typeof service.connectionManager.shouldSwitchTransportType;
    const getFeaturesSpy = jest
      .spyOn(service, 'getFeaturesWithoutCache')
      .mockRejectedValue(new Error('ble subscribe timeout'));
    jest
      .spyOn(
        service as unknown as {
          getKnownDeviceProtocol: (
            connectId?: string,
          ) => Promise<'V1' | 'V2' | undefined>;
        },
        'getKnownDeviceProtocol',
      )
      .mockResolvedValue('V1');
    service.recordLiveConnectIdEvidence(liveBleConnectId);

    await expect(
      service.getCompatibleConnectId({
        connectId: liveBleConnectId,
        featuresDeviceId: dbDevice.deviceId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toBe(pairedBleConnectId);

    expect(getFeaturesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ silentMode: true }),
    );

    expect(
      mockedLocalDb.updateDeviceBleConnectIdAndCleanStaleAliases.mock.calls,
    ).toHaveLength(0);
    expect(showBluetoothDevicePairingDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        device: dbDevice,
        usbConnectId: 'PRB09B0088A',
        promiseId: 'ble-pairing-promise',
      }),
    );
  });

  it('never probes a connectId whose evidence was cleared by a disconnect', async () => {
    const liveBleConnectId = '714d4c59ef4af3df00d92885755c4a58';
    const pairedBleConnectId = 'f7e440001d2c1c79509d55dfdc8201ff';
    const dbDevice = {
      id: 'db-pro2-device',
      connectId: 'PRB09B0088A',
      usbConnectId: 'PRB09B0088A',
      bleConnectId: undefined,
      deviceId: 'PRO2_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro 2',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    mockedLocalDb.getDeviceByQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(dbDevice);
    const showBluetoothDevicePairingDialog = jest.fn();
    const createCallback = jest.fn(
      ({ resolve }: { resolve: (value: string) => void }) => {
        resolve(pairedBleConnectId);
        return 'ble-pairing-promise';
      },
    );
    const service = new ServiceHardware({
      backgroundApi: {
        servicePromise: { createCallback },
        serviceHardwareUI: { showBluetoothDevicePairingDialog },
        serviceSetting: { setHardwareTransportType: jest.fn() },
      } as unknown as IBackgroundApi,
    });
    service.connectionManager.shouldSwitchTransportType = Object.assign(
      jest.fn().mockResolvedValue({
        shouldSwitch: false,
        targetType: EHardwareTransportType.DesktopWebBle,
      }),
      {
        clear: jest.fn(),
        delete: jest.fn(),
      },
    ) as typeof service.connectionManager.shouldSwitchTransportType;
    const getFeaturesSpy = jest.spyOn(service, 'getFeaturesWithoutCache');

    // Traffic was observed, then the device disconnected (e.g. factory
    // reset or OS-level unpair) — the DISCONNECT handler clears the stamp.
    service.recordLiveConnectIdEvidence(liveBleConnectId);
    service.clearLiveConnectIdEvidence(liveBleConnectId);

    await expect(
      service.getCompatibleConnectId({
        connectId: liveBleConnectId,
        featuresDeviceId: dbDevice.deviceId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toBe(pairedBleConnectId);

    expect(getFeaturesSpy).not.toHaveBeenCalled();
    expect(showBluetoothDevicePairingDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        device: dbDevice,
        promiseId: 'ble-pairing-promise',
      }),
    );
  });

  it('never probes a connectId without recent live traffic evidence', async () => {
    // A stale BLE UUID (device rebooted / unpaired meanwhile) must not be
    // probed: the probe's characteristic subscription could summon the OS
    // pairing prompt without any app guidance UI.
    const staleBleConnectId = '99994c59ef4af3df00d92885755c4a58';
    const pairedBleConnectId = 'f7e440001d2c1c79509d55dfdc8201ff';
    const dbDevice = {
      id: 'db-pro2-device',
      connectId: 'PRB09B0088A',
      usbConnectId: 'PRB09B0088A',
      bleConnectId: undefined,
      deviceId: 'PRO2_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro 2',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    mockedLocalDb.getDeviceByQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(dbDevice);
    const showBluetoothDevicePairingDialog = jest.fn();
    const createCallback = jest.fn(
      ({ resolve }: { resolve: (value: string) => void }) => {
        resolve(pairedBleConnectId);
        return 'ble-pairing-promise';
      },
    );
    const service = new ServiceHardware({
      backgroundApi: {
        servicePromise: { createCallback },
        serviceHardwareUI: { showBluetoothDevicePairingDialog },
        serviceSetting: { setHardwareTransportType: jest.fn() },
      } as unknown as IBackgroundApi,
    });
    service.connectionManager.shouldSwitchTransportType = Object.assign(
      jest.fn().mockResolvedValue({
        shouldSwitch: false,
        targetType: EHardwareTransportType.DesktopWebBle,
      }),
      {
        clear: jest.fn(),
        delete: jest.fn(),
      },
    ) as typeof service.connectionManager.shouldSwitchTransportType;
    const getFeaturesSpy = jest.spyOn(service, 'getFeaturesWithoutCache');

    await expect(
      service.getCompatibleConnectId({
        connectId: staleBleConnectId,
        featuresDeviceId: dbDevice.deviceId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toBe(pairedBleConnectId);

    expect(getFeaturesSpy).not.toHaveBeenCalled();
    expect(showBluetoothDevicePairingDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        device: dbDevice,
        promiseId: 'ble-pairing-promise',
      }),
    );
  });

  it('does not start BLE pairing for a no-dialog device details refresh', async () => {
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-pro2-device',
      connectId: 'PRB09B0088A',
      usbConnectId: 'PRB09B0088A',
      bleConnectId: undefined,
      deviceId: 'PRO2_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro 2',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice);
    const showBluetoothDevicePairingDialog = jest.fn();
    const service = new ServiceHardware({
      backgroundApi: {
        serviceHardwareUI: { showBluetoothDevicePairingDialog },
      } as unknown as IBackgroundApi,
    });
    service.connectionManager.shouldSwitchTransportType = Object.assign(
      jest.fn().mockResolvedValue({
        shouldSwitch: true,
        targetType: EHardwareTransportType.DesktopWebBle,
      }),
      {
        clear: jest.fn(),
        delete: jest.fn(),
      },
    ) as typeof service.connectionManager.shouldSwitchTransportType;

    await expect(
      service.getCompatibleConnectId({
        connectId: 'PRB09B0088A',
        hardwareCallContext:
          EHardwareCallContext.USER_INTERACTION_NO_BLE_DIALOG,
      }),
    ).rejects.toThrow();

    expect(showBluetoothDevicePairingDialog).not.toHaveBeenCalled();
  });

  it('falls back to the persisted USB connectId for a silent cleanup', async () => {
    const dbDevice = {
      id: 'db-pro2-device',
      connectId: 'PRB09B0088A',
      usbConnectId: 'PRB09B0088A',
      bleConnectId: undefined,
      deviceId: 'PRO2_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro 2',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(dbDevice);
    const showBluetoothDevicePairingDialog = jest.fn();
    const service = new ServiceHardware({
      backgroundApi: {
        serviceHardwareUI: { showBluetoothDevicePairingDialog },
      } as unknown as IBackgroundApi,
    });
    service.connectionManager.shouldSwitchTransportType = Object.assign(
      jest.fn().mockResolvedValue({
        shouldSwitch: true,
        targetType: EHardwareTransportType.DesktopWebBle,
      }),
      {
        clear: jest.fn(),
        delete: jest.fn(),
      },
    ) as typeof service.connectionManager.shouldSwitchTransportType;

    await expect(
      service.getCompatibleConnectId({
        connectId: dbDevice.connectId,
        hardwareCallContext: EHardwareCallContext.SILENT_CALL,
      }),
    ).resolves.toBe(dbDevice.usbConnectId);

    expect(showBluetoothDevicePairingDialog).not.toHaveBeenCalled();
  });

  it('falls back to deviceId without combining legacy features', async () => {
    const bleConnectId = 'f7e440001d2c1c79509d55dfdc8201ff';
    const device = {
      id: 'db-pro2-device',
      connectId: 'PRB09B0088A',
      usbConnectId: 'PRB09B0088A',
      bleConnectId,
      deviceId: 'PRO2_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro 2',
      features: '{"$app_firmware_type":"universal"}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    // The stale connectId matches nothing, so both connectId-based lookups
    // miss and only the featuresDeviceId fallback resolves the record.
    mockedLocalDb.getDeviceByQuery.mockImplementation(async (query) => {
      if (query.connectId && query.connectId !== device.connectId) {
        return undefined;
      }
      if (
        query.featuresDeviceId &&
        query.featuresDeviceId !== device.deviceId
      ) {
        return undefined;
      }
      return device;
    });

    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    service.connectionManager.shouldSwitchTransportType = Object.assign(
      jest.fn().mockResolvedValue({
        shouldSwitch: true,
        targetType: EHardwareTransportType.DesktopWebBle,
      }),
      {
        clear: jest.fn(),
        delete: jest.fn(),
      },
    ) as typeof service.connectionManager.shouldSwitchTransportType;

    await expect(
      service.getCompatibleConnectId({
        connectId: 'STALE_CONNECT_ID',
        featuresDeviceId: 'PRO2_DEVICE_ID',
        features: {
          $app_firmware_type: 'universal',
        } as IOneKeyDeviceFeaturesWithAppParams,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toBe(bleConnectId);

    expect(mockedLocalDb.getDeviceByQuery.mock.calls.slice(0, 3)).toEqual([
      [{ connectId: 'STALE_CONNECT_ID', featuresDeviceId: 'PRO2_DEVICE_ID' }],
      [{ connectId: 'STALE_CONNECT_ID' }],
      [{ featuresDeviceId: 'PRO2_DEVICE_ID' }],
    ]);
  });

  it('uses a bound Trezor BLE connectId when desktop BLE is selected', async () => {
    const trezorDevice = {
      id: 'db-device-1',
      connectId: 'USB_ID',
      usbConnectId: 'USB_ID',
      bleConnectId: 'BLE_ID',
      deviceId: 'FEATURES_DEVICE_ID',
      vendor: EHardwareVendor.trezor,
      name: 'Trezor Safe 7',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice;
    mockedLocalDb.getDeviceByQuery.mockImplementation(async (query) =>
      query.vendor === EHardwareVendor.trezor ? trezorDevice : undefined,
    );

    const service = new ServiceHardware({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });
    const shouldSwitchTransportTypeMock = Object.assign(
      jest.fn().mockResolvedValue({
        shouldSwitch: true,
        targetType: EHardwareTransportType.DesktopWebBle,
      }),
      {
        clear: jest.fn(),
        delete: jest.fn(),
      },
    );
    service.connectionManager.shouldSwitchTransportType =
      shouldSwitchTransportTypeMock as typeof service.connectionManager.shouldSwitchTransportType;

    await expect(
      service.getCompatibleConnectId({
        connectId: 'USB_ID',
        featuresDeviceId: 'FEATURES_DEVICE_ID',
        vendor: EHardwareVendor.trezor,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toBe('BLE_ID');
    expect(mockedLocalDb.getDeviceByQuery.mock.calls[0]).toEqual([
      {
        connectId: 'USB_ID',
        featuresDeviceId: 'FEATURES_DEVICE_ID',
        vendor: EHardwareVendor.trezor,
      },
    ]);
  });

  it('uses USB when any authorized OneKey WebUSB device is available', async () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    );
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        usb: {
          getDevices: jest.fn().mockResolvedValue([
            {
              vendorId: 0x12_09,
              productId: 0x4f_4c,
              serialNumber: 'PRO2_USB_ID',
            },
          ]),
        },
      },
    });
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-pro-device',
      connectId: 'PRB50B0127B',
      usbConnectId: 'PRB50B0127B',
      bleConnectId: 'PRO_BLE_PERIPHERAL_ID',
      deviceId: 'PRO_FEATURES_DEVICE_ID',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice);

    try {
      const service = new ServiceHardware({
        backgroundApi: {
          serviceDevSetting: {
            getDevSetting: jest.fn().mockResolvedValue({
              settings: { usbCommunicationMode: 'webusb' },
            }),
          },
          serviceSetting: {
            getHardwareTransportType: jest
              .fn()
              .mockResolvedValue(EHardwareTransportType.WEBUSB),
          },
        } as unknown as IBackgroundApi,
      });
      const detectBluetoothAvailability = jest
        .spyOn(service.connectionManager, 'detectBluetoothAvailability')
        .mockResolvedValue(true);

      await expect(
        service.connectionManager.detectWebUSBAvailability('OTHER_USB_ID'),
      ).resolves.toBe(true);
      await expect(
        service.connectionManager.detectWebUSBAvailability('PRO2_USB_ID'),
      ).resolves.toBe(true);

      await expect(
        service.connectionManager.shouldSwitchTransportType({
          connectId: 'PRO2_USB_ID',
          hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        }),
      ).resolves.toMatchObject({
        targetType: EHardwareTransportType.WEBUSB,
      });

      await expect(
        service.getCompatibleConnectId({
          connectId: 'PRB50B0127B',
          featuresDeviceId: 'PRO_FEATURES_DEVICE_ID',
          hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        }),
      ).resolves.toBe('PRB50B0127B');
      expect(detectBluetoothAvailability).not.toHaveBeenCalled();
    } finally {
      if (originalNavigator) {
        Object.defineProperty(globalThis, 'navigator', originalNavigator);
      } else {
        delete (globalThis as { navigator?: Navigator }).navigator;
      }
    }
  });

  it('falls back to BLE when navigator.usb only reports a serial-less device', async () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    );
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        usb: {
          getDevices: jest.fn().mockResolvedValue([
            {
              vendorId: 0x12_09,
              productId: 0x4f_4c,
              // Chromium 可以返回已授权但没有可用 serialNumber 的设备；
              // 这种设备无法被 SDK WebUSB transport acquire。
              serialNumber: '',
            },
          ]),
        },
      },
    });

    try {
      const service = new ServiceHardware({
        backgroundApi: {
          serviceDevSetting: {
            getDevSetting: jest.fn().mockResolvedValue({
              settings: { usbCommunicationMode: 'webusb' },
            }),
          },
          serviceSetting: {
            getHardwareTransportType: jest
              .fn()
              .mockResolvedValue(EHardwareTransportType.WEBUSB),
          },
        } as unknown as IBackgroundApi,
      });
      const detectBluetoothAvailability = jest
        .spyOn(service.connectionManager, 'detectBluetoothAvailability')
        .mockResolvedValue(true);

      await expect(
        service.connectionManager.shouldSwitchTransportType({
          connectId: 'PRO2_USB_ID',
          hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        }),
      ).resolves.toMatchObject({
        shouldSwitch: true,
        targetType: EHardwareTransportType.DesktopWebBle,
      });
      expect(detectBluetoothAvailability).toHaveBeenCalled();
    } finally {
      if (originalNavigator) {
        Object.defineProperty(globalThis, 'navigator', originalNavigator);
      } else {
        delete (globalThis as { navigator?: Navigator }).navigator;
      }
    }
  });

  it('keeps one transport decision when the same call changes from USB serial to BLE UUID', async () => {
    const getDevices = jest
      .fn()
      .mockResolvedValue([
        { vendorId: 0x12_09, productId: 0x4f_4c, serialNumber: 'USB_ID' },
      ]);
    const originalNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    );
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { usb: { getDevices } },
    });

    try {
      const service = new ServiceHardware({
        backgroundApi: {
          serviceDevSetting: {
            getDevSetting: jest.fn().mockResolvedValue({
              settings: { usbCommunicationMode: 'webusb' },
            }),
          },
          serviceSetting: {
            getHardwareTransportType: jest
              .fn()
              .mockResolvedValue(EHardwareTransportType.WEBUSB),
          },
        } as unknown as IBackgroundApi,
      });

      await expect(
        service.connectionManager.shouldSwitchTransportType({
          connectId: 'USB_ID',
          hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        }),
      ).resolves.toMatchObject({ targetType: EHardwareTransportType.WEBUSB });
      await expect(
        service.connectionManager.shouldSwitchTransportType({
          connectId: 'BLE_PERIPHERAL_UUID',
          hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        }),
      ).resolves.toMatchObject({ targetType: EHardwareTransportType.WEBUSB });
      expect(getDevices).toHaveBeenCalledTimes(1);
    } finally {
      if (originalNavigator) {
        Object.defineProperty(globalThis, 'navigator', originalNavigator);
      } else {
        delete (globalThis as { navigator?: Navigator }).navigator;
      }
    }
  });

  it('uses Bridge when any Bridge device is enumerated', async () => {
    mockedAxios.post.mockResolvedValue({
      data: [{ path: 'UNRELATED_USB_ID' }],
    });
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-pro-device',
      connectId: 'PRB50B0127B',
      usbConnectId: 'PRB50B0127B',
      bleConnectId: 'PRO_BLE_PERIPHERAL_ID',
      deviceId: 'PRO_FEATURES_DEVICE_ID',
      connectProtocol: 'V1',
      vendor: EHardwareVendor.onekey,
      name: 'OneKey Pro',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice);

    const service = new ServiceHardware({
      backgroundApi: {
        serviceDevSetting: {
          getDevSetting: jest.fn().mockResolvedValue({
            settings: { usbCommunicationMode: 'bridge' },
          }),
        },
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.Bridge),
        },
      } as unknown as IBackgroundApi,
    });
    const detectBluetoothAvailability = jest
      .spyOn(service.connectionManager, 'detectBluetoothAvailability')
      .mockResolvedValue(true);

    await expect(
      service.connectionManager.detectBridgeAvailability('OTHER_USB_ID'),
    ).resolves.toBe(true);
    await expect(
      service.connectionManager.detectBridgeAvailability('UNRELATED_USB_ID'),
    ).resolves.toBe(true);

    await expect(
      service.connectionManager.shouldSwitchTransportType({
        connectId: 'UNRELATED_USB_ID',
        connectProtocol: 'V1',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toMatchObject({
      targetType: EHardwareTransportType.Bridge,
    });

    await expect(
      service.getCompatibleConnectId({
        connectId: 'PRB50B0127B',
        featuresDeviceId: 'PRO_FEATURES_DEVICE_ID',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toBe('PRB50B0127B');
    expect(detectBluetoothAvailability).not.toHaveBeenCalled();
  });

  it('switches Mini back to the configured USB transport after BLE was active', async () => {
    const setHardwareTransportType = jest.fn();
    const service = new ServiceHardware({
      backgroundApi: {
        serviceDevSetting: {
          getDevSetting: jest.fn().mockResolvedValue({
            settings: { usbCommunicationMode: 'webusb' },
          }),
        },
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.DesktopWebBle),
          setHardwareTransportType,
        },
      } as unknown as IBackgroundApi,
    });
    await service.connectionManager.setCurrentTransportType(
      EHardwareTransportType.DesktopWebBle,
    );

    await expect(
      service.connectionManager.shouldSwitchTransportType({
        connectId: 'MI123456789',
        connectProtocol: 'V1',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toEqual({
      shouldSwitch: true,
      targetType: EHardwareTransportType.WEBUSB,
    });
  });

  it('keeps Mini on USB for a desktop background call after BLE was active', async () => {
    const service = new ServiceHardware({
      backgroundApi: {
        serviceDevSetting: {
          getDevSetting: jest.fn().mockResolvedValue({
            settings: { usbCommunicationMode: 'webusb' },
          }),
        },
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.DesktopWebBle),
        },
      } as unknown as IBackgroundApi,
    });
    await service.connectionManager.setCurrentTransportType(
      EHardwareTransportType.DesktopWebBle,
    );

    await expect(
      service.connectionManager.shouldSwitchTransportType({
        connectId: 'MI123456789',
        connectProtocol: 'V1',
        hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
      }),
    ).resolves.toEqual({
      shouldSwitch: true,
      targetType: EHardwareTransportType.WEBUSB,
    });
  });

  it('honors a pinned transport before applying the Mini USB preference', async () => {
    jest.mocked(desktopHardwareForceTransportAtom.get).mockResolvedValue({
      forceTransportType: EHardwareTransportType.Bridge,
    });
    const service = new ServiceHardware({
      backgroundApi: {
        serviceDevSetting: {
          getDevSetting: jest.fn().mockResolvedValue({
            settings: { usbCommunicationMode: 'webusb' },
          }),
        },
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.WEBUSB),
        },
      } as unknown as IBackgroundApi,
    });
    await service.connectionManager.setCurrentTransportType(
      EHardwareTransportType.WEBUSB,
    );

    await expect(
      service.connectionManager.shouldSwitchTransportType({
        connectId: 'MI123456789',
        connectProtocol: 'V1',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toEqual({
      shouldSwitch: true,
      targetType: EHardwareTransportType.Bridge,
    });
  });

  it('keeps Mini on USB when the forced transport is BLE', async () => {
    jest.mocked(desktopHardwareForceTransportAtom.get).mockResolvedValue({
      forceTransportType: EHardwareTransportType.DesktopWebBle,
    });
    const service = new ServiceHardware({
      backgroundApi: {
        serviceDevSetting: {
          getDevSetting: jest.fn().mockResolvedValue({
            settings: { usbCommunicationMode: 'webusb' },
          }),
        },
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.DesktopWebBle),
        },
      } as unknown as IBackgroundApi,
    });
    await service.connectionManager.setCurrentTransportType(
      EHardwareTransportType.DesktopWebBle,
    );

    await expect(
      service.connectionManager.shouldSwitchTransportType({
        connectId: 'MI123456789',
        connectProtocol: 'V1',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toEqual({
      shouldSwitch: true,
      targetType: EHardwareTransportType.WEBUSB,
    });
  });

  it('uses WebUSB for Protocol V2 even when Bridge is configured', async () => {
    const service = new ServiceHardware({
      backgroundApi: {
        serviceDevSetting: {
          getDevSetting: jest.fn().mockResolvedValue({
            settings: { usbCommunicationMode: 'bridge' },
          }),
        },
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.Bridge),
        },
      } as unknown as IBackgroundApi,
    });
    const detectWebUSBAvailability = jest
      .spyOn(service.connectionManager, 'detectWebUSBAvailability')
      .mockResolvedValue(true);
    const detectBridgeAvailability = jest.spyOn(
      service.connectionManager,
      'detectBridgeAvailability',
    );

    await expect(
      service.connectionManager.shouldSwitchTransportType({
        connectId: 'PRO2_USB_ID',
        connectProtocol: 'V2',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toEqual({
      shouldSwitch: true,
      targetType: EHardwareTransportType.WEBUSB,
    });
    expect(detectWebUSBAvailability).toHaveBeenCalledWith('PRO2_USB_ID');
    expect(detectBridgeAvailability).not.toHaveBeenCalled();
  });

  it.each([
    {
      firstProtocol: 'V1' as const,
      secondProtocol: 'V2' as const,
      expectedTargets: [
        EHardwareTransportType.Bridge,
        EHardwareTransportType.WEBUSB,
      ],
    },
    {
      firstProtocol: 'V2' as const,
      secondProtocol: 'V1' as const,
      expectedTargets: [
        EHardwareTransportType.WEBUSB,
        EHardwareTransportType.Bridge,
      ],
    },
  ])(
    'isolates $firstProtocol and $secondProtocol transport decisions in the same context',
    async ({ firstProtocol, secondProtocol, expectedTargets }) => {
      const service = new ServiceHardware({
        backgroundApi: {
          serviceDevSetting: {
            getDevSetting: jest.fn().mockResolvedValue({
              settings: { usbCommunicationMode: 'bridge' },
            }),
          },
          serviceSetting: {
            getHardwareTransportType: jest
              .fn()
              .mockResolvedValue(EHardwareTransportType.Bridge),
          },
        } as unknown as IBackgroundApi,
      });
      jest
        .spyOn(service.connectionManager, 'detectBridgeAvailability')
        .mockResolvedValue(true);
      jest
        .spyOn(service.connectionManager, 'detectWebUSBAvailability')
        .mockResolvedValue(true);

      const firstResult =
        await service.connectionManager.shouldSwitchTransportType({
          connectId: 'PRO2_USB_ID',
          connectProtocol: firstProtocol,
          hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        });
      const secondResult =
        await service.connectionManager.shouldSwitchTransportType({
          connectId: 'PRO2_USB_ID',
          connectProtocol: secondProtocol,
          hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        });

      expect([firstResult.targetType, secondResult.targetType]).toEqual(
        expectedTargets,
      );
    },
  );

  it('isolates Mini and BLE-capable device transport decisions', async () => {
    const service = new ServiceHardware({
      backgroundApi: {
        serviceDevSetting: {
          getDevSetting: jest.fn().mockResolvedValue({
            settings: { usbCommunicationMode: 'webusb' },
          }),
        },
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.WEBUSB),
        },
      } as unknown as IBackgroundApi,
    });
    jest
      .spyOn(service.connectionManager, 'detectWebUSBAvailability')
      .mockResolvedValue(false);
    jest
      .spyOn(service.connectionManager, 'detectBluetoothAvailability')
      .mockResolvedValue(true);

    const regularResult =
      await service.connectionManager.shouldSwitchTransportType({
        connectId: 'PRO_USB_ID',
        connectProtocol: 'V1',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });
    const miniResult =
      await service.connectionManager.shouldSwitchTransportType({
        connectId: 'MI123456789',
        connectProtocol: 'V1',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });

    expect(regularResult.targetType).toBe(EHardwareTransportType.DesktopWebBle);
    expect(miniResult.targetType).toBe(EHardwareTransportType.WEBUSB);
  });

  it('rejects a stored third-party connectId before initializing OneKey SDK', async () => {
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-device-1',
      connectId: 'USB_ID',
      usbConnectId: 'USB_ID',
      deviceId: 'FEATURES_DEVICE_ID',
      vendor: EHardwareVendor.trezor,
      name: 'Trezor Safe 7',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice);

    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    service.checkSdkVersionValid = jest.fn();

    await expect(
      service.getSDKInstance({
        connectId: 'USB_ID',
      }),
    ).rejects.toThrow(
      'ServiceHardware SDK is OneKey-only; connectId "USB_ID" belongs to third-party vendor "trezor". Use ServiceThirdPartyHardware instead.',
    );
  });

  it('reloads the SDK only when a forced manifest refresh changes the snapshot', async () => {
    Object.assign(mutablePlatformEnv, {
      isSupportDesktopBle: false,
    });
    const manifest1 = { bridge: { version: '1' } };
    const manifest2 = { bridge: { version: '2' } };
    mockedGetFirmwareManifestSnapshot
      .mockResolvedValueOnce(manifest1 as unknown as RemoteConfigResponse)
      .mockResolvedValueOnce(manifest1 as unknown as RemoteConfigResponse)
      .mockResolvedValueOnce(manifest2 as unknown as RemoteConfigResponse);
    mockedGetHardwareSDKInstance.mockImplementation(async (params) => {
      await params.loadFirmwareConfig?.();
      return {} as Awaited<ReturnType<typeof getHardwareSDKInstance>>;
    });

    const service = new ServiceHardware({
      backgroundApi: {
        serviceApp: {
          showToast: jest.fn(),
        },
        serviceDevSetting: {
          getFirmwareUpdateDevSettings: jest.fn().mockResolvedValue(false),
        },
        serviceSetting: {
          setHardwareTransportType: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });
    service.checkSdkVersionValid = jest.fn();
    service.connectionManager.getCurrentTransportType = jest
      .fn()
      .mockResolvedValue(EHardwareTransportType.WEBUSB);
    jest
      .spyOn(
        service as unknown as {
          registerSdkEvents: () => Promise<void>;
        },
        'registerSdkEvents',
      )
      .mockResolvedValue(undefined);

    const options = {
      connectId: undefined,
      forceFirmwareManifestRefresh: true,
    };
    await service.getSDKInstance(options);
    await service.getSDKInstance(options);
    expect(mockedResetHardwareSDKInstance).not.toHaveBeenCalled();

    await service.getSDKInstance(options);
    expect(mockedResetHardwareSDKInstance).toHaveBeenCalledTimes(1);
    expect(mockedGetFirmwareManifestSnapshot).toHaveBeenCalledTimes(3);
    expect(mockedGetFirmwareManifestSnapshot).toHaveBeenLastCalledWith({
      preRelease: false,
      forceRefresh: true,
    });
  });

  it('keeps ordinary hardware available without a manifest and reloads after recovery', async () => {
    Object.assign(mutablePlatformEnv, {
      isSupportDesktopBle: false,
    });
    const recoveredManifest = { bridge: { version: 'recovered' } };
    mockedGetFirmwareManifestSnapshot
      .mockRejectedValueOnce(new Error('manifest unavailable'))
      .mockResolvedValueOnce(
        recoveredManifest as unknown as RemoteConfigResponse,
      );
    const loadedConfigs: Array<RemoteConfigResponse | undefined> = [];
    mockedGetHardwareSDKInstance.mockImplementation(async (params) => {
      loadedConfigs.push(await params.loadFirmwareConfig?.());
      return {} as Awaited<ReturnType<typeof getHardwareSDKInstance>>;
    });

    const service = new ServiceHardware({
      backgroundApi: {
        serviceApp: {
          showToast: jest.fn(),
        },
        serviceDevSetting: {
          getFirmwareUpdateDevSettings: jest.fn().mockResolvedValue(false),
        },
        serviceSetting: {
          setHardwareTransportType: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });
    service.checkSdkVersionValid = jest.fn();
    service.connectionManager.getCurrentTransportType = jest
      .fn()
      .mockResolvedValue(EHardwareTransportType.WEBUSB);
    jest
      .spyOn(
        service as unknown as {
          registerSdkEvents: () => Promise<void>;
        },
        'registerSdkEvents',
      )
      .mockResolvedValue(undefined);

    await expect(
      service.getSDKInstance({ connectId: undefined }),
    ).resolves.toBeDefined();
    expect(loadedConfigs).toEqual([undefined]);
    expect(mockedResetHardwareSDKInstance).not.toHaveBeenCalled();

    await expect(
      service.getSDKInstance({
        connectId: undefined,
        forceFirmwareManifestRefresh: true,
      }),
    ).resolves.toBeDefined();
    expect(mockedResetHardwareSDKInstance).toHaveBeenCalledTimes(1);
    expect(loadedConfigs).toEqual([undefined, recoveredManifest]);
  });

  it('keeps an explicit firmware manifest refresh fail-closed', async () => {
    Object.assign(mutablePlatformEnv, {
      isSupportDesktopBle: false,
    });
    mockedGetFirmwareManifestSnapshot.mockRejectedValueOnce(
      new Error('manifest unavailable'),
    );

    const service = new ServiceHardware({
      backgroundApi: {
        serviceDevSetting: {
          getFirmwareUpdateDevSettings: jest.fn().mockResolvedValue(false),
        },
      } as unknown as IBackgroundApi,
    });
    service.checkSdkVersionValid = jest.fn();

    await expect(
      service.getSDKInstance({
        connectId: undefined,
        forceFirmwareManifestRefresh: true,
      }),
    ).rejects.toThrow('manifest unavailable');
    expect(mockedGetHardwareSDKInstance).not.toHaveBeenCalled();
  });

  it('shows BLE permission guidance before Android user hardware calls when permission is missing', async () => {
    Object.assign(mutablePlatformEnv, {
      isDesktop: false,
      isSupportDesktopBle: false,
      isNative: true,
      isNativeAndroid: true,
    });
    mockedCheckBLEPermissions.mockResolvedValue(false);

    const service = new ServiceHardware({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest.fn(
            async () => EHardwareTransportType.BLE,
          ),
        },
      } as unknown as IBackgroundApi,
    });

    await expect(
      service.getCompatibleConnectId({
        connectId: 'ANDROID_BLE_ID',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).rejects.toThrow('NeedBluetoothPermissions');

    expect(mockedAppEventBus.emit.mock.calls).toContainEqual([
      EAppEventBusNames.RequestHardwareUIDialog,
      {
        uiRequestType: 'ui-location_permission',
      },
    ]);
    expect(mockedCheckBLEState).not.toHaveBeenCalled();
    expect(mockedLocalDb.getDeviceByQuery.mock.calls).toHaveLength(1);
  });

  it('shows Bluetooth settings guidance before Android user hardware calls when Bluetooth is off', async () => {
    Object.assign(mutablePlatformEnv, {
      isDesktop: false,
      isSupportDesktopBle: false,
      isNative: true,
      isNativeAndroid: true,
    });
    mockedCheckBLEPermissions.mockResolvedValue(true);
    mockedCheckBLEState.mockResolvedValue(false);

    const service = new ServiceHardware({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest.fn(
            async () => EHardwareTransportType.BLE,
          ),
        },
      } as unknown as IBackgroundApi,
    });

    await expect(
      service.getCompatibleConnectId({
        connectId: 'ANDROID_BLE_ID',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).rejects.toThrow('NeedBluetoothTurnedOn');

    expect(mockedAppEventBus.emit.mock.calls).toContainEqual([
      EAppEventBusNames.RequestHardwareUIDialog,
      {
        uiRequestType: 'ui-bluetooth_permission',
      },
    ]);
    expect(mockedLocalDb.getDeviceByQuery.mock.calls).toHaveLength(1);
  });

  it('does not run BLE prechecks for an explicit Android USB call after BLE was active', async () => {
    Object.assign(mutablePlatformEnv, {
      isDesktop: false,
      isSupportDesktopBle: false,
      isNative: true,
      isNativeAndroid: true,
    });
    mockedCheckBLEPermissions.mockResolvedValue(false);

    const service = new ServiceHardware({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest.fn(
            async () => EHardwareTransportType.BLE,
          ),
        },
      } as unknown as IBackgroundApi,
    });

    await expect(
      service.getCompatibleConnectId({
        connectId: 'ANDROID_USB_ID',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        hardwareTransportType: EHardwareTransportType.WEBUSB,
      }),
    ).resolves.toBe('ANDROID_USB_ID');

    expect(mockedCheckBLEPermissions).not.toHaveBeenCalled();
    expect(mockedCheckBLEState).not.toHaveBeenCalled();
    expect(mockedAppEventBus.emit.mock.calls).toHaveLength(0);
  });

  it('runs BLE prechecks for an explicit Android BLE call after USB was active', async () => {
    Object.assign(mutablePlatformEnv, {
      isDesktop: false,
      isSupportDesktopBle: false,
      isNative: true,
      isNativeAndroid: true,
    });
    mockedCheckBLEPermissions.mockResolvedValue(false);

    const service = new ServiceHardware({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest.fn(
            async () => EHardwareTransportType.WEBUSB,
          ),
        },
      } as unknown as IBackgroundApi,
    });

    await expect(
      service.getCompatibleConnectId({
        connectId: 'ANDROID_BLE_ID',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        hardwareTransportType: EHardwareTransportType.BLE,
      }),
    ).rejects.toThrow('NeedBluetoothPermissions');

    expect(mockedCheckBLEPermissions).toHaveBeenCalledTimes(1);
    expect(mockedCheckBLEState).not.toHaveBeenCalled();
  });

  it('does not run BLE prechecks for Android third-party USB devices', async () => {
    Object.assign(mutablePlatformEnv, {
      isDesktop: false,
      isSupportDesktopBle: false,
      isNative: true,
      isNativeAndroid: true,
    });
    mockedCheckBLEPermissions.mockResolvedValue(false);
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-device-1',
      connectId: 'USB_ID',
      usbConnectId: 'USB_ID',
      deviceId: 'FEATURES_DEVICE_ID',
      vendor: EHardwareVendor.trezor,
      name: 'Trezor Safe 7',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 0,
      updatedAt: 0,
    } as IDBDevice);

    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });

    await expect(
      service.getCompatibleConnectId({
        connectId: 'USB_ID',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toBe('USB_ID');

    expect(mockedCheckBLEPermissions).not.toHaveBeenCalled();
    expect(mockedCheckBLEState).not.toHaveBeenCalled();
    expect(mockedAppEventBus.emit.mock.calls).toHaveLength(0);
  });

  it('does not show BLE permission guidance for Android background hardware calls', async () => {
    Object.assign(mutablePlatformEnv, {
      isDesktop: false,
      isSupportDesktopBle: false,
      isNative: true,
      isNativeAndroid: true,
    });
    mockedCheckBLEPermissions.mockResolvedValue(false);
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(undefined);

    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });

    await expect(
      service.getCompatibleConnectId({
        connectId: 'ANDROID_BLE_ID',
        hardwareCallContext: EHardwareCallContext.BACKGROUND_TASK,
      }),
    ).resolves.toBe('ANDROID_BLE_ID');

    expect(mockedCheckBLEPermissions).not.toHaveBeenCalled();
    expect(mockedAppEventBus.emit.mock.calls).toHaveLength(0);
  });

  it('keeps OneKey standard wallet EVM address lookup on empty passphrase', async () => {
    const evmGetAddress = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        address: '0xOneKeyStandardAddress',
      },
    });
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    service.getCompatibleConnectId = jest.fn().mockResolvedValue('ONEKEY_USB');
    service.getSDKInstance = jest.fn().mockResolvedValue({
      evmGetAddress,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);

    await expect(
      service.getEvmAddressByStandardWallet({
        connectId: 'ONEKEY_USB',
        deviceId: 'ONEKEY_DEVICE_ID',
        path: "m/44'/60'/0'/0/0",
        vendor: EHardwareVendor.onekey,
      }),
    ).resolves.toBe('0xOneKeyStandardAddress');

    expect(evmGetAddress).toHaveBeenCalledWith(
      'ONEKEY_USB',
      'ONEKEY_DEVICE_ID',
      {
        path: "m/44'/60'/0'/0/0",
        showOnOneKey: false,
        useEmptyPassphrase: true,
        passphraseState: undefined,
      },
    );
  });

  it('uploads a portfolio package through the SDK with a silent context', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    const getCompatibleConnectId = jest.fn().mockResolvedValue('ONEKEY_USB');
    const uploadPortfolio = jest.fn().mockResolvedValue({
      success: true,
      payload: { portfolioUpdated: true },
    });
    const getSDKInstance = jest.fn().mockResolvedValue({
      uploadPortfolio,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);
    service.getCompatibleConnectId = getCompatibleConnectId;
    service.getSDKInstance = getSDKInstance;

    const packageBase64 = 'AQID';

    await expect(
      service.uploadPortfolioPackage({
        connectId: 'ONEKEY_USB',
        packageBase64,
      }),
    ).resolves.toEqual({ portfolioUpdated: true });

    expect(getCompatibleConnectId).toHaveBeenCalledWith({
      connectId: 'ONEKEY_USB',
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
    });
    expect(getSDKInstance).toHaveBeenCalledWith({
      connectId: 'ONEKEY_USB',
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
      persistTransportType: false,
    });
    expect(uploadPortfolio).toHaveBeenCalledWith('ONEKEY_USB', {
      packageBase64,
    });
  });

  it('uploads an interactive portfolio package with progress UI', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    const getCompatibleConnectId = jest.fn().mockResolvedValue('ONEKEY_USB');
    const uploadPortfolio = jest.fn().mockResolvedValue({
      success: true,
      payload: { portfolioUpdated: true },
    });
    const getSDKInstance = jest.fn().mockResolvedValue({
      uploadPortfolio,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);
    service.getCompatibleConnectId = getCompatibleConnectId;
    service.getSDKInstance = getSDKInstance;

    await expect(
      service.uploadPortfolioPackage({
        connectId: 'ONEKEY_USB',
        packageBase64: 'AQID',
        uiMode: 'progress',
      }),
    ).resolves.toEqual({ portfolioUpdated: true });

    expect(getCompatibleConnectId).toHaveBeenCalledWith({
      connectId: 'ONEKEY_USB',
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    expect(getSDKInstance).toHaveBeenCalledWith({
      connectId: 'ONEKEY_USB',
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    expect(uploadPortfolio).toHaveBeenCalledWith('ONEKEY_USB', {
      packageBase64: 'AQID',
      uiMode: 'progress',
    });
  });

  it('pins desktop BLE portfolio upload to connected-only reuse', async () => {
    const originalDesktopApi = globalThis.desktopApi;
    const beginConnectedOnlyScope = jest.fn().mockReturnValue(1);
    const endConnectedOnlyScope = jest.fn();
    globalThis.desktopApi = {
      nobleBle: {
        beginConnectedOnlyScope,
        endConnectedOnlyScope,
      },
    } as never;
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    const getCompatibleConnectId = jest.fn().mockResolvedValue('PRO2_BLE_ID');
    const uploadPortfolio = jest.fn().mockResolvedValue({
      success: true,
      payload: { portfolioUpdated: true },
    });
    const getSDKInstance = jest.fn().mockResolvedValue({
      uploadPortfolio,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);
    service.getCompatibleConnectId = getCompatibleConnectId;
    service.getSDKInstance = getSDKInstance;

    try {
      await expect(
        service.uploadPortfolioPackage({
          connectId: 'PRO2_BLE_ID',
          desktopBleReuseConnectedOnly: true,
          hardwareTransportType: EHardwareTransportType.DesktopWebBle,
          packageBase64: 'AQID',
        }),
      ).resolves.toEqual({ portfolioUpdated: true });

      expect(getCompatibleConnectId).toHaveBeenCalledWith({
        connectId: 'PRO2_BLE_ID',
        hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      });
      expect(getSDKInstance).toHaveBeenCalledWith({
        connectId: 'PRO2_BLE_ID',
        hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
        persistTransportType: false,
      });
      expect(beginConnectedOnlyScope).toHaveBeenCalledWith('PRO2_BLE_ID');
      expect(uploadPortfolio).toHaveBeenCalledWith('PRO2_BLE_ID', {
        packageBase64: 'AQID',
      });
      expect(endConnectedOnlyScope).toHaveBeenCalledWith('PRO2_BLE_ID', 1);
      expect(beginConnectedOnlyScope.mock.invocationCallOrder[0]).toBeLessThan(
        uploadPortfolio.mock.invocationCallOrder[0],
      );
      expect(uploadPortfolio.mock.invocationCallOrder[0]).toBeLessThan(
        endConnectedOnlyScope.mock.invocationCallOrder[0],
      );
    } finally {
      globalThis.desktopApi = originalDesktopApi;
    }
  });

  it('always closes the desktop BLE connected-only scope after an SDK error', async () => {
    const originalDesktopApi = globalThis.desktopApi;
    const beginConnectedOnlyScope = jest.fn().mockReturnValue(1);
    const endConnectedOnlyScope = jest.fn();
    globalThis.desktopApi = {
      nobleBle: {
        beginConnectedOnlyScope,
        endConnectedOnlyScope,
      },
    } as never;
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    service.getCompatibleConnectId = jest.fn().mockResolvedValue('PRO2_BLE_ID');
    service.getSDKInstance = jest.fn().mockResolvedValue({
      uploadPortfolio: jest.fn().mockRejectedValue(new Error('BLE failed')),
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);

    try {
      await expect(
        service.uploadPortfolioPackage({
          connectId: 'PRO2_BLE_ID',
          desktopBleReuseConnectedOnly: true,
          hardwareTransportType: EHardwareTransportType.DesktopWebBle,
          packageBase64: 'AQID',
        }),
      ).rejects.toThrow('BLE failed');
      expect(beginConnectedOnlyScope).toHaveBeenCalledWith('PRO2_BLE_ID');
      expect(endConnectedOnlyScope).toHaveBeenCalledWith('PRO2_BLE_ID', 1);
    } finally {
      globalThis.desktopApi = originalDesktopApi;
    }
  });

  it('keeps desktop BLE Portfolio upload errors silent', async () => {
    const originalDesktopApi = globalThis.desktopApi;
    globalThis.desktopApi = {
      nobleBle: {
        beginConnectedOnlyScope: jest.fn().mockReturnValue(1),
        endConnectedOnlyScope: jest.fn(),
      },
    } as never;
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    service.getCompatibleConnectId = jest.fn().mockResolvedValue('PRO2_BLE_ID');
    service.getSDKInstance = jest.fn().mockResolvedValue({
      uploadPortfolio: jest.fn().mockResolvedValue({
        success: false,
        payload: {
          code: HardwareErrorCode.DeviceNotFound,
          error: 'Device not found',
        },
      }),
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);

    try {
      await expect(
        service.uploadPortfolioPackage({
          connectId: 'PRO2_BLE_ID',
          desktopBleReuseConnectedOnly: true,
          hardwareTransportType: EHardwareTransportType.DesktopWebBle,
          packageBase64: 'AQID',
        }),
      ).rejects.toMatchObject({ code: HardwareErrorCode.DeviceNotFound });
      expect(mockedAppEventBus.emit.mock.calls).toHaveLength(0);
    } finally {
      globalThis.desktopApi = originalDesktopApi;
    }
  });

  it('forwards Pro2 NFT JPEG Base64 without decoding it in background', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    service.getCompatibleConnectId = jest.fn().mockResolvedValue('ONEKEY_USB');
    const deviceUploadNft = jest.fn().mockResolvedValue({
      success: true,
      payload: { nftUpdated: true },
    });
    service.getSDKInstance = jest.fn().mockResolvedValue({
      deviceUploadNft,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);

    await expect(
      service.uploadPro2Nft({
        connectId: 'ONEKEY_USB',
        imageJpegBase64: 'full-image-base64',
        thumbnailJpegBase64: 'thumbnail-base64',
        title: 'NFT #1',
        subtitle: 'Collection',
        timestampMs: 123,
      }),
    ).resolves.toEqual({ nftUpdated: true });

    expect(deviceUploadNft).toHaveBeenCalledWith('ONEKEY_USB', {
      imageJpegBase64: 'full-image-base64',
      thumbnailJpegBase64: 'thumbnail-base64',
      title: 'NFT #1',
      subtitle: 'Collection',
      timestampMs: 123,
    });
  });

  it('resolves transport once before Pro 2 discovery', async () => {
    const searchDevices = jest.fn().mockResolvedValue({
      success: true,
      payload: [],
    });
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    const getSDKInstance = jest.fn().mockResolvedValue({
      searchDevices,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);
    const prepareHardwareTransport = jest
      .fn()
      .mockResolvedValue(EHardwareTransportType.DesktopWebBle);
    service.getSDKInstance = getSDKInstance;
    service.prepareHardwareTransport = prepareHardwareTransport;

    await expect(
      service.searchDevices({ connectProtocol: 'V2' }),
    ).resolves.toEqual({ success: true, payload: [] });

    expect(searchDevices).toHaveBeenCalledWith();
    expect(prepareHardwareTransport).toHaveBeenCalledWith({
      connectProtocol: 'V2',
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    expect(getSDKInstance).toHaveBeenCalledWith({
      connectId: undefined,
      connectProtocol: 'V2',
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      hardwareTransportType: EHardwareTransportType.DesktopWebBle,
    });
  });

  it('marks the hardware channel busy while device discovery is running', async () => {
    let resolveSearch:
      | ((result: { success: true; payload: SearchDevice[] }) => void)
      | undefined;
    const sdkSearchDevices = jest.fn(
      () =>
        new Promise<{ success: true; payload: SearchDevice[] }>((resolve) => {
          resolveSearch = resolve;
        }),
    );
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    service.getSDKInstance = jest.fn().mockResolvedValue({
      searchDevices: sdkSearchDevices,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);
    service.prepareHardwareTransport = jest
      .fn()
      .mockResolvedValue(EHardwareTransportType.WEBUSB);

    const searchTask = service.searchDevices({ transportType: 'usb' });
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    await expect(service.isDeviceSearchInProgress()).resolves.toBe(true);

    resolveSearch?.({ success: true, payload: [] });
    await searchTask;
    await expect(service.isDeviceSearchInProgress()).resolves.toBe(false);
  });

  it('locks an explicit BLE discovery to the BLE SDK transport', async () => {
    const sdkSearchDevices = jest.fn().mockResolvedValue({
      success: true,
      payload: [],
    });
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    const getSDKInstance = jest.fn().mockResolvedValue({
      searchDevices: sdkSearchDevices,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);
    const prepareHardwareTransport = jest
      .fn()
      .mockResolvedValue(EHardwareTransportType.DesktopWebBle);
    service.getSDKInstance = getSDKInstance;
    service.prepareHardwareTransport = prepareHardwareTransport;

    await service.searchDevices({ transportType: 'ble' });

    expect(prepareHardwareTransport).toHaveBeenCalledWith({
      connectProtocol: undefined,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      requestedTransportType: 'ble',
    });
    expect(getSDKInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      }),
    );
  });

  it('rejects a matching USB result while repairing bleConnectId', async () => {
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    const searchDevices = jest
      .spyOn(service, 'searchDevices')
      .mockResolvedValue({
        success: true,
        payload: [
          {
            connectId: 'PRB09B0088A',
            uuid: 'PRB09B0088A',
            deviceId: 'PRO2_DEVICE_ID',
            deviceType: 'pro2',
            name: 'Pro 2 0088',
            commType: 'webusb',
          } as SearchDevice,
        ],
      });
    const connect = jest.spyOn(service, 'connect');
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      await expect(
        service.repairBleConnectIdWithProgress({
          connectId: 'PRB09B0088A',
          featuresDeviceId: 'PRO2_DEVICE_ID',
          features: {
            bleName: 'Pro 2 0088',
            deviceId: 'PRO2_DEVICE_ID',
          } as IOneKeyDeviceFeaturesWithAppParams,
        }),
      ).rejects.toThrow();
    } finally {
      consoleError.mockRestore();
    }

    expect(searchDevices).toHaveBeenCalledWith({
      transportType: 'ble',
    });
    expect(connect).not.toHaveBeenCalled();
    expect(
      mockedLocalDb.updateDeviceBleConnectIdAndCleanStaleAliases.mock.calls,
    ).toHaveLength(0);
  });

  it('persists only the verified Noble peripheral ID as bleConnectId', async () => {
    const bleConnectId = 'f7e440001d2c1c79509d55dfdc8201ff';
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    const bleDevice = {
      connectId: bleConnectId,
      uuid: bleConnectId,
      deviceId: null,
      deviceType: 'pro2',
      name: 'Pro 2 0088',
      commType: 'electron-ble',
    } as SearchDevice;
    jest.spyOn(service, 'searchDevices').mockResolvedValue({
      success: true,
      payload: [bleDevice],
    });
    const connect = jest.spyOn(service, 'connect').mockResolvedValue({
      deviceId: 'PRO2_DEVICE_ID',
    } as never);
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-pro2-device',
    } as IDBDevice);

    await expect(
      service.repairBleConnectIdWithProgress({
        connectId: 'PRB09B0088A',
        featuresDeviceId: 'PRO2_DEVICE_ID',
        features: {
          bleName: 'Pro 2 0088',
          deviceId: 'PRO2_DEVICE_ID',
        } as IOneKeyDeviceFeaturesWithAppParams,
      }),
    ).resolves.toBe(bleConnectId);

    expect(connect).toHaveBeenCalledWith({
      device: {
        ...bleDevice,
        connectId: bleConnectId,
        deviceId: 'PRO2_DEVICE_ID',
      },
      forceProtocolDetection: true,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION_NO_BLE_DIALOG,
      hardwareTransportType: EHardwareTransportType.DesktopWebBle,
    });
    expect(
      mockedLocalDb.updateDeviceBleConnectIdAndCleanStaleAliases.mock.calls,
    ).toEqual([
      [
        {
          dbDeviceId: 'db-pro2-device',
          bleConnectId,
          verifiedDeviceId: 'PRO2_DEVICE_ID',
        },
      ],
    ]);
  });

  it('matches compact and spaced Pro2 BLE names when repairing bleConnectId', async () => {
    const bleConnectId = 'f7e440001d2c1c79509d55dfdc8201ff';
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    const bleDevice = {
      connectId: bleConnectId,
      uuid: bleConnectId,
      deviceId: null,
      deviceType: 'pro2',
      name: 'Pro 2 0088',
      commType: 'electron-ble',
    } as SearchDevice;
    jest.spyOn(service, 'searchDevices').mockResolvedValue({
      success: true,
      payload: [bleDevice],
    });
    const connect = jest.spyOn(service, 'connect').mockResolvedValue({
      deviceId: 'PRO2_DEVICE_ID',
    } as never);
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-pro2-device',
    } as IDBDevice);

    await expect(
      service.repairBleConnectIdWithProgress({
        connectId: 'PRB09B0088A',
        featuresDeviceId: 'PRO2_DEVICE_ID',
        features: {
          bleName: 'Pro2 0088',
          deviceId: 'PRO2_DEVICE_ID',
        } as IOneKeyDeviceFeaturesWithAppParams,
      }),
    ).resolves.toBe(bleConnectId);

    expect(connect).toHaveBeenCalledWith({
      device: {
        ...bleDevice,
        connectId: bleConnectId,
        deviceId: 'PRO2_DEVICE_ID',
      },
      forceProtocolDetection: true,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION_NO_BLE_DIALOG,
      hardwareTransportType: EHardwareTransportType.DesktopWebBle,
    });
  });

  it('waits for the desktop Noble scan-stop callback', async () => {
    let resolveStopScan: () => void = () => undefined;
    const stopScan = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveStopScan = resolve;
        }),
    );
    const globalWithDesktopApi = globalThis as unknown as {
      desktopApi: { nobleBle?: { stopScan: () => Promise<void> } } | undefined;
    };
    const originalDesktopApi = globalWithDesktopApi.desktopApi;
    globalWithDesktopApi.desktopApi = { nobleBle: { stopScan } };

    try {
      const service = new ServiceHardware({
        backgroundApi: {} as unknown as IBackgroundApi,
      });
      const stopped = jest.fn();
      const stopPromise = service.stopDeviceScan().then(stopped);

      await Promise.resolve();
      expect(stopScan).toHaveBeenCalledTimes(1);
      expect(stopped).not.toHaveBeenCalled();

      resolveStopScan();
      await stopPromise;

      expect(stopped).toHaveBeenCalledTimes(1);
    } finally {
      globalWithDesktopApi.desktopApi = originalDesktopApi;
    }
  });
});

describe('ServiceHardware.getDeviceStateWithUnlock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('unlocks once and rereads the canonical state', async () => {
    const lockedState = {
      status: { initialized: true, unlocked: false },
    } as Awaited<ReturnType<ServiceHardware['getDeviceState']>>;
    const unlockedState = {
      status: { initialized: true, unlocked: true },
    } as Awaited<ReturnType<ServiceHardware['getDeviceState']>>;
    const service = new ServiceHardware({
      backgroundApi: {
        serviceHardwareUI: {
          runExclusiveOneKeyOperation: jest.fn(
            async (operation: (lease: object) => Promise<unknown>) =>
              operation({ deviceKey: 'PRO2_USB', owner: Symbol('test') }),
          ),
        },
      } as unknown as IBackgroundApi,
    });

    service.getCompatibleConnectId = jest.fn().mockResolvedValue('PRO2_USB');
    const getDeviceState = jest
      .spyOn(service, 'getDeviceState')
      .mockResolvedValueOnce(lockedState)
      .mockResolvedValueOnce(unlockedState);
    const unlockDevice = jest
      .spyOn(service, 'unlockDevice')
      .mockResolvedValue({} as never);

    await expect(
      service.getDeviceStateWithUnlock({
        connectId: 'ORIGINAL_CONNECT_ID',
        params: { scope: 'runtime' },
      }),
    ).resolves.toBe(unlockedState);

    expect(unlockDevice).toHaveBeenCalledTimes(1);
    expect(unlockDevice).toHaveBeenCalledWith({
      connectId: 'PRO2_USB',
    });
    expect(getDeviceState).toHaveBeenCalledTimes(2);
  });

  it('returns an already-unlocked state without requesting another unlock', async () => {
    const unlockedState = {
      status: { initialized: true, unlocked: true },
    } as Awaited<ReturnType<ServiceHardware['getDeviceState']>>;
    const service = new ServiceHardware({
      backgroundApi: {
        serviceHardwareUI: {
          runExclusiveOneKeyOperation: jest.fn(
            async (operation: (lease: object) => Promise<unknown>) =>
              operation({ deviceKey: 'PRO2_USB', owner: Symbol('test') }),
          ),
        },
      } as unknown as IBackgroundApi,
    });

    service.getCompatibleConnectId = jest.fn().mockResolvedValue('PRO2_USB');
    const getDeviceState = jest
      .spyOn(service, 'getDeviceState')
      .mockResolvedValue(unlockedState);
    const unlockDevice = jest
      .spyOn(service, 'unlockDevice')
      .mockResolvedValue({} as never);

    await expect(
      service.getDeviceStateWithUnlock({
        connectId: 'ORIGINAL_CONNECT_ID',
        pinType: DeviceSessionPinType.Any,
        params: { scope: 'runtime' },
      }),
    ).resolves.toBe(unlockedState);

    expect(unlockDevice).not.toHaveBeenCalled();
    expect(getDeviceState).toHaveBeenCalledTimes(1);
  });

  it('forwards an explicit PIN type before rereading the canonical state', async () => {
    const lockedState = {
      status: { initialized: true, unlocked: false },
    } as Awaited<ReturnType<ServiceHardware['getDeviceState']>>;
    const unlockedState = {
      status: {
        initialized: true,
        unlocked: true,
        unlockedAttachPin: true,
      },
    } as Awaited<ReturnType<ServiceHardware['getDeviceState']>>;
    const service = new ServiceHardware({
      backgroundApi: {
        serviceHardwareUI: {
          runExclusiveOneKeyOperation: jest.fn(
            async (operation: (lease: object) => Promise<unknown>) =>
              operation({ deviceKey: 'PRO2_USB', owner: Symbol('test') }),
          ),
        },
      } as unknown as IBackgroundApi,
    });

    service.getCompatibleConnectId = jest.fn().mockResolvedValue('PRO2_USB');
    const getDeviceState = jest
      .spyOn(service, 'getDeviceState')
      .mockResolvedValueOnce(lockedState)
      .mockResolvedValueOnce(unlockedState);
    const unlockDevice = jest
      .spyOn(service, 'unlockDevice')
      .mockResolvedValue({} as never);

    await expect(
      service.getDeviceStateWithUnlock({
        connectId: 'ORIGINAL_CONNECT_ID',
        pinType: DeviceSessionPinType.Any,
        params: { scope: 'runtime' },
      }),
    ).resolves.toBe(unlockedState);

    expect(unlockDevice).toHaveBeenCalledWith({
      connectId: 'PRO2_USB',
      pinType: DeviceSessionPinType.Any,
    });
    expect(getDeviceState).toHaveBeenCalledTimes(2);
  });

  it('does not request an unlock before the device wallet is initialized', async () => {
    const uninitializedState = {
      status: { initialized: false, unlocked: false },
    } as Awaited<ReturnType<ServiceHardware['getDeviceState']>>;
    const service = new ServiceHardware({
      backgroundApi: {
        serviceHardwareUI: {
          runExclusiveOneKeyOperation: jest.fn(
            async (operation: (lease: object) => Promise<unknown>) =>
              operation({ deviceKey: 'PRO2_USB', owner: Symbol('test') }),
          ),
        },
      } as unknown as IBackgroundApi,
    });

    service.getCompatibleConnectId = jest.fn().mockResolvedValue('PRO2_USB');
    const getDeviceState = jest
      .spyOn(service, 'getDeviceState')
      .mockResolvedValue(uninitializedState);
    const unlockDevice = jest
      .spyOn(service, 'unlockDevice')
      .mockResolvedValue({} as never);

    await expect(
      service.getDeviceStateWithUnlock({
        connectId: 'ORIGINAL_CONNECT_ID',
        params: { scope: 'runtime' },
      }),
    ).rejects.toThrow('Device is not initialized');

    expect(unlockDevice).not.toHaveBeenCalled();
    expect(getDeviceState).toHaveBeenCalledTimes(1);
  });
});

describe('ServiceHardware.unlockDevice', () => {
  it('passes the explicit PIN type to the hardware SDK', async () => {
    const deviceUnlock = jest.fn().mockResolvedValue({
      success: true,
      payload: { unlocked: true },
    });
    const service = new ServiceHardware({
      backgroundApi: {} as unknown as IBackgroundApi,
    });
    service.getCompatibleConnectId = jest.fn().mockResolvedValue('PRO2_USB');
    service.getSDKInstance = jest.fn().mockResolvedValue({
      deviceUnlock,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);

    await service.unlockDevice({
      connectId: 'ORIGINAL_CONNECT_ID',
      pinType: DeviceSessionPinType.Any,
    });

    expect(deviceUnlock).toHaveBeenCalledWith('PRO2_USB', {
      pinType: DeviceSessionPinType.Any,
    });
  });
});
