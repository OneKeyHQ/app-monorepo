import ServicePrimeTransfer from './ServicePrimeTransfer';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IPrimeTransferAtomData } from '../../states/jotai/atoms/prime';

let mockState: Pick<
  IPrimeTransferAtomData,
  | 'exitGeneration'
  | 'importProgress'
  | 'status'
  | 'pairedRoomId'
  | 'refreshQrcodeHook'
  | 'myUserId'
  | 'transferDirection'
>;
const mockWait = jest.fn<Promise<void>, []>();
const mockClearPairing = jest.fn<void, []>();
let mockBeforeStateUpdate: (() => Promise<void>) | undefined;

jest.mock('@onekeyhq/core/src/secret', () => ({}));
jest.mock('@onekeyhq/shared/src/appCrypto', () => ({
  pbkdf2: {
    getPbkdf2KdfParamsForNonDbTx: () => ({
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: true,
    }),
  },
}));
jest.mock('@onekeyhq/shared/src/appDeviceInfo/appDeviceInfo', () => ({}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundMethod: () => () => undefined,
  toastIfError: () => () => undefined,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({ defaultLogger: {} }));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: () => () => undefined,
  },
}));
jest.mock('@onekeyhq/shared/src/request/customUA', () => ({}));
jest.mock('@onekeyhq/shared/src/request/Interceptor', () => ({}));
jest.mock(
  '@onekeyhq/shared/src/utils/cliBotWalletExport/exportToCli',
  () => ({}),
);
jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../dbs/local/localSecretEnvelope', () => ({}));
jest.mock('../../endpoints', () => ({}));
jest.mock('../../utils/secretEncryptFormat', () => ({}));
jest.mock('../ServiceCloudBackup', () => ({}));
jest.mock('./e2ee/e2eeClientToClientApi', () => ({
  __esModule: true,
  default: {
    setSelfPairingCode: () => mockClearPairing(),
    clearSensitiveData: () => mockClearPairing(),
  },
}));
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

