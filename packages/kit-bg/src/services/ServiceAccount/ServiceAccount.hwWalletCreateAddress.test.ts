import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

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
  default: {
    createHwWallet: jest.fn(),
  },
}));

type IHwWalletCreateAddressService = {
  createHWWalletBase(params: unknown): Promise<{ wallet: { name: string } }>;
  setWalletNameAndAvatar(params: unknown): Promise<{ name: string }>;
  getWallet(params: unknown): Promise<{ name: string }>;
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
  const createHwWalletMock = jest.spyOn(localDb, 'createHwWallet');

  beforeEach(() => {
    createHwWalletMock.mockReset();
  });

  it('persists the current Pro2 label after reading the stored wallet name', async () => {
    createHwWalletMock.mockResolvedValue({
      wallet: { id: 'hw-wallet-1', name: 'Previous device name' },
    } as never);
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId: jest.fn().mockResolvedValue('PRO2_USB'),
        },
      },
    }) as unknown as IHwWalletCreateAddressService;
    const setWalletNameAndAvatarMock = jest.fn().mockResolvedValue({
      id: 'hw-wallet-1',
      name: 'Current device name',
    });
    service.setWalletNameAndAvatar = setWalletNameAndAvatarMock;

    await expect(
      service.createHWWalletBase({
        device: { connectId: 'PRO2_USB', deviceId: 'PRO2_DEVICE_ID' },
        features: { deviceId: 'PRO2_DEVICE_ID' },
        deviceState: {
          protocol: 'V2',
          identity: {
            deviceId: 'PRO2_DEVICE_ID',
            label: 'Current device name',
          },
        },
        isMockedStandardHwWallet: true,
      }),
    ).resolves.toMatchObject({ wallet: { name: 'Current device name' } });
    expect(setWalletNameAndAvatarMock).toHaveBeenCalledWith({
      walletId: 'hw-wallet-1',
      name: 'Current device name',
      shouldCheckDuplicate: false,
    });
  });

  it('keeps wallet creation successful when Pro2 label persistence fails', async () => {
    createHwWalletMock.mockResolvedValue({
      wallet: { id: 'hw-wallet-1', name: 'Previous device name' },
    } as never);
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId: jest.fn().mockResolvedValue('PRO2_USB'),
        },
      },
    }) as unknown as IHwWalletCreateAddressService;
    service.setWalletNameAndAvatar = jest
      .fn()
      .mockRejectedValue(new Error('sync failed'));
    const getWalletMock = jest.fn().mockResolvedValue({
      id: 'hw-wallet-1',
      name: 'Previous device name',
    });
    service.getWallet = getWalletMock;

    await expect(
      service.createHWWalletBase({
        device: { connectId: 'PRO2_USB', deviceId: 'PRO2_DEVICE_ID' },
        features: { deviceId: 'PRO2_DEVICE_ID' },
        deviceState: {
          protocol: 'V2',
          identity: {
            deviceId: 'PRO2_DEVICE_ID',
            label: 'Current device name',
          },
        },
        isMockedStandardHwWallet: true,
      }),
    ).resolves.toMatchObject({ wallet: { name: 'Previous device name' } });
    expect(getWalletMock).toHaveBeenCalledWith({
      walletId: 'hw-wallet-1',
    });
  });

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

  it('创建 Pro2 隐藏钱包时复用已同步的 post-unlock 状态', async () => {
    const postUnlockState = {
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
    const getDeviceState = jest.fn();
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
          deviceStateInfo: postUnlockState,
        },
        compatibleConnectId: 'PRO2_USB',
      }),
    ).resolves.toMatchObject({
      protocol: 'V2',
      deviceId: 'PRO2_DEVICE_ID',
    });

    expect(getDeviceState).not.toHaveBeenCalled();
  });

  it('创建 Pro2 隐藏钱包记录时不重复读取设备状态', async () => {
    createHwWalletMock.mockResolvedValue({
      wallet: { id: 'hw-hidden-wallet-1', name: 'Hidden Wallet' },
    } as never);
    const getDeviceState = jest.fn();
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId: jest.fn().mockResolvedValue('PRO2_USB'),
          getDeviceState,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;
    service.getWallet = jest.fn().mockResolvedValue({
      id: 'hw-hidden-wallet-1',
      name: 'Hidden Wallet',
    });
    const postUnlockState = {
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
        unlockedAttachPin: false,
        passphraseProtection: true,
      },
      settings: {},
      versions: { firmware: '1.0.0' },
    };

    await service.createHWWalletBase({
      device: {
        connectId: 'PRO2_USB',
        deviceId: 'PRO2_DEVICE_ID',
        vendor: EHardwareVendor.onekey,
      },
      features: { deviceId: 'PRO2_DEVICE_ID' },
      connectProtocol: 'V2',
      deviceState: postUnlockState,
      passphraseState: 'PRO2_HIDDEN_STATE',
      fillingXfpByCallingSdk: false,
      vendor: EHardwareVendor.onekey,
    });

    expect(getDeviceState).not.toHaveBeenCalled();
    expect(createHwWalletMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceState: postUnlockState,
        passphraseState: 'PRO2_HIDDEN_STATE',
      }),
    );
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

  it('creates a mocked standard wallet without opening its device session', async () => {
    createHwWalletMock.mockImplementation(async (params) => {
      expect(params.getFirstEvmAddressFn).toEqual(expect.any(Function));
      if (params.getFirstEvmAddressFn) {
        await expect(params.getFirstEvmAddressFn()).resolves.toBe('');
      }
      return {
        wallet: { id: 'hw-standard-mocked', name: 'Trezor' },
      } as never;
    });
    const buildHwWalletXfp = jest.fn();
    const getEvmAddressByWalletState = jest.fn();
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId: jest.fn().mockResolvedValue('TREZOR_USB'),
          buildHwWalletXfp,
          getEvmAddressByWalletState,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;
    service.getWallet = jest.fn().mockResolvedValue({
      id: 'hw-standard-mocked',
      name: 'Trezor',
    });

    await expect(
      service.createHWWalletBase({
        device: {
          connectId: 'TREZOR_USB',
          deviceId: 'TREZOR_DEVICE_ID',
          vendor: EHardwareVendor.trezor,
        },
        features: { deviceId: 'TREZOR_DEVICE_ID' },
        vendor: EHardwareVendor.trezor,
        fillingXfpByCallingSdk: true,
        isMockedStandardHwWallet: true,
      }),
    ).resolves.toMatchObject({ wallet: { id: 'hw-standard-mocked' } });

    expect(buildHwWalletXfp).not.toHaveBeenCalled();
    expect(getEvmAddressByWalletState).not.toHaveBeenCalled();
  });
});
