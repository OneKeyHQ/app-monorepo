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

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
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
  settingsPersistAtom: {},
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
const mockedAppEventBus = jest.mocked(appEventBus);
const mockedAxios = jest.mocked(axios);
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
    mockedAxios.post.mockReset();
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

  it('does not let an unrelated Pro 2 WebUSB device take over a Pro BLE call', async () => {
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
      ).resolves.toBe('PRO_BLE_PERIPHERAL_ID');
      expect(detectBluetoothAvailability).toHaveBeenCalledTimes(1);
    } finally {
      if (originalNavigator) {
        Object.defineProperty(globalThis, 'navigator', originalNavigator);
      } else {
        delete (globalThis as { navigator?: Navigator }).navigator;
      }
    }
  });

  it('does not let an unrelated Bridge device take over a Pro BLE call', async () => {
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
    ).resolves.toBe('PRO_BLE_PERIPHERAL_ID');
    expect(detectBluetoothAvailability).toHaveBeenCalledTimes(1);
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
    service.connectionManager.setCurrentTransportType(
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

    const packageBytes = new Uint8Array([1, 2, 3]).buffer;

    await expect(
      service.uploadPortfolioPackage({
        connectId: 'ONEKEY_USB',
        packageBytes,
      }),
    ).resolves.toEqual({ portfolioUpdated: true });

    expect(getCompatibleConnectId).toHaveBeenCalledWith({
      connectId: 'ONEKEY_USB',
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
    });
    expect(getSDKInstance).toHaveBeenCalledWith({
      connectId: 'ONEKEY_USB',
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
    });
    expect(uploadPortfolio).toHaveBeenCalledWith('ONEKEY_USB', {
      packageBytes,
    });
  });

  it('ignores an explicit protocol selection during Pro 2 discovery', async () => {
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
    service.getSDKInstance = getSDKInstance;

    await expect(
      service.searchDevices({ connectProtocol: 'V2' }),
    ).resolves.toEqual({ success: true, payload: [] });

    expect(searchDevices).toHaveBeenCalledWith();
    expect(getSDKInstance).toHaveBeenCalledWith({
      connectId: undefined,
    });
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
    service.getDeviceState = jest
      .fn()
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
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    expect(service.getDeviceState).toHaveBeenCalledTimes(2);
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
    service.getDeviceState = jest
      .fn()
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
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    expect(service.getDeviceState).toHaveBeenCalledTimes(2);
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
    service.getDeviceState = jest.fn().mockResolvedValue(uninitializedState);
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
    // oxlint-disable-next-line typescript/unbound-method -- Jest mock does not depend on a bound this
    expect(service.getDeviceState).toHaveBeenCalledTimes(1);
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