jest.mock('../../states/jotai/atoms', () => ({}));
jest.mock('../../states/jotai/atoms/prime', () => ({
  EPrimeTransferStatus: {
    init: 'init',
    paired: 'paired',
    transferring: 'transferring',
  },
  primeTransferAtom: {
    get: async () => mockState,
    set: async (update: (state: typeof mockState) => typeof mockState) => {
      if (mockBeforeStateUpdate) await mockBeforeStateUpdate();
      mockState = update(mockState);
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
    wait: () => mockWait(),
  },
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createService() {
  const service = new ServicePrimeTransfer({ backgroundApi: {} });
  jest.spyOn(service, 'checkRoomIdValid').mockImplementation(() => undefined);
  jest
    .spyOn(service, 'resetImportProgress')
    .mockImplementation(async ({ taskUUID } = {}) => {
      if (service.currentImportTaskUUID !== taskUUID) return;
      service.currentImportTaskUUID = undefined;
      mockState = { ...mockState, importProgress: undefined };
    });
  return service;
}

async function pair(service: ServicePrimeTransfer, roomId = 'old-room') {
  await service.handleClientsSuccessPaired({
    roomId,
    pairingCode: 'fixture',
    encryptedKey: 'fixture-key',
  });
  return mockState.exitGeneration ?? 0;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBeforeStateUpdate = undefined;
  mockWait.mockReset().mockResolvedValue(undefined);
  // Use the production enum through the mocked module, without asserting a string type.
  const { EPrimeTransferStatus } = jest.requireMock<
    typeof import('../../states/jotai/atoms/prime')
  >('../../states/jotai/atoms/prime');
  mockState = {
    status: EPrimeTransferStatus.init,
    pairedRoomId: undefined,
    myUserId: undefined,
    transferDirection: undefined,
  };
});
afterEach(() => jest.restoreAllMocks());

test('a stale import exit cannot reset, clear, leave, or refresh a replacement', async () => {
  const service = createService();
  await pair(service);
  const oldTask = await service.prepareImportTask();
  const generation = mockState.exitGeneration ?? 0;
  await service.resetImportProgress({ taskUUID: oldTask });
  const replacement = await service.prepareImportTask();
  const snapshot = { ...mockState };
  const reset = jest.spyOn(service, 'resetImportProgress');
  reset.mockClear();
  expect(await service.exitTransfer({ generation })).toBe(false);
  expect(reset).not.toHaveBeenCalled();
  expect(mockClearPairing).not.toHaveBeenCalled();
  expect(mockWait).not.toHaveBeenCalled();
  expect(mockState).toEqual(snapshot);
  expect(service.currentImportTaskUUID).toBe(replacement);
});

test('an idle confirmation cannot exit a subsequently reserved import', async () => {
  const service = createService();
  const generation = await pair(service);
  await service.prepareImportTask();
  const snapshot = { ...mockState };
  expect(await service.exitTransfer({ generation })).toBe(false);
  expect(mockState).toEqual(snapshot);
  expect(mockClearPairing).not.toHaveBeenCalled();
});

test('a replacement reserved while import reset is awaiting survives the rest of exit', async () => {
  const service = createService();
  await pair(service);
  await service.prepareImportTask();
  const generation = mockState.exitGeneration ?? 0;
  const resetStarted = deferred();
  const resetDone = deferred();
  jest
    .spyOn(service, 'resetImportProgress')
    .mockImplementationOnce(async () => {
      service.currentImportTaskUUID = undefined;
      resetStarted.resolve();
      await resetDone.promise;
    });
  const exiting = service.exitTransfer({ generation });
  await resetStarted.promise;
  const replacement = await service.prepareImportTask();
  resetDone.resolve();
  expect(await exiting).toBe(false);
  expect(service.currentImportTaskUUID).toBe(replacement);
  expect(mockClearPairing).not.toHaveBeenCalled();
  expect(mockState.pairedRoomId).toBe('old-room');
  expect(mockState.refreshQrcodeHook).toBeUndefined();
});

test.each(['clear', 'leave', 'refresh'] as const)(
  'a replacement pairing during %s cannot be cleared by a pending exit',
  async (stage) => {
    const service = createService();
    const generation = await pair(service);
    const entered = deferred();
    const resume = deferred();
    const pause = async () => {
      entered.resolve();
      await resume.promise;
    };
    if (stage === 'refresh') mockWait.mockImplementationOnce(pause);
    else {
      const cancel = jest.spyOn(service, 'cancelNetworkTransfer');
      if (stage === 'leave') cancel.mockResolvedValueOnce(undefined);
      cancel.mockImplementationOnce(pause);
    }
    const exiting = service.exitTransfer({ generation });
    await entered.promise;
    const replacementGeneration = await pair(service, 'replacement-room');
    const snapshot = { ...mockState };
    mockClearPairing.mockClear();
    resume.resolve();
    expect(await exiting).toBe(false);
    expect(mockState).toEqual(snapshot);
    expect(mockClearPairing).not.toHaveBeenCalled();
    expect(await service.isTransferExitCurrent(replacementGeneration)).toBe(
      true,
    );
  },
);

test('the current owner still resets its import, clears pairing and refreshes the QR code', async () => {
  const service = createService();
  const reset = jest.spyOn(service, 'resetImportProgress');
  await pair(service);
  const taskUUID = await service.prepareImportTask();
  const generation = mockState.exitGeneration ?? 0;
  expect(await service.exitTransfer({ generation })).toBe(true);
  expect(reset).toHaveBeenCalledWith({ taskUUID });
  expect(mockClearPairing).toHaveBeenCalledTimes(2);
  expect(mockState.pairedRoomId).toBeUndefined();
  expect(mockState.importProgress).toBeUndefined();
  expect(mockState.refreshQrcodeHook).toEqual(expect.any(Number));
  expect(await service.isTransferExitCurrent(generation)).toBe(true);
});

test.each(['network-cleanup', 'status-update', 'peer-readiness'] as const)(
  'an old cancellation cannot reset or notify a replacement started during %s',
  async (stage) => {
    const { EPrimeTransferStatus } = jest.requireMock<
      typeof import('../../states/jotai/atoms/prime')
    >('../../states/jotai/atoms/prime');
    const service = createService();
    jest
      .spyOn(service, 'checkWebSocketConnected')
      .mockImplementation(() => undefined);
    const entered = deferred();
    const resume = deferred();
    const notify = jest.fn<void, []>();
    Object.defineProperty(service, 'e2eeClientToClientApiProxy', {
      value: {
        cancelTransferIfCurrent: async (isCurrent: () => boolean) => {
          if (stage === 'peer-readiness') {
            entered.resolve();
            await resume.promise;
          }
          if (isCurrent()) notify();
        },
      },
    });
    mockState = {
      ...mockState,
      status: EPrimeTransferStatus.transferring,
      pairedRoomId: 'room',
      myUserId: 'sender',
      transferDirection: {
        fromUserId: 'sender',
        toUserId: 'receiver',
        randomNumber: 'fixture',
      },
    };
    const oldTaskId = await service.beginTransferPreparation();
    let writes = 0;
    mockBeforeStateUpdate = async () => {
      writes += 1;
      if (
        (stage === 'network-cleanup' && writes === 1) ||
        (stage === 'status-update' && writes === 2)
      ) {
        entered.resolve();
        await resume.promise;
      }
    };
    const cancelling = service.cancelTransfer({ taskId: oldTaskId });
    await entered.promise;
    // A subsequent start-transfer event can restore transferring after local
    // cleanup has reset the status but before the peer RPC has been sent.
    mockState = { ...mockState, status: EPrimeTransferStatus.transferring };
    const replacementTaskId = await service.beginTransferPreparation();
    expect(replacementTaskId).not.toBe(oldTaskId);
    resume.resolve();
    await cancelling;
    expect(mockState.status).toBe(EPrimeTransferStatus.transferring);
    expect(notify).not.toHaveBeenCalled();
    await expect(service.beginTransferPreparation()).rejects.toThrow(
      'Transfer already in progress',
    );
  },
);
