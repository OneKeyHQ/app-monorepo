import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPrimeTransferSelectedData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import ServicePrimeTransfer from './ServicePrimeTransfer';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IPrimeTransferAtomData } from '../../states/jotai/atoms/prime';

let mockProgress: IPrimeTransferAtomData['importProgress'];
const mockWrite = jest.fn(async () => ({
  addedAccounts: [{ id: 'watching-1' }],
}));
const mockDefaultNetworks = jest.fn(async () => []);

jest.mock('@onekeyhq/core/src/secret', () => ({}));
jest.mock('@onekeyhq/shared/src/appCrypto', () => ({}));
jest.mock('@onekeyhq/shared/src/appDeviceInfo/appDeviceInfo', () => ({}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundMethod: () => () => undefined,
  toastIfError: () => () => undefined,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({ defaultLogger: {} }));
jest.mock('@onekeyhq/shared/src/request/customUA', () => ({}));
jest.mock('@onekeyhq/shared/src/request/Interceptor', () => ({}));
jest.mock(
  '@onekeyhq/shared/src/utils/cliBotWalletExport/exportToCli',
  () => ({}),
);
jest.mock('../../dbs/local/localDb', () => ({}));
jest.mock('../../dbs/local/localSecretEnvelope', () => ({}));
jest.mock('../../endpoints', () => ({}));
jest.mock('../../utils/secretEncryptFormat', () => ({}));
jest.mock('../ServiceCloudBackup', () => ({}));
jest.mock('./e2ee/e2eeClientToClientApi', () => ({}));
jest.mock('./e2ee/e2eeClientToClientApiProxy', () => ({}));
jest.mock('./e2ee/e2eeServerApiProxy', () => ({}));
jest.mock('./servicePrimeTransferUtils', () => ({}));
jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: IBackgroundApi;

    constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('../../states/jotai/atoms', () => ({
  devSettingsPersistAtom: { get: async () => ({ enabled: false }) },
  perpsActiveAccountRefreshHookAtom: { set: async () => undefined },
}));
jest.mock('../../states/jotai/atoms/prime', () => ({
  primeTransferAtom: {
    get: async () => ({ importProgress: mockProgress }),
    set: async (
      update: (
        state: Pick<IPrimeTransferAtomData, 'importProgress'>,
      ) => Pick<IPrimeTransferAtomData, 'importProgress'>,
    ) => {
      mockProgress = update({ importProgress: mockProgress }).importProgress;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { emit: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual<
      typeof import('@onekeyhq/shared/src/utils/timerUtils')
    >('@onekeyhq/shared/src/utils/timerUtils').default,
    wait: async () => undefined,
  },
}));

const selectedTransferData: IPrimeTransferSelectedData = {
  wallets: [],
  importedAccounts: [],
  watchingAccounts: [],
};
const watchingData: IPrimeTransferSelectedData = {
  ...selectedTransferData,
  watchingAccounts: [
    {
      id: 'watching-1',
      item: {
        version: 1,
        id: 'watching-1',
        address: 'public-test-address',
        name: 'Test',
        type: undefined,
        template: undefined,
        path: undefined,
        createAtNetwork: 'evm--1',
        networks: ['evm--1'],
        impl: 'evm',
        coinType: undefined,
        accountOrder: undefined,
        accountOrderSaved: undefined,
        pub: undefined,
        xpub: undefined,
        xpubSegwit: undefined,
      },
    },
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('Prime Transfer import ownership across preparation and cancellation', () => {
  let service: ServicePrimeTransfer;
  beforeEach(() => {
    jest.useFakeTimers();
    mockProgress = undefined;
    mockWrite.mockClear();
    mockDefaultNetworks.mockReset().mockResolvedValue([]);
    service = new ServicePrimeTransfer({
      backgroundApi: {
        serviceNotification: {
          registerClientWithOverrideAllAccounts: async () => undefined,
        },
        serviceBatchCreateAccount: {
          buildDefaultNetworksForBatchCreate: mockDefaultNetworks,
        },
        serviceAccount: {
          getAccountCreatedNetworkId: async () => 'evm--1',
          restoreWatchingAccountByInput: mockWrite,
        },
      },
    });
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('cancelling during password preparation prevents all subsequent writes', async () => {
    const taskUUID = await service.prepareImportTask();
    expect(taskUUID).toBeDefined();
    if (!taskUUID) throw new OneKeyLocalError('Task was not reserved');
    await service.resetImportProgress({ taskUUID });
    await service.initImportProgress({
      taskUUID,
      selectedTransferData: watchingData,
    });
    await expect(
      service.startImport({
        taskUUID,
        selectedTransferData: watchingData,
        password: '',
      }),
    ).resolves.toMatchObject({ success: false });
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockProgress).toBeUndefined();
  });

  test('cancelling while cloud default networks load cannot revive progress or start writes', async () => {
    const networks = deferred<[]>();
    mockDefaultNetworks.mockImplementationOnce(() => networks.promise);
    const taskUUID = await service.prepareImportTask();
    if (!taskUUID) throw new OneKeyLocalError('Task was not reserved');
    const initializing = service.initImportProgress({
      taskUUID,
      selectedTransferData: watchingData,
      isFromCloudBackupRestore: true,
    });
    await service.resetImportProgress({ taskUUID });
    networks.resolve([]);
    await initializing;
    await expect(
      service.startImport({
        taskUUID,
        selectedTransferData: watchingData,
        password: '',
      }),
    ).resolves.toMatchObject({ success: false });
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockProgress).toBeUndefined();
  });

  test('stale dialog cleanup cannot cancel a newly prepared import', async () => {
    const oldTask = await service.prepareImportTask();
    await service.resetImportProgress({ taskUUID: oldTask });
    const taskUUID = await service.prepareImportTask();
    if (!taskUUID) throw new OneKeyLocalError('Task was not reserved');
    await service.resetImportProgress({ taskUUID: oldTask });
    await service.initImportProgress({
      taskUUID,
      selectedTransferData: watchingData,
    });
    await expect(
      service.startImport({
        taskUUID,
        selectedTransferData: watchingData,
        password: '',
      }),
    ).resolves.toMatchObject({ success: true, taskUUID });
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  test('a cancelled outstanding write blocks a second import until it settles', async () => {
    const write = deferred<{ addedAccounts: { id: string }[] }>();
    const entered = deferred<void>();
    mockWrite.mockImplementationOnce(() => {
      entered.resolve();
      return write.promise;
    });
    const taskUUID = await service.prepareImportTask();
    if (!taskUUID) throw new OneKeyLocalError('Task was not reserved');
    await service.initImportProgress({
      taskUUID,
      selectedTransferData: watchingData,
    });
    const importing = service.startImport({
      taskUUID,
      selectedTransferData: watchingData,
      password: '',
    });
    await entered.promise;
    await service.resetImportProgress({ taskUUID });
    await expect(service.prepareImportTask()).resolves.toBeUndefined();
    write.resolve({ addedAccounts: [{ id: 'watching-1' }] });
    await expect(importing).resolves.toMatchObject({ success: false });
    expect(mockProgress).toBeUndefined();
    await expect(service.prepareImportTask()).resolves.toEqual(
      expect.any(String),
    );
  });
  test('normal completion still publishes totals and the Done action clears its progress', async () => {
    const taskUUID = await service.prepareImportTask();
    if (!taskUUID) throw new OneKeyLocalError('Task was not reserved');
    await service.initImportProgress({
      taskUUID,
      selectedTransferData: watchingData,
    });
    const result = await service.startImport({
      taskUUID,
      selectedTransferData: watchingData,
      password: '',
    });
    await service.completeImportProgress(result);
    expect(mockProgress).toMatchObject({
      taskUUID,
      isImporting: false,
      current: 1,
      total: 1,
    });
    await jest.advanceTimersByTimeAsync(1500);
    await service.resetImportProgress({ taskUUID });
    expect(mockProgress).toBeUndefined();
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  test('duplicate start and its finalization cannot cancel the original import', async () => {
    const write = deferred<{ addedAccounts: { id: string }[] }>();
    const entered = deferred<void>();
    mockWrite.mockImplementationOnce(() => {
      entered.resolve();
      return write.promise;
    });
    const taskUUID = await service.prepareImportTask();
    if (!taskUUID) throw new OneKeyLocalError('Task was not reserved');
    await service.initImportProgress({
      taskUUID,
      selectedTransferData: watchingData,
    });
    const params = {
      taskUUID,
      selectedTransferData: watchingData,
      password: '',
    };
    const importing = service.startImport(params);
    await entered.promise;
    const duplicate = await service.startImport(params);
    expect(duplicate).toMatchObject({ success: false, skipped: true });
    await service.completeImportProgress(duplicate);
    expect(service.currentImportTaskUUID).toBe(taskUUID);
    write.resolve({ addedAccounts: [{ id: 'watching-1' }] });
    await expect(importing).resolves.toMatchObject({ success: true });
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });
});
