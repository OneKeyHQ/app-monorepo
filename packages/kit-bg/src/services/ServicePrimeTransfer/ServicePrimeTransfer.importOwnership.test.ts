import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPrimeTransferSelectedData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import ServicePrimeTransfer from './ServicePrimeTransfer';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IPrimeTransferAtomData } from '../../states/jotai/atoms/prime';

let mockProgress: IPrimeTransferAtomData['importProgress'];
const mockWrite = jest.fn(async () => ({
  addedAccounts: [{ id: 'watching-1' }],
}));
const mockDefaultNetworks = jest.fn(async () => []);
// All credential values are inert fixtures; crypto and persistence are mocked.
const mockDecryptTransferCredentials = jest.fn(
  async (_params: unknown) => '{}',
);
const mockSeed = { entropyWithLangPrefixed: 'mock-entropy', seed: 'mock-seed' };
const mockDecryptSeed = jest.fn(async () => mockSeed);
const mockEncryptSeed = jest.fn(async () => 'mock-encrypted-seed');
const mockEncodeMnemonic = jest.fn(async () => 'mock-encoded-mnemonic');
const mockPromptPassword = jest.fn(async () => ({ password: 'mock-password' }));
const mockCreateWallet = jest.fn(async () => ({
  wallet: { id: 'hd-new' },
  isOverrideWallet: false,
}));
const mockRenameWallet = jest.fn(async () => undefined);
const mockCreateAccounts = jest.fn(async () => undefined);
const mockPrivateKey = jest.fn(async () => ({
  privateKey: 'mock-private-key',
}));
const mockExportedPrivateKey = jest.fn(async () => ({
  privateKey: 'mock-private-key',
  exportedPrivateKey: 'mock-exported-private-key',
}));
const mockRestoreImported = jest.fn(async () => ({
  addedAccounts: [{ id: 'imported-new' }],
}));
const mockSaveTonMnemonic = jest.fn(async () => undefined);
const mockDeriveType = jest.fn(
  async (): Promise<{ deriveType?: 'default' }> => ({ deriveType: 'default' }),
);
const mockGetProgress = jest.fn(async () => ({ importProgress: mockProgress }));

