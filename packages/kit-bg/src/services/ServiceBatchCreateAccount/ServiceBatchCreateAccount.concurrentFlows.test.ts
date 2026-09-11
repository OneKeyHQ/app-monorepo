import {
  HardwareProcessingManager,
  type IOneKeyHardwareOperationLease,
} from '../ServiceHardwareUI/HardwareProcessingManager';

import ServiceBatchCreateAccount from './ServiceBatchCreateAccount';

import type { IBatchCreateAccountProgressInfo } from './ServiceBatchCreateAccount';

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

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: {
      sdkLog: {
        consoleLog: jest.fn(),
        log: jest.fn(),
      },
    },
    account: {
      batchCreatePerf: new Proxy(
        {},
        {
          get: () => jest.fn(),
        },
      ),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AccountUpdate: 'AccountUpdate',
    BatchCreateAccount: 'BatchCreateAccount',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('@onekeyhq/core/src/secret', () => ({
  clearHdCredentialDecryptCache: jest.fn(async () => undefined),
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

const HD_WALLET_ID = 'hd-1';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Builds a software-wallet (no device) batch-create service whose hardware
 * processing goes through a real HardwareProcessingManager, which is the only
 * serialization between two overlapping flows in production.
 */
function buildService() {
  const manager = new HardwareProcessingManager();
  const withHardwareProcessing = jest.fn(
    async (
      operation: (lease: IOneKeyHardwareOperationLease) => Promise<unknown>,
      options: { oneKeyOperationLease?: IOneKeyHardwareOperationLease },
    ) =>
      manager.runExclusiveOneKeyOperation({
        deviceKey: undefined,
        lease: options.oneKeyOperationLease,
        operation,
      }),
  );
  const backgroundApi = {
    serviceAccount: {
      // Software wallet: no device params.
      getWalletDeviceParams: jest.fn(async () => undefined),
    },
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
  const service = new ServiceBatchCreateAccount({ backgroundApi });

  const firstBuildStarted = createDeferred();
  const firstBuildGate = createDeferred();
  const progressInfoSeenByBuild: Array<
    IBatchCreateAccountProgressInfo | undefined
  > = [];
  const batchBuildAccounts = jest.fn(async () => {
    // Snapshot the singleton the real guard reads before creating accounts.
    progressInfoSeenByBuild.push(service.progressInfo);
    if (progressInfoSeenByBuild.length === 1) {
      firstBuildStarted.resolve();
      await firstBuildGate.promise;
    }
    return { accountsForCreate: [] };
  });
  Object.assign(service, {
    buildBatchCreateAccountsNetworksParams: jest.fn(async () => [
      {
        walletId: HD_WALLET_ID,
        networkId: 'evm--1',
        deriveType: 'default',
      },
      {
        walletId: HD_WALLET_ID,
        networkId: 'btc--0',
        deriveType: 'default',
      },
    ]),
    getHwAllNetworkPrepareAccountsResponse: jest.fn(async () => undefined),
    batchBuildAccounts,
  });

  return {
    service,
    withHardwareProcessing,
    batchBuildAccounts,
    firstBuildStarted,
    firstBuildGate,
    progressInfoSeenByBuild,
  };
}

function raceWithTimeout<T>(promise: Promise<T>, label: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), 1000);
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timeoutId),
  );
}

describe('ServiceBatchCreateAccount overlapping flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('第二个 all-network 流程排队时不能抹掉正在运行流程的 progressInfo', async () => {
    const {
      service,
      firstBuildStarted,
      firstBuildGate,
      progressInfoSeenByBuild,
      batchBuildAccounts,
    } = buildService();
    const params = {
      walletId: HD_WALLET_ID,
      fromIndex: 0,
      toIndex: 0,
      excludedIndexes: {},
      saveToDb: true,
      customNetworks: [],
      autoHandleExitError: true,
    };

    const flowA = service.startBatchCreateAccountsFlowForAllNetwork(params);
    await raceWithTimeout(firstBuildStarted.promise, 'first build');
    // Second "Add account" press while the first flow is mid-way.
    const flowB = service.startBatchCreateAccountsFlowForAllNetwork(params);
    firstBuildGate.resolve();

    const [resultA, resultB] = await raceWithTimeout(
      Promise.all([flowA, flowB]),
      'both flows',
    );

    expect(batchBuildAccounts).toHaveBeenCalledTimes(4);
    expect(progressInfoSeenByBuild.every(Boolean)).toBe(true);
    // Flow A keeps its own progressInfo for its whole network loop.
    expect(progressInfoSeenByBuild[1]).toBe(progressInfoSeenByBuild[0]);
    // Flow B starts with a fresh progressInfo only once it owns the lease.
    expect(progressInfoSeenByBuild[2]).not.toBe(progressInfoSeenByBuild[0]);
    expect(progressInfoSeenByBuild[3]).toBe(progressInfoSeenByBuild[2]);
    expect(resultA.failedAccounts).toEqual([]);
    expect(resultA.addedAccounts).toHaveLength(2);
    expect(resultB.failedAccounts).toEqual([]);
    expect(resultB.addedAccounts).toHaveLength(2);
  });

  it('第二个普通流程排队时不能抹掉正在运行流程的 progressInfo', async () => {
    const {
      service,
      firstBuildStarted,
      firstBuildGate,
      progressInfoSeenByBuild,
      batchBuildAccounts,
    } = buildService();
    const payload = {
      mode: 'normal' as const,
      params: {
        walletId: HD_WALLET_ID,
        networkId: 'evm--1',
        deriveType: 'default' as const,
        indexes: [0],
        saveToDb: true,
      },
    };

    const flowA = service.startBatchCreateAccountsFlow(payload);
    await raceWithTimeout(firstBuildStarted.promise, 'first build');
    const flowB = service.startBatchCreateAccountsFlow(payload);
    firstBuildGate.resolve();

    await raceWithTimeout(Promise.all([flowA, flowB]), 'both flows');

    expect(batchBuildAccounts).toHaveBeenCalledTimes(4);
    expect(progressInfoSeenByBuild.every(Boolean)).toBe(true);
    expect(progressInfoSeenByBuild[1]).toBe(progressInfoSeenByBuild[0]);
    expect(progressInfoSeenByBuild[2]).not.toBe(progressInfoSeenByBuild[0]);
    expect(progressInfoSeenByBuild[3]).toBe(progressInfoSeenByBuild[2]);
  });

  it('all-network 流程在等待租约期间被取消后，拿到租约也不能继续创建', async () => {
    const { service, firstBuildStarted, firstBuildGate, batchBuildAccounts } =
      buildService();
    const params = {
      walletId: HD_WALLET_ID,
      fromIndex: 0,
      toIndex: 0,
      excludedIndexes: {},
      saveToDb: true,
      customNetworks: [],
      autoHandleExitError: true,
    };

    const flowA = service.startBatchCreateAccountsFlowForAllNetwork(params);
    await raceWithTimeout(firstBuildStarted.promise, 'first build');
    const flowB = service.startBatchCreateAccountsFlowForAllNetwork(params);
    // User taps Cancel in the ProcessingDialog while flow B is queued.
    await service.cancelBatchCreateAccountsFlow();
    firstBuildGate.resolve();

    await expect(raceWithTimeout(flowA, 'flow A')).rejects.toThrow();
    await expect(raceWithTimeout(flowB, 'flow B')).rejects.toThrow();
    // Only flow A's gated first network ever reached account building.
    expect(batchBuildAccounts).toHaveBeenCalledTimes(1);
  });

  it('普通流程在等待租约期间被取消后，拿到租约也不能继续创建', async () => {
    const { service, firstBuildStarted, firstBuildGate, batchBuildAccounts } =
      buildService();
    const payload = {
      mode: 'normal' as const,
      params: {
        walletId: HD_WALLET_ID,
        networkId: 'evm--1',
        deriveType: 'default' as const,
        indexes: [0],
        saveToDb: true,
      },
    };

    const flowA = service.startBatchCreateAccountsFlow(payload);
    await raceWithTimeout(firstBuildStarted.promise, 'first build');
    const flowB = service.startBatchCreateAccountsFlow(payload);
    await service.cancelBatchCreateAccountsFlow();
    firstBuildGate.resolve();

    await expect(raceWithTimeout(flowA, 'flow A')).rejects.toThrow();
    await expect(raceWithTimeout(flowB, 'flow B')).rejects.toThrow();
    expect(batchBuildAccounts).toHaveBeenCalledTimes(1);
  });

  it('流程进入之前残留的取消不能影响新流程', async () => {
    const { service, firstBuildGate, batchBuildAccounts } = buildService();
    const payload = {
      mode: 'normal' as const,
      params: {
        walletId: HD_WALLET_ID,
        networkId: 'evm--1',
        deriveType: 'default' as const,
        indexes: [0],
        saveToDb: true,
      },
    };

    // Cancel left over from an earlier flow, before this request enters.
    await service.cancelBatchCreateAccountsFlow();
    firstBuildGate.resolve();
    const flow = service.startBatchCreateAccountsFlow(payload);

    await raceWithTimeout(flow, 'flow');
    expect(batchBuildAccounts).toHaveBeenCalledTimes(2);
    expect(service.isCreateFlowCancelled).toBe(false);
  });
});
