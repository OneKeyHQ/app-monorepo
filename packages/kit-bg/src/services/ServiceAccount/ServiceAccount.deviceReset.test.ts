import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { DeviceNotSame } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations, LOCALES } from '@onekeyhq/shared/src/locale';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import ServiceAccount from './ServiceAccount';

const mockBatchGetAddresses = jest.fn();

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
    removeWallet: jest.fn(),
    updateDeviceConnectProtocol: jest.fn(),
  },
}));

jest.mock('../../vaults/factory', () => ({
  vaultFactory: {
    getWalletOnlyVault: jest.fn(async () => ({
      keyring: {
        batchGetAddresses: mockBatchGetAddresses,
      },
    })),
  },
}));

async function expectDeviceResetChinesePrompt(error: unknown) {
  expect(error).toBeInstanceOf(DeviceNotSame);
  expect((error as DeviceNotSame).key).toBe(
    ETranslations.hardware_device_information_is_inconsistent_it_may_be_caused_by_device_reset,
  );
  const zhCNMessages = await LOCALES['zh-CN']();
  expect(
    zhCNMessages[
      ETranslations
        .hardware_device_information_is_inconsistent_it_may_be_caused_by_device_reset
    ],
  ).toBe(
    '设备连接状态已更新。请选择「添加钱包」>「连接硬件钱包」来重新设置。使用原助记词将恢复当前钱包，使用新助记词将创建新钱包。',
  );
}