jest.mock('@onekeyhq/core/src/secret', () => ({
  decryptStringAsync: (params: unknown) =>
    mockDecryptTransferCredentials(params),
  decryptRevealableSeed: () => mockDecryptSeed(),
  encryptRevealableSeed: () => mockEncryptSeed(),
  revealEntropyToMnemonic: () => 'mock-mnemonic',
}));
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
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { prime: { transfer: { importError: jest.fn() } } },
}));
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
  default: { saveTonImportedAccountMnemonic: () => mockSaveTonMnemonic() },
}));
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
    get: () => mockGetProgress(),
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
const walletData: IPrimeTransferSelectedData = {
  ...selectedTransferData,
  wallets: [
    {
      id: 'hd-source',
      credential: 'mock-encrypted-credential',
      item: {
        id: 'hd-source',
        name: 'Test wallet',
        type: 'hd',
        version: 1,
        backuped: true,
        nextIds: {},
        accounts: [],
        accountIds: [],
        accountIdsLength: 0,
        indexedAccountUUIDs: [],
        indexedAccountUUIDsLength: 0,
      },
    },
  ],
};
const importedData: IPrimeTransferSelectedData = {
  ...selectedTransferData,
  importedAccounts: [
    {
      ...watchingData.watchingAccounts[0],
      credential: 'mock-encrypted-credential',
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
    mockDecryptTransferCredentials.mockReset().mockResolvedValue('{}');
    mockWrite.mockClear();
    mockDefaultNetworks.mockReset().mockResolvedValue([]);
    mockDecryptSeed.mockReset().mockResolvedValue(mockSeed);
    mockEncryptSeed.mockReset().mockResolvedValue('mock-encrypted-seed');
    mockEncodeMnemonic.mockReset().mockResolvedValue('mock-encoded-mnemonic');
    mockPromptPassword
      .mockReset()
      .mockResolvedValue({ password: 'mock-password' });
    mockCreateWallet
      .mockReset()
      .mockResolvedValue({ wallet: { id: 'hd-new' }, isOverrideWallet: false });
    mockRenameWallet.mockClear();
    mockCreateAccounts.mockClear();
    mockPrivateKey
      .mockReset()
      .mockResolvedValue({ privateKey: 'mock-private-key' });
    mockExportedPrivateKey.mockReset().mockResolvedValue({
      privateKey: 'mock-private-key',
      exportedPrivateKey: 'mock-exported-private-key',
    });
    mockRestoreImported
      .mockReset()
      .mockResolvedValue({ addedAccounts: [{ id: 'imported-new' }] });
    mockSaveTonMnemonic.mockClear();
    mockDeriveType.mockReset().mockResolvedValue({ deriveType: 'default' });
    mockGetProgress
      .mockReset()
      .mockImplementation(async () => ({ importProgress: mockProgress }));
    service = new ServicePrimeTransfer({
      backgroundApi: {
        serviceNotification: {
          registerClientWithOverrideAllAccounts: async () => undefined,
        },
        serviceBatchCreateAccount: {
          buildDefaultNetworksForBatchCreate: mockDefaultNetworks,
          startBatchCreateAccountsFlowForAllNetwork: mockCreateAccounts,
        },
        serviceAccount: {
          getAccountCreatedNetworkId: async () => 'evm--1',
          restoreWatchingAccountByInput: mockWrite,
          createHDWallet: mockCreateWallet,
          createHDWalletWithRevealableSeed: mockCreateWallet,
          setWalletNameAndAvatar: mockRenameWallet,
          getPrivateKeyOfImportedAccountCredential: mockPrivateKey,
          getExportedPrivateKeyOfImportedAccount: mockExportedPrivateKey,
          restoreImportedAccountByInput: mockRestoreImported,
        },
        servicePassword: {
          encodeSensitiveText: mockEncodeMnemonic,
          promptPasswordVerify: mockPromptPassword,
        },
        serviceNetwork: { getDeriveTypeByDBAccount: mockDeriveType },
      },
    });
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  async function startPreparedImport(
    data: IPrimeTransferSelectedData,
    localPassword?: string,
  ) {
    const taskUUID = await service.prepareImportTask();
    if (!taskUUID) throw new OneKeyLocalError('Task was not reserved');
    await service.initImportProgress({ taskUUID, selectedTransferData: data });
    return {
      taskUUID,
      importing: service.startImport({
        taskUUID,
        selectedTransferData: data,
        password: 'mock-password',
        localPassword,
      }),
    };
  }

  test.each([
    { cancel: true, localPassword: undefined },
    { cancel: true, localPassword: 'mock-local-password' },
    { cancel: false, localPassword: undefined },
    { cancel: false, localPassword: 'mock-local-password' },
  ])(
    'HD credential preparation respects cancellation: %p',
    async ({ cancel, localPassword }) => {
      const credential = deferred<typeof mockSeed>();
      const entered = deferred<void>();
      mockDecryptSeed.mockImplementationOnce(() => {
        entered.resolve();
        return credential.promise;
      });
      const { taskUUID, importing } = await startPreparedImport(
        walletData,
        localPassword,
      );
      await entered.promise;
      if (cancel) await service.resetImportProgress({ taskUUID });
      credential.resolve(mockSeed);
      await expect(importing).resolves.toMatchObject({
        success: !cancel,
        errorsInfo: [],
      });
      expect(mockCreateWallet).toHaveBeenCalledTimes(cancel ? 0 : 1);
      if (cancel) expect(mockProgress).toBeUndefined();
    },
  );

  test.each([true, false])(
    'HD mnemonic encoding respects cancellation: %s',
    async (cancel) => {
      const encoded = deferred<string>();
      const entered = deferred<void>();
      mockEncodeMnemonic.mockImplementationOnce(() => {
        entered.resolve();
        return encoded.promise;
      });
      const { taskUUID, importing } = await startPreparedImport(walletData);
      await entered.promise;
      if (cancel) await service.resetImportProgress({ taskUUID });
      encoded.resolve('mock-encoded-mnemonic');
      await expect(importing).resolves.toMatchObject({
        success: !cancel,
        errorsInfo: [],
      });
      expect(mockCreateWallet).toHaveBeenCalledTimes(cancel ? 0 : 1);
    },
  );

  test.each([
    { path: 'derived', cancel: true },
    { path: 'exported', cancel: true },
    { path: 'fallback', cancel: true },
    { path: 'derived', cancel: false },
    { path: 'exported', cancel: false },
    { path: 'fallback', cancel: false },
  ])(
    'imported credential preparation respects cancellation: %p',
    async ({ path, cancel }) => {
      const credential = deferred<{
        privateKey: string;
        exportedPrivateKey: string;
      }>();
      const entered = deferred<void>();
      if (path === 'exported') mockDeriveType.mockResolvedValue({});
      if (path === 'fallback')
        mockRestoreImported.mockResolvedValueOnce({ addedAccounts: [] });
      const decrypt =
        path === 'derived' ? mockPrivateKey : mockExportedPrivateKey;
      decrypt.mockImplementationOnce(() => {
        entered.resolve();
        return credential.promise;
      });
      const { taskUUID, importing } = await startPreparedImport(
        importedData,
        'mock-local-password',
      );
      await entered.promise;
      if (cancel) await service.resetImportProgress({ taskUUID });
      credential.resolve({
        privateKey: 'mock-private-key',
        exportedPrivateKey: 'mock-exported-private-key',
      });
      await expect(importing).resolves.toMatchObject({
        success: !cancel,
        errorsInfo: [],
      });
      expect(mockRestoreImported).toHaveBeenCalledTimes(
        (path === 'fallback' ? 1 : 0) + (cancel ? 0 : 1),
      );
      if (cancel) expect(mockProgress).toBeUndefined();
    },
  );

  test.each(['decryption', 'password', 'encryption', 'complete'])(
    'TON mnemonic preparation respects cancellation: %s',
    async (stage) => {
      const entered = deferred<void>();
      const resumed = deferred<void>();
      if (stage === 'decryption')
        mockDecryptSeed.mockImplementationOnce(async () => {
          entered.resolve();
          await resumed.promise;
          return mockSeed;
        });
      if (stage === 'password')
        mockPromptPassword.mockImplementationOnce(async () => {
          entered.resolve();
          await resumed.promise;
          return { password: 'mock-password' };
        });
      if (stage === 'encryption')
        mockEncryptSeed.mockImplementationOnce(async () => {
          entered.resolve();
          await resumed.promise;
          return 'mock-encrypted-seed';
        });
      const data: IPrimeTransferSelectedData = {
        ...importedData,
        importedAccounts: [
          {
            ...importedData.importedAccounts[0],
            tonMnemonicCredential: 'mock-ton-credential',
          },
        ],
      };
      const { taskUUID, importing } = await startPreparedImport(
        data,
        stage === 'password' ? undefined : 'mock-local-password',
      );
      if (stage !== 'complete') {
        await entered.promise;
        await service.resetImportProgress({ taskUUID });
        resumed.resolve();
      }
      await expect(importing).resolves.toMatchObject({
        success: stage === 'complete',
        errorsInfo: [],
      });
      expect(mockRestoreImported).toHaveBeenCalledTimes(1);
      expect(mockSaveTonMnemonic).toHaveBeenCalledTimes(
        stage === 'complete' ? 1 : 0,
      );
    },
  );

  test('cancellation while the pre-write trace awaits prevents wallet creation', async () => {
    const entered = deferred<void>();
    const trace = deferred<{
      importProgress: IPrimeTransferAtomData['importProgress'];
    }>();
    mockDecryptSeed.mockImplementationOnce(async () => {
      // Let the decryption's completion trace finish, then hold the write's start trace.
      mockGetProgress
        .mockResolvedValueOnce({ importProgress: mockProgress })
        .mockImplementationOnce(() => {
          entered.resolve();
          return trace.promise;
        });
      return mockSeed;
    });
    const { taskUUID, importing } = await startPreparedImport(
      walletData,
      'mock-local-password',
    );
    await entered.promise;
    await service.resetImportProgress({ taskUUID });
    trace.resolve({ importProgress: undefined });
    await expect(importing).resolves.toMatchObject({
      success: false,
      errorsInfo: [],
    });
    expect(mockCreateWallet).not.toHaveBeenCalled();
  });

  test('cancellation during wallet creation prevents subsequent rename and account writes', async () => {
    const entered = deferred<void>();
    const write = deferred<{
      wallet: { id: string };
      isOverrideWallet: boolean;
    }>();
    mockCreateWallet.mockImplementationOnce(() => {
      entered.resolve();
      return write.promise;
    });
    const { taskUUID, importing } = await startPreparedImport(
      walletData,
      'mock-local-password',
    );
    await entered.promise;
    await service.resetImportProgress({ taskUUID });
    await expect(service.prepareImportTask()).rejects.toMatchObject({
      key: ETranslations.global_request_limit,
    });
    write.resolve({ wallet: { id: 'hd-new' }, isOverrideWallet: true });
    await expect(importing).resolves.toMatchObject({
      success: false,
      errorsInfo: [],
    });
    expect(mockRenameWallet).not.toHaveBeenCalled();
    expect(mockCreateAccounts).not.toHaveBeenCalled();
    await expect(service.prepareImportTask()).resolves.toEqual(
      expect.any(String),
    );
  });

  test('an active HD import still reports credential failures', async () => {
    mockDecryptSeed.mockRejectedValueOnce(new Error('Credential unavailable'));
    const { importing } = await startPreparedImport(walletData);
    await expect(importing).resolves.toMatchObject({
      errorsInfo: [
        { category: 'createHDWallet', error: 'Error (message omitted)' },
      ],
    });
    expect(mockCreateWallet).not.toHaveBeenCalled();
  });

  test('an active imported-account failure is not mistaken for cancellation', async () => {
    const error = new Error('Credential unavailable');
    mockPrivateKey.mockRejectedValueOnce(error);
    const { importing } = await startPreparedImport(importedData);
    await expect(importing).resolves.toMatchObject({
      success: true,
      errorsInfo: [
        {
          category: 'importPrivateKeyAccount',
          error: 'Error (message omitted)',
        },
      ],
    });
    expect(mockRestoreImported).not.toHaveBeenCalled();
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

  test('a duplicate reservation reports busy without cancelling its owner', async () => {
    const taskUUID = await service.prepareImportTask();
    if (!taskUUID) throw new OneKeyLocalError('Task was not reserved');
    await expect(service.prepareImportTask()).rejects.toMatchObject({
      key: ETranslations.global_request_limit,
      message: ETranslations.global_request_limit,
    });
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
    await expect(service.prepareImportTask()).rejects.toMatchObject({
      key: ETranslations.global_request_limit,
    });
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

  test.each([false, true])(
    'wrapped credentials use non-blocking crypto and respect cancellation: %s',
    async (cancel) => {
      const decrypted = deferred<string>();
      const entered = deferred<void>();
      mockDecryptTransferCredentials.mockImplementationOnce(() => {
        entered.resolve();
        return decrypted.promise;
      });
      const taskUUID = await service.prepareImportTask();
      if (!taskUUID) throw new OneKeyLocalError('Task was not reserved');
      await service.initImportProgress({
        taskUUID,
        selectedTransferData: importedData,
      });
      const importing = service.startImport({
        taskUUID,
        selectedTransferData: importedData,
        decryptedCredentialsHex: 'mock-encrypted-credentials',
        password: 'mock-password',
      });
      await entered.promise;
      if (cancel) await service.resetImportProgress({ taskUUID });
      decrypted.resolve('{}');
      await expect(importing).resolves.toMatchObject({ success: !cancel });
      expect(mockDecryptTransferCredentials).toHaveBeenCalledWith({
        data: 'mock-encrypted-credentials',
        password: 'mock-password',
        allowRawPassword: true,
        resultEncoding: 'utf8',
        kdfBackend: 'webcrypto',
        enablePbkdf2Cache: true,
      });
      expect(mockRestoreImported).toHaveBeenCalledTimes(cancel ? 0 : 1);
    },
  );

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
