import {
  HardwareProcessingManager,
  type IOneKeyHardwareOperationLease,
} from '../ServiceHardwareUI/HardwareProcessingManager';

import ServiceAccount from './ServiceAccount';

const mockPrepareAccounts = jest.fn(async () => []);

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

jest.mock('../../vaults/factory', () => ({
  vaultFactory: {
    getWalletOnlyVault: jest.fn(async () => ({
      keyring: {
        prepareAccounts: mockPrepareAccounts,
      },
    })),
  },
}));

describe('ServiceAccount hardware operation lease', () => {
  it('复用真实外层 lease，避免 prepareAccounts 重入时等待自己持有的硬件锁', async () => {
    const manager = new HardwareProcessingManager();
    const withHardwareProcessing = jest.fn(
      async (
        operation: () => Promise<unknown>,
        options: { oneKeyOperationLease?: IOneKeyHardwareOperationLease },
      ) =>
        manager.runExclusiveOneKeyOperation({
          deviceKey: 'device-1',
          lease: options.oneKeyOperationLease,
          operation: () => operation(),
        }),
    );
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardwareUI: {
          withHardwareProcessing,
        },
      },
    });
    service.getPrepareHDOrHWAccountsParams = jest.fn(async () => ({
      prepareParams: {},
      deviceParams: {
        dbDevice: {
          id: 'device-1',
        },
      },
      networkId: 'evm--1',
      walletId: 'hw-1',
    })) as unknown as typeof service.getPrepareHDOrHWAccountsParams;

    const nestedFlow = manager.runExclusiveOneKeyOperation({
      deviceKey: 'device-1',
      operation: (oneKeyOperationLease) =>
        service.prepareHdOrHwAccounts({
          walletId: 'hw-1',
          networkId: 'evm--1',
          deriveType: 'default',
          indexedAccountId: undefined,
          oneKeyOperationLease,
        } as Parameters<typeof service.prepareHdOrHwAccounts>[0]),
    });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('nested hardware operation deadlocked')),
        500,
      );
    });

    await expect(Promise.race([nestedFlow, timeout])).resolves.toMatchObject({
      accounts: [],
    });
    clearTimeout(timeoutId);

    expect(withHardwareProcessing).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        oneKeyOperationLease: expect.objectContaining({
          deviceKey: 'device-1',
        }),
      }),
    );
    expect(mockPrepareAccounts).toHaveBeenCalledTimes(1);
  });
});
