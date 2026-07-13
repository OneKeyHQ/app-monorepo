import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  checkBLEPermissions,
  checkBLEState,
} from '@onekeyhq/shared/src/hardware/blePermissions';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import {
  EHardwareCallContext,
  EHardwareVendor,
} from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import { HardwareConnectionManager } from './HardwareConnectionManager';
import ServiceHardware from './ServiceHardware';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice } from '../../dbs/local/types';

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
  settingsPersistAtom: {},
}));

const mockedLocalDb = jest.mocked(localDb);
const mockedCheckBLEPermissions = jest.mocked(checkBLEPermissions);
const mockedCheckBLEState = jest.mocked(checkBLEState);
const mockedAppEventBus = jest.mocked(appEventBus);
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
    mockedCheckBLEPermissions.mockResolvedValue(true);
    mockedCheckBLEState.mockResolvedValue(true);
  });

  it('uses a bound Trezor BLE connectId when desktop BLE is selected', async () => {
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
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
    } as IDBDevice);

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
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
    ).resolves.toBe('BLE_ID');
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
});
