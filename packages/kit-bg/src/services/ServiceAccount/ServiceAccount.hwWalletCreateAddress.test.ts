import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import ServiceAccount from './ServiceAccount';

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
    AccountUpdate: 'AccountUpdate',
    WalletUpdate: 'WalletUpdate',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

type IHwWalletCreateAddressService = {
  getFeaturesForHwWalletCreate(params: {
    dbDevice: {
      vendor: EHardwareVendor;
      connectProtocol: 'V1' | 'V2';
      deviceStateInfo: unknown;
    };
    compatibleConnectId: string;
  }): Promise<{
    protocol?: string;
    deviceId?: string;
  }>;
  getFirstEvmAddressForHwWalletCreate(params: {
    compatibleConnectId: string;
    deviceId: string;
    passphraseState?: string;
    vendor?: EHardwareVendor;
    isMockedStandardHwWallet?: boolean;
  }): Promise<string | null>;
};

describe('ServiceAccount hardware wallet creation address', () => {
  it('创建 Pro1 隐藏钱包时复用已持久化状态，避免打断刚建立的 passphrase 会话', async () => {
    const getDeviceState = jest.fn();
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getDeviceState,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;
    const deviceStateInfo = {
      schemaVersion: 1,
      revision: 1,
      updatedAt: 1,
      protocol: 'V1',
      identity: {
        deviceId: 'PRO1_DEVICE_ID',
        serialNo: 'PRO1_SERIAL',
      },
      status: {
        mode: 'normal',
        unlocked: true,
        passphraseProtection: true,
      },
      settings: {},
      versions: {
        firmware: '4.15.0',
      },
    };

    await expect(
      service.getFeaturesForHwWalletCreate({
        dbDevice: {
          vendor: EHardwareVendor.onekey,
          connectProtocol: 'V1',
          deviceStateInfo,
        },
        compatibleConnectId: 'PRO1_USB',
      }),
    ).resolves.toMatchObject({
      protocol: 'V1',
      deviceId: 'PRO1_DEVICE_ID',
    });

    expect(getDeviceState).not.toHaveBeenCalled();
  });

  it('创建 Pro2 隐藏钱包时仍读取实时设备状态', async () => {
    const liveState = {
      schemaVersion: 1,
      revision: 2,
      updatedAt: 2,
      protocol: 'V2',
      identity: {
        deviceId: 'PRO2_DEVICE_ID',
        serialNo: 'PRO2_SERIAL',
      },
      status: {
        mode: 'normal',
        unlocked: true,
        passphraseProtection: true,
      },
      settings: {},
      versions: {
        firmware: '1.0.0',
      },
    };
    const getDeviceState = jest.fn().mockResolvedValue(liveState);
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getDeviceState,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;

    await expect(
      service.getFeaturesForHwWalletCreate({
        dbDevice: {
          vendor: EHardwareVendor.onekey,
          connectProtocol: 'V2',
          deviceStateInfo: {
            ...liveState,
            revision: 1,
            identity: {
              ...liveState.identity,
              deviceId: 'STALE_DEVICE_ID',
            },
          },
        },
        compatibleConnectId: 'PRO2_USB',
      }),
    ).resolves.toMatchObject({
      protocol: 'V2',
      deviceId: 'PRO2_DEVICE_ID',
    });

    expect(getDeviceState).toHaveBeenCalledWith({
      connectId: 'PRO2_USB',
    });
  });

  it('derives a OneKey hidden wallet address from its passphrase state', async () => {
    const getEvmAddressByWalletState = jest.fn().mockResolvedValue('0xhidden');
    const getEvmAddressByStandardWallet = jest
      .fn()
      .mockResolvedValue('0xstandard');
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getEvmAddressByWalletState,
          getEvmAddressByStandardWallet,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;

    await expect(
      service.getFirstEvmAddressForHwWalletCreate({
        compatibleConnectId: 'PRO2_USB',
        deviceId: 'PRO2_DEVICE_ID',
        passphraseState: 'PRO2_HIDDEN_STATE',
        vendor: EHardwareVendor.onekey,
      }),
    ).resolves.toBe('0xhidden');

    expect(getEvmAddressByWalletState).toHaveBeenCalledWith({
      connectId: 'PRO2_USB',
      deviceId: 'PRO2_DEVICE_ID',
      path: "m/44'/60'/0'/0/0",
      vendor: EHardwareVendor.onekey,
      passphraseState: 'PRO2_HIDDEN_STATE',
      useEmptyPassphrase: undefined,
    });
    expect(getEvmAddressByStandardWallet).not.toHaveBeenCalled();
  });

  it('keeps standard wallet creation on the empty passphrase', async () => {
    const getEvmAddressByWalletState = jest
      .fn()
      .mockResolvedValue('0xstandard');
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getEvmAddressByWalletState,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;

    await expect(
      service.getFirstEvmAddressForHwWalletCreate({
        compatibleConnectId: 'PRO2_USB',
        deviceId: 'PRO2_DEVICE_ID',
        vendor: EHardwareVendor.onekey,
      }),
    ).resolves.toBe('0xstandard');

    expect(getEvmAddressByWalletState).toHaveBeenCalledWith({
      connectId: 'PRO2_USB',
      deviceId: 'PRO2_DEVICE_ID',
      path: "m/44'/60'/0'/0/0",
      vendor: EHardwareVendor.onekey,
      passphraseState: undefined,
      useEmptyPassphrase: true,
    });
  });
});