describe('ServiceAccount device reset isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps standard and hidden hardware wallets when filtering QR wallets for reset reconciliation', async () => {
    const service = new ServiceAccount({
      backgroundApi: {},
    });
    const standardWallet = {
      id: 'hw-standard',
      associatedDevice: 'db-device-standard',
    };
    const hiddenWallet = {
      id: 'hw-hidden',
      associatedDevice: 'db-device-hidden',
      passphraseState: 'hidden-state',
    };
    const qrWallet = {
      id: 'qr-wallet',
      associatedDevice: 'db-device-qr',
    };
    const standardDevice = { id: standardWallet.associatedDevice };
    const hiddenDevice = { id: hiddenWallet.associatedDevice };
    const qrDevice = { id: qrWallet.associatedDevice };
    service.getAllWallets = jest.fn().mockResolvedValue({
      wallets: [standardWallet, hiddenWallet, qrWallet],
      allDevices: [standardDevice, hiddenDevice, qrDevice],
    });

    await expect(
      service.getAllHwQrWalletWithDevice({
        filterHiddenWallet: false,
        filterQrWallet: true,
      }),
    ).resolves.toEqual({
      [standardWallet.id]: {
        wallet: standardWallet,
        device: standardDevice,
      },
      [hiddenWallet.id]: {
        wallet: hiddenWallet,
        device: hiddenDevice,
      },
    });
  });

  it('在接收地址入口将已确认 deviceId 不一致的 deprecated 钱包映射为中文设备重置提示', async () => {
    const service = new ServiceAccount({
      backgroundApi: {
        servicePassword: {
          promptPasswordVerifyByWallet: jest.fn(
            async ({ walletId }: { walletId: string }) => ({
              password: '',
              isHardware: true,
              isQrWallet: false,
              deviceParams: await service.getWalletDeviceParams({
                walletId,
                hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
              }),
            }),
          ),
        },
        serviceHardware: {
          getCompatibleConnectId: jest.fn().mockResolvedValue('PRO2_USB'),
        },
      },
    });
    service.getWallet = jest.fn().mockResolvedValue({
      id: 'hw-wallet-1',
      deprecated: true,
      associatedDevice: 'db-device-1',
    });
    const getWalletDevice = jest.fn().mockResolvedValue({
      id: 'db-device-1',
      connectId: 'PRO2_USB',
      deviceId: 'OLD_DEVICE_ID',
    });
    service.getWalletDevice = getWalletDevice;

    const error = await service
      .verifyHWAccountAddresses({
        walletId: 'hw-wallet-1',
        networkId: 'evm--1',
        indexes: [0],
        indexedAccountId: undefined,
        deriveType: 'default',
      })
      .catch((e: unknown) => e);

    await expectDeviceResetChinesePrompt(error);
    expect(getWalletDevice).not.toHaveBeenCalled();
  });

  it('接收地址实时校验发现 deviceId 不一致时透传中文设备重置提示', async () => {
    mockBatchGetAddresses.mockRejectedValueOnce(
      convertDeviceError({
        code: HardwareErrorCode.DeviceCheckDeviceIdError,
        error: 'Device Id in the features is not same.',
        connectId: 'PRO2_USB',
        deviceId: 'NEW_DEVICE_ID',
      }),
    );
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardwareUI: {
          withHardwareProcessing: jest.fn(
            async (operation: () => Promise<unknown>) => operation(),
          ),
        },
        serviceNetwork: {
          getVaultSettings: jest.fn().mockResolvedValue({
            accountType: 'simple',
          }),
        },
      },
    });
    service.getPrepareHDOrHWAccountsParams = jest.fn().mockResolvedValue({
      prepareParams: {
        indexes: [0],
      },
      deviceParams: {
        dbDevice: {
          id: 'db-device-1',
        },
      },
      networkId: 'evm--1',
      walletId: 'hw-wallet-1',
    });

    const error = await service
      .verifyHWAccountAddresses({
        walletId: 'hw-wallet-1',
        networkId: 'evm--1',
        indexes: [0],
        indexedAccountId: undefined,
        deriveType: 'default',
      })
      .catch((e: unknown) => e);

    await expectDeviceResetChinesePrompt(error);
  });

  it('在创建隐藏钱包前拒绝已被设备重置标记为 deprecated 的钱包', async () => {
    const service = new ServiceAccount({
      backgroundApi: {},
    });
    service.getWallet = jest.fn().mockResolvedValue({
      id: 'hw-wallet-1',
      deprecated: true,
      associatedDevice: 'db-device-1',
    });
    const getWalletDevice = jest.fn();
    service.getWalletDevice = getWalletDevice;

    const error = await service
      .createHWHiddenWallet({ walletId: 'hw-wallet-1' })
      .catch((e: unknown) => e);

    await expectDeviceResetChinesePrompt(error);
    expect(getWalletDevice).not.toHaveBeenCalled();
  });

  it('允许使用 mocked 标准钱包作为隐藏钱包创建占位记录', async () => {
    const service = new ServiceAccount({
      backgroundApi: {},
    });
    service.getWallet = jest.fn().mockResolvedValue({
      id: 'hw-wallet-1',
      deprecated: false,
      isMocked: true,
      associatedDevice: 'db-device-1',
    });
    const getWalletDevice = jest
      .fn()
      .mockRejectedValue(new Error('reached device lookup'));
    service.getWalletDevice = getWalletDevice;

    const error = await service
      .createHWHiddenWallet({ walletId: 'hw-wallet-1' })
      .catch((e: unknown) => e);

    expect(error).toEqual(new Error('reached device lookup'));
    expect(getWalletDevice).toHaveBeenCalledWith({ walletId: 'hw-wallet-1' });
  });

  it('允许移除已被设备重置标记为 deprecated 的硬件钱包', async () => {
    const promptPasswordVerifyByWallet = jest.fn();
    const service = new ServiceAccount({
      backgroundApi: {
        servicePassword: {
          promptPasswordVerifyByWallet,
        },
        serviceDApp: {
          removeDappConnectionAfterWalletRemove: jest.fn(),
        },
        serviceDBBackup: {
          removeBackupHDWallet: jest.fn(),
        },
      },
    });
    service.getWalletSafe = jest.fn().mockResolvedValue({
      id: 'hw-wallet-1',
      deprecated: true,
      associatedDevice: 'db-device-1',
    });
    service.cleanupOrphanedHyperLiquidAgentCredentials = jest.fn();

    await service.removeWallet({ walletId: 'hw-wallet-1' });

    expect(promptPasswordVerifyByWallet).not.toHaveBeenCalled();
    expect(jest.mocked(localDb).removeWallet.mock.calls).toContainEqual([
      {
        walletId: 'hw-wallet-1',
        isRemoveToMocked: undefined,
      },
    ]);
  });
});
