import {
  EHardwareCallContext,
  EHardwareVendor,
} from '@onekeyhq/shared/types/device';

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
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHwWallet: jest.fn(() => true),
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

jest.mock('../../states/jotai/atoms', () => ({
  EHardwareUiStateAction: {},
  hardwareForceTransportAtom: {
    get: jest.fn(async () => ({ forceTransportType: undefined })),
  },
  hardwareUiStateAtom: {},
  hardwareUiStateCompletedAtom: {},
  settingsPersistAtom: {},
}));

function buildDevice(vendor: EHardwareVendor): IDBDevice {
  return {
    id: 'db-device-1',
    connectId: 'USB_ID',
    deviceId: 'FEATURES_DEVICE_ID',
    vendor,
    name: 'Hardware Device',
    features: '{}',
    settingsRaw: '{}',
    createdAt: 0,
    updatedAt: 0,
  } as IDBDevice;
}

function buildService(device: IDBDevice) {
  const getWalletDeviceParams = jest.fn(async () => ({
    dbDevice: device,
    deviceCommonParams: {
      passphraseState: 'PASSPHRASE_STATE',
    },
  }));
  const service = new ServiceHardware({
    backgroundApi: {
      serviceAccount: {
        getWalletDeviceParams,
      },
    } as unknown as IBackgroundApi,
  });
  const preInitialize = jest.fn(async () => undefined);
  const getSDKInstance = jest
    .spyOn(service, 'getSDKInstance')
    .mockResolvedValue({
      preInitialize,
    } as unknown as Awaited<ReturnType<ServiceHardware['getSDKInstance']>>);

  return { getSDKInstance, getWalletDeviceParams, preInitialize, service };
}

describe('ServiceHardware.preInitializeDeviceForSign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips OneKey SDK pre-initialize for third-party devices', async () => {
    const { getSDKInstance, getWalletDeviceParams, preInitialize, service } =
      buildService(buildDevice(EHardwareVendor.trezor));

    await service.preInitializeDeviceForSign({ walletId: 'hw-1' });

    expect(getWalletDeviceParams).toHaveBeenCalledWith({
      walletId: 'hw-1',
      hardwareCallContext: EHardwareCallContext.SILENT_CALL,
    });
    expect(getSDKInstance).not.toHaveBeenCalled();
    expect(preInitialize).not.toHaveBeenCalled();
  });

  it('keeps OneKey SDK pre-initialize for OneKey devices', async () => {
    const { getSDKInstance, preInitialize, service } = buildService(
      buildDevice(EHardwareVendor.onekey),
    );

    await service.preInitializeDeviceForSign({ walletId: 'hw-1' });

    expect(getSDKInstance).toHaveBeenCalledWith({
      connectId: 'USB_ID',
      hardwareCallContext: EHardwareCallContext.SILENT_CALL,
    });
    expect(preInitialize).toHaveBeenCalledWith('USB_ID', {
      passphraseState: 'PASSPHRASE_STATE',
    });
  });
});
