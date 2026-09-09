import ServiceBatchCreateAccount from '../ServiceBatchCreateAccount/ServiceBatchCreateAccount';
import {
  HardwareProcessingManager,
  type IOneKeyHardwareOperationLease,
} from '../ServiceHardwareUI/HardwareProcessingManager';

import ServiceAccount from './ServiceAccount';

const mockPrepareAccounts = jest.fn(async () => []);
const mockBatchGetAddresses = jest.fn(async () => []);

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

jest.mock('../../states/jotai/atoms/prime', () => ({
  primeTransferAtom: {
    set: jest.fn(async () => undefined),
  },
}));

jest.mock('../../vaults/factory', () => ({
  vaultFactory: {
    getWalletOnlyVault: jest.fn(async () => ({
      keyring: {
        prepareAccounts: mockPrepareAccounts,
        batchGetAddresses: mockBatchGetAddresses,
      },
      getNetworkInfo: jest.fn(async () => ({})),
    })),
  },
}));

describe('ServiceAccount hardware operation lease', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('复用真实外层 lease，避免验证地址进入 previewBatchBuildAccounts 时死锁', async () => {
    const manager = new HardwareProcessingManager();
    const withHardwareProcessing = jest.fn(
      async (
        operation: (lease: IOneKeyHardwareOperationLease) => Promise<unknown>,
        options: { oneKeyOperationLease?: IOneKeyHardwareOperationLease },
      ) =>
        manager.runExclusiveOneKeyOperation({
          deviceKey: 'device-1',
          lease: options.oneKeyOperationLease,
          operation,
        }),
    );
    const deviceParams = {
      dbDevice: {
        id: 'device-1',
      },
    };
    const backgroundApi = {
      serviceAccount: {
        getWalletDeviceParams: jest.fn(async () => deviceParams),
      },
      serviceHardwareUI: {
        closeHardwareUiStateDialog: jest.fn(async () => undefined),
        withHardwareProcessing,
      },
      serviceNetwork: {
        getVaultSettings: jest.fn(async () => ({ accountType: 'simple' })),
      },
    } as Record<string, unknown>;
    const serviceBatchCreateAccount = new ServiceBatchCreateAccount({
      backgroundApi,
    });
    Object.assign(serviceBatchCreateAccount, {
      buildBatchCreateAccountsNetworksParams: jest.fn(async () => []),
      getHwAllNetworkPrepareAccountsResponse: jest.fn(async () => ({
        destroy: jest.fn(),
      })),
      batchBuildAccounts: jest.fn(async () => ({
        accountsForCreate: [{ address: '0x1234' }],
      })),
    });
    Object.assign(backgroundApi, { serviceBatchCreateAccount });

    const service = new ServiceAccount({ backgroundApi });
    service.getPrepareHDOrHWAccountsParams = jest.fn(async () => ({
      prepareParams: { indexes: [0] },
      deviceParams,
      networkId: 'evm--1',
      walletId: 'hw-1',
    })) as unknown as typeof service.getPrepareHDOrHWAccountsParams;

    const verifyFlow = service.verifyHWAccountAddresses({
      walletId: 'hw-1',
      networkId: 'evm--1',
      indexes: [0],
      indexedAccountId: undefined,
      deriveType: 'default',
    });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('verify address hardware operation deadlocked')),
        500,
      );
    });

    await expect(Promise.race([verifyFlow, timeout])).resolves.toEqual([
      '0x1234',
    ]);
    clearTimeout(timeoutId);

    expect(withHardwareProcessing).toHaveBeenCalledTimes(2);
    expect(withHardwareProcessing).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.objectContaining({
        oneKeyOperationLease: expect.objectContaining({
          deviceKey: 'device-1',
        }),
      }),
    );
  });

  it('从批量建账号入口透传 lease 到 prepareHdOrHwAccounts', async () => {
    const manager = new HardwareProcessingManager();
    const withHardwareProcessing = jest.fn(
      async (
        operation: (lease: IOneKeyHardwareOperationLease) => Promise<unknown>,
        options: { oneKeyOperationLease?: IOneKeyHardwareOperationLease },
      ) =>
        manager.runExclusiveOneKeyOperation({
          deviceKey: 'device-1',
          lease: options.oneKeyOperationLease,
          operation,
        }),
    );
    const deviceParams = {
      dbDevice: {
        id: 'device-1',
      },
    };
    const backgroundApi = {
      serviceHardwareUI: {
        withHardwareProcessing,
      },
      serviceNetwork: {
        getVaultSettings: jest.fn(async () => ({
          mergeDeriveAssetsEnabled: false,
        })),
      },
      servicePrimeTransfer: {
        isInTransferImportOrBackupRestoreFlow: jest.fn(async () => false),
      },
    } as Record<string, unknown>;
    const serviceAccount = new ServiceAccount({ backgroundApi });
    serviceAccount.getPrepareHDOrHWAccountsParams = jest.fn(async () => ({
      prepareParams: {},
      deviceParams,
      networkId: 'evm--1',
      walletId: 'hw-1',
    })) as unknown as typeof serviceAccount.getPrepareHDOrHWAccountsParams;
    Object.assign(serviceAccount, {
      getWalletDeviceParams: jest.fn(async () => deviceParams),
    });
    Object.assign(backgroundApi, { serviceAccount });

    const serviceBatchCreateAccount = new ServiceBatchCreateAccount({
      backgroundApi,
    });
    const buildBatchCreateAccountsNetworksParams = jest.fn(async () => [
      {
        walletId: 'hw-1',
        networkId: 'evm--1',
        deriveType: 'default',
        indexes: [0],
      },
    ]);
    const getHwAllNetworkPrepareAccountsResponse = jest.fn(
      async () => undefined,
    );
    Object.assign(serviceBatchCreateAccount, {
      buildBatchCreateAccountsNetworksParams,
      getHwAllNetworkPrepareAccountsResponse,
    });
    const batchBuildAccounts = jest.spyOn(
      serviceBatchCreateAccount,
      'batchBuildAccounts',
    );
    const prepareHdOrHwAccounts = jest.spyOn(
      serviceAccount,
      'prepareHdOrHwAccounts',
    );

    const batchFlow = serviceBatchCreateAccount.startBatchCreateAccountsFlow({
      mode: 'normal',
      params: {
        walletId: 'hw-1',
        networkId: 'evm--1',
        deriveType: 'default',
        indexes: [0],
        saveToDb: false,
      },
    });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('batch account hardware operation deadlocked')),
        500,
      );
    });

    await expect(Promise.race([batchFlow, timeout])).resolves.toMatchObject({
      accountsForCreate: [],
    });
    clearTimeout(timeoutId);

    expect(withHardwareProcessing).toHaveBeenCalledTimes(2);
    expect(withHardwareProcessing).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.objectContaining({
        oneKeyOperationLease: expect.objectContaining({
          deviceKey: 'device-1',
        }),
      }),
    );
    expect(buildBatchCreateAccountsNetworksParams).toHaveBeenCalledTimes(1);
    expect(getHwAllNetworkPrepareAccountsResponse).toHaveBeenCalledTimes(1);
    expect(batchBuildAccounts).toHaveBeenCalledTimes(1);
    expect(prepareHdOrHwAccounts).toHaveBeenCalledTimes(1);
  });
});
