import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
    removeWallets: jest.fn(),
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

  describe('forgetting a physical device', () => {
    function setup() {
      const old = {
        id: 'hw-old',
        deprecated: true,
        associatedDevice: 'db-old',
      };
      const current = { id: 'hw-current', associatedDevice: 'db-current' };
      const hidden = {
        id: 'hw-old-hidden',
        passphraseState: 'hidden',
        associatedDevice: 'db-old',
      };
      const qr = { id: 'qr-wallet', associatedDevice: 'db-current' };
      const other = { id: 'hw-other', associatedDevice: 'db-other' };
      const wallets = [old, current, hidden, qr, other];
      const verify = jest.fn();
      const cleanupDapp = jest.fn();
      const cleanupBackup = jest.fn();
      const cleanupCredentials = jest.fn();
      const service = new ServiceAccount({
        backgroundApi: {
          servicePassword: { promptPasswordVerifyByWallet: verify },
          serviceDApp: { removeDappConnectionAfterWalletRemove: cleanupDapp },
          serviceDBBackup: { removeBackupHDWallet: cleanupBackup },
        },
      });
      service.getAllWallets = jest.fn().mockResolvedValue({
        wallets,
        allDevices: [
          { id: 'db-old', uuid: 'SERIAL', deviceId: 'old-id' },
          { id: 'db-current', uuid: 'SERIAL', deviceId: 'new-id' },
          { id: 'db-other', uuid: 'OTHER', deviceId: 'other-id' },
        ],
      });
      service.getWalletSafe = jest
        .fn()
        .mockImplementation(async ({ walletId }) =>
          wallets.find((wallet) => wallet.id === walletId),
        );
      service.cleanupOrphanedHyperLiquidAgentCredentials = cleanupCredentials;
      return {
        service,
        verify,
        cleanupDapp,
        cleanupBackup,
        cleanupCredentials,
      };
    }

    it('keeps every wallet when the active device check fails after an old record', async () => {
      const { service, verify } = setup();
      verify.mockRejectedValueOnce(new Error('Device check cancelled'));
      await expect(
        service.removeWallet({
          walletId: 'hw-old',
          removeSameDeviceWallets: true,
        }),
      ).rejects.toThrow('Device check cancelled');
      expect(verify).toHaveBeenCalledWith({
        walletId: 'hw-current',
        hardwareCallContext: EHardwareCallContext.BACKGROUND_TASK,
      });
      expect(jest.mocked(localDb).removeWallet.mock.calls).toHaveLength(0);
      expect(jest.mocked(localDb).removeWallets.mock.calls).toHaveLength(0);
    });

    it('removes matching standard HW wallets together and preserves QR and other devices', async () => {
      const { service, verify, cleanupDapp } = setup();
      verify.mockImplementationOnce(async () => {
        expect(jest.mocked(localDb).removeWallets.mock.calls).toHaveLength(0);
      });
      await service.removeWallet({
        walletId: 'hw-old',
        removeSameDeviceWallets: true,
      });
      expect(verify).toHaveBeenCalledTimes(1);
      expect(jest.mocked(localDb).removeWallet.mock.calls).toHaveLength(0);
      expect(jest.mocked(localDb).removeWallets.mock.calls).toHaveLength(1);
      expect(jest.mocked(localDb).removeWallets.mock.calls).toEqual([
        [
          {
            walletIds: ['hw-old', 'hw-current'],
            isRemoveToMocked: undefined,
          },
        ],
      ]);
      expect(cleanupDapp.mock.calls).toEqual([
        [{ walletId: 'hw-old' }],
        [{ walletId: 'hw-current' }],
      ]);
    });

    it.each(['hw-old', 'hw-current'])(
      'preserves successful deletion and continues cleanup when DApp cleanup fails for %s',
      async (failedWalletId) => {
        const { service, cleanupDapp, cleanupBackup, cleanupCredentials } =
          setup();
        const error = new OneKeyLocalError('DApp cleanup failed');
        cleanupDapp.mockImplementation(
          async ({ walletId }: { walletId: string }) => {
            if (walletId === failedWalletId) {
              throw error;
            }
          },
        );
        const logError = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        try {
          await expect(
            service.removeWallet({
              walletId: 'hw-old',
              removeSameDeviceWallets: true,
            }),
          ).resolves.toBeUndefined();
          expect(jest.mocked(localDb).removeWallets.mock.calls).toHaveLength(1);
          const expectedCalls = [
            [{ walletId: 'hw-old' }],
            [{ walletId: 'hw-current' }],
          ];
          expect(cleanupDapp.mock.calls).toEqual(expectedCalls);
          expect(cleanupCredentials.mock.calls).toEqual(expectedCalls);
          expect(cleanupBackup.mock.calls).toEqual(expectedCalls);
          expect(logError).toHaveBeenCalledWith(
            'Failed to cleanup DApp connections after wallet removal:',
            error,
          );
        } finally {
          logError.mockRestore();
        }
      },
    );

    it('does not run post-removal cleanup when the transaction fails', async () => {
      const { service, cleanupDapp } = setup();
      jest
        .mocked(localDb)
        .removeWallets.mockRejectedValueOnce(new Error('DB failed'));
      await expect(
        service.removeWallet({
          walletId: 'hw-old',
          removeSameDeviceWallets: true,
        }),
      ).rejects.toThrow('DB failed');
      expect(cleanupDapp).not.toHaveBeenCalled();
    });

    it('rejects QR wallets as the target of a device removal', async () => {
      const { service, verify } = setup();
      await expect(
        service.removeWallet({
          walletId: 'qr-wallet',
          removeSameDeviceWallets: true,
        }),
      ).rejects.toThrow('Only hardware wallets');
      expect(verify).not.toHaveBeenCalled();
      expect(jest.mocked(localDb).removeWallets.mock.calls).toHaveLength(0);
    });
  });
});
