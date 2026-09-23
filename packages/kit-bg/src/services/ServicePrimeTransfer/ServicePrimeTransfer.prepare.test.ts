import type { IPbkdf2KdfParams } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import ServicePrimeTransfer from './ServicePrimeTransfer';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBAccount, IDBWallet } from '../../dbs/local/types';
import type { IPrimeTransferAtomData } from '../../states/jotai/atoms/prime';

let mockState: Pick<IPrimeTransferAtomData, 'preparationProgress'>;
const mockPublishedPercentages: number[] = [];

// All credentials are inert fixtures. Browser timing is measured separately.
const mockSeed = {
  entropyWithLangPrefixed: 'fixture-entropy',
  seed: 'fixture-seed',
};
const mockImported = { privateKey: 'fixture-key' };
const mockDecryptSeed = jest.fn(async (_params: unknown) => mockSeed);
const mockDecryptImported = jest.fn(async (_params: unknown) => mockImported);
const mockKdfParams = jest.fn<IPbkdf2KdfParams, []>();
const mockGetWallets = jest.fn<Promise<{ wallets: IDBWallet[] }>, []>();
const mockGetAllAccounts = jest.fn<Promise<{ accounts: IDBAccount[] }>, []>();
const mockCheckPasswordSet = jest.fn(async () => true);
const mockGetCredentialRaw = jest.fn<Promise<string | undefined>, []>();

function walletFixture(overrides: Partial<IDBWallet> = {}): IDBWallet {
  return {
    id: 'hd-fixture',
    name: 'Fixture wallet',
    type: 'hd',
    backuped: true,
    accounts: [],
    nextIds: {},
    walletNo: 1,
    ...overrides,
  };
}

function accountApi() {
  return {
    getWallets: mockGetWallets,
    getAllAccounts: mockGetAllAccounts,
    getWalletSafe: async () => undefined,
    getAccountCreatedNetworkId: async () => undefined,
  };
}

jest.mock('@onekeyhq/core/src/secret', () => ({
  decryptRevealableSeed: (...args: [unknown]) => mockDecryptSeed(...args),
  decryptImportedCredential: (...args: [unknown]) =>
    mockDecryptImported(...args),
}));
jest.mock('@onekeyhq/shared/src/appCrypto', () => ({
  __esModule: true,
  default: { pbkdf2: { getPbkdf2KdfParamsForNonDbTx: () => mockKdfParams() } },
}));
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
jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getCredentialRaw: () => mockGetCredentialRaw(),
    refillAccountOrderInfo: () => undefined,
  },
}));
jest.mock('../../dbs/local/localSecretEnvelope', () => ({}));
jest.mock('../../endpoints', () => ({}));
jest.mock('../../utils/secretEncryptFormat', () => ({
  EAppCryptoSharedEncryptScene: {
    primeTransferCredentials: 'primeTransferCredentials',
  },
  encryptStringAsyncWithFormat: async () => 'fixture-wrapped-credentials',
}));
jest.mock('../ServiceCloudBackup', () => ({}));
jest.mock('./e2ee/e2eeClientToClientApi', () => ({}));
jest.mock('./e2ee/e2eeClientToClientApiProxy', () => ({}));
jest.mock('./e2ee/e2eeServerApiProxy', () => ({}));
jest.mock('./servicePrimeTransferUtils', () => ({
  ...jest.requireActual<typeof import('./servicePrimeTransferUtils')>(
    './servicePrimeTransferUtils',
  ),
  normalizePrimeTransferCredential: (value: string) => value,
  shouldUseCliBotWalletEncryptedCredential: () => false,
}));
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
  EPrimeTransferStatus: { transferring: 'transferring' },
  primeTransferAtom: {
    get: async () => ({
      ...mockState,
      status: 'transferring',
      pairedRoomId: 'room',
      myUserId: 'sender',
      transferDirection: { fromUserId: 'sender' },
    }),
    set: async (update: (state: typeof mockState) => typeof mockState) => {
      mockState = update(mockState);
      if (mockState.preparationProgress)
        mockPublishedPercentages.push(mockState.preparationProgress.percentage);
    },
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { emit: jest.fn() },
}));

function fixture(): IPrimeTransferData {
  return {
    isEmptyData: false,
    isWatchingOnly: false,
    appVersion: '6.4.0',
    publicData: undefined,
    privateData: {
      credentials: {
        'hd-fixture': 'fixture-hd-ciphertext',
        'imported--60--fixture': 'fixture-imported-ciphertext',
        'imported--607--fixture--ton_credential': 'fixture-ton-ciphertext',
      },
      wallets: {},
      importedAccounts: {},
      watchingAccounts: {},
    },
  };
}

beforeEach(() => {
  mockState = {};
  mockPublishedPercentages.length = 0;
  mockDecryptSeed.mockClear();
  mockDecryptImported.mockClear();
  mockKdfParams.mockReset();
  mockGetWallets.mockReset().mockResolvedValue({ wallets: [walletFixture()] });
  mockGetAllAccounts.mockReset().mockResolvedValue({ accounts: [] });
  mockCheckPasswordSet.mockReset().mockResolvedValue(true);
  mockGetCredentialRaw.mockReset();
});

function deferred<T>() {
  let resolveValue!: (result: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });
  return { promise, resolve: resolveValue };
}

test('password confirmation gates progress and preparation, and the verified password is reused through sending', async () => {
  const password = deferred<{ password: string }>();
  const promptStarted = deferred<void>();
  const prompt = jest.fn(() => {
    promptStarted.resolve();
    return password.promise;
  });
  const service = new ServicePrimeTransfer({
    backgroundApi: {
      serviceAccount: accountApi(),
      servicePassword: {
        checkPasswordSet: mockCheckPasswordSet,
        promptPasswordVerify: prompt,
      },
    },
  });
  jest
    .spyOn(service, 'checkWebSocketConnected')
    .mockImplementation(() => undefined);
  // Stub the peer/network boundaries; exercise the real credential preparation.
  Object.defineProperty(service, 'resolvePeerSupportsV2Envelope', {
    value: async () => true,
  });
  const send = jest.fn(async () => undefined);
  Object.defineProperty(service, 'sendPreparedTransferData', { value: send });
  const taskId = await service.beginTransferPreparation();
  const authorization = service.authorizeTransferPreparation({ taskId });
  await promptStarted.promise;
  expect(prompt).toHaveBeenCalledWith({
    reason: EReasonForNeedPassword.Security,
  });
  expect(mockState.preparationProgress).toBeUndefined();
  await expect(
    service.buildTransferData({ preparationTaskId: taskId }),
  ).rejects.toThrow('password verification is required');
  await expect(
    service.sendTransferData({
      transferData: fixture(),
      preparationTaskId: taskId,
    }),
  ).rejects.toThrow('password verification is required');
  expect(mockGetWallets).toHaveBeenCalledTimes(1);
  expect(mockGetAllAccounts).not.toHaveBeenCalled();
  expect(mockDecryptSeed).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
  password.resolve({ password: 'fixture-verified-password' });
  await authorization;
  expect(mockState.preparationProgress).toEqual({ taskId, percentage: 0 });
  await service.sendTransferData({
    transferData: fixture(),
    preparationTaskId: taskId,
  });
  expect(prompt).toHaveBeenCalledTimes(1);
  expect(mockDecryptSeed).toHaveBeenCalledWith(
    expect.objectContaining({ password: 'fixture-verified-password' }),
  );
  expect(send).toHaveBeenCalledTimes(1);
  await service.cancelNetworkTransfer();
  const nextTaskId = await service.beginTransferPreparation();
  await expect(
    service.sendTransferData({
      transferData: fixture(),
      preparationTaskId: nextTaskId,
    }),
  ).rejects.toThrow('password verification is required');
  await service.cancelNetworkTransfer();
});

test.each(['rejected', 'empty'] as const)(
  'unsuccessful authentication never publishes preparation progress: %s',
  async (result) => {
    const service = new ServicePrimeTransfer({
      backgroundApi: {
        serviceAccount: accountApi(),
        servicePassword: {
          checkPasswordSet: mockCheckPasswordSet,
          promptPasswordVerify: async () => {
            if (result === 'rejected')
              throw new OneKeyLocalError('Password verification cancelled');
            return { password: '' };
          },
        },
      },
    });
    jest
      .spyOn(service, 'checkWebSocketConnected')
      .mockImplementation(() => undefined);
    const taskId = await service.beginTransferPreparation();
    await expect(
      service.authorizeTransferPreparation({ taskId }),
    ).rejects.toThrow();
    expect(mockPublishedPercentages).toEqual([]);
    await expect(
      service.buildTransferData({ preparationTaskId: taskId }),
    ).rejects.toThrow('password verification is required');
    await service.cancelNetworkTransfer();
  },
);

test('a password result arriving after cancellation cannot authorize a replacement task', async () => {
  const oldPassword = deferred<{ password: string }>();
  const promptStarted = deferred<void>();
  const prompt = jest
    .fn()
    .mockImplementationOnce(() => {
      promptStarted.resolve();
      return oldPassword.promise;
    })
    .mockResolvedValue({ password: 'fixture-new-password' });
  const service = new ServicePrimeTransfer({
    backgroundApi: {
      serviceAccount: accountApi(),
      servicePassword: {
        checkPasswordSet: mockCheckPasswordSet,
        promptPasswordVerify: prompt,
      },
    },
  });
  jest
    .spyOn(service, 'checkWebSocketConnected')
    .mockImplementation(() => undefined);
  const oldTaskId = await service.beginTransferPreparation();
  const authorization = service
    .authorizeTransferPreparation({ taskId: oldTaskId })
    .catch((error: unknown) => error);
  await promptStarted.promise;
  await service.cancelNetworkTransfer();
  const taskId = await service.beginTransferPreparation();
  await service.authorizeTransferPreparation({ taskId });
  oldPassword.resolve({ password: 'fixture-old-password' });
  expect(await authorization).toEqual(
    expect.objectContaining({ message: 'Transfer cancelled' }),
  );
  await service.decryptTransferDataCredentials({
    data: fixture(),
    preparationTaskId: taskId,
  });
  expect(mockDecryptSeed).toHaveBeenCalledWith(
    expect.objectContaining({ password: 'fixture-new-password' }),
  );
  expect(mockState.preparationProgress?.taskId).toBe(taskId);
  await service.cancelNetworkTransfer();
});

test.each([
  { hasPassword: false, hasAccounts: false },
  { hasPassword: false, hasAccounts: true },
  { hasPassword: true, hasAccounts: false },
  { hasPassword: true, hasAccounts: true },
])(
  'watch-only and empty exports never prompt for a password: %p',
  async ({ hasPassword, hasAccounts }) => {
    mockCheckPasswordSet.mockResolvedValue(hasPassword);
    mockGetWallets.mockResolvedValue({
      wallets: [
        walletFixture({ id: 'watching', type: 'watching' }),
        walletFixture({ id: 'imported', type: 'imported' }),
        walletFixture({ id: 'hd-keyless', isKeyless: true }),
        walletFixture({ id: 'hd-bot--parent-1--0' }),
      ],
    });
    mockGetAllAccounts.mockResolvedValue({
      accounts: hasAccounts
        ? [
            {
              id: 'watching--60--fixture',
              name: 'Fixture account',
              type: undefined,
              path: '',
              coinType: '60',
              impl: 'evm',
              pub: '',
              address: 'fixture-address',
            },
          ]
        : [],
    });
    const prompt = jest.fn();
    const service = new ServicePrimeTransfer({
      backgroundApi: {
        serviceAccount: accountApi(),
        servicePassword: {
          checkPasswordSet: mockCheckPasswordSet,
          promptPasswordVerify: prompt,
        },
      },
    });
    jest
      .spyOn(service, 'checkWebSocketConnected')
      .mockImplementation(() => undefined);
    const send = jest.fn(async () => undefined);
    Object.defineProperty(service, 'sendPreparedTransferData', { value: send });
    const taskId = await service.beginTransferPreparation();
    await service.authorizeTransferPreparation({ taskId });
    await service.authorizeTransferPreparation({ taskId });
    const data = await service.buildTransferData({ preparationTaskId: taskId });
    expect(data.isEmptyData).toBe(!hasAccounts);
    expect(data.isWatchingOnly).toBe(hasAccounts);
    if (hasAccounts) {
      await service.sendTransferData({
        transferData: data,
        preparationTaskId: taskId,
      });
      expect(send).toHaveBeenCalledTimes(1);
    }
    expect(prompt).not.toHaveBeenCalled();
    expect(mockGetCredentialRaw).not.toHaveBeenCalled();
    expect(mockDecryptSeed).not.toHaveBeenCalled();
    await service.cancelNetworkTransfer();
  },
);

test('private wallets created after watch-only authorization cannot expose credentials', async () => {
  mockGetWallets.mockResolvedValue({ wallets: [] });
  const prompt = jest.fn();
  const service = new ServicePrimeTransfer({
    backgroundApi: {
      serviceAccount: accountApi(),
      servicePassword: {
        checkPasswordSet: mockCheckPasswordSet,
        promptPasswordVerify: prompt,
      },
    },
  });
  jest
    .spyOn(service, 'checkWebSocketConnected')
    .mockImplementation(() => undefined);
  const taskId = await service.beginTransferPreparation();
  await service.authorizeTransferPreparation({ taskId });
  mockGetWallets.mockResolvedValue({ wallets: [walletFixture()] });
  await expect(
    service.buildTransferData({ preparationTaskId: taskId }),
  ).rejects.toThrow('password verification is required');
  await expect(
    service.sendTransferData({
      transferData: fixture(),
      preparationTaskId: taskId,
    }),
  ).rejects.toThrow('Password is required');
  expect(prompt).not.toHaveBeenCalled();
  expect(mockGetCredentialRaw).not.toHaveBeenCalled();
  expect(mockDecryptSeed).not.toHaveBeenCalled();
  await service.cancelNetworkTransfer();
});

test.each([
  walletFixture({
    id: 'imported',
    type: 'imported',
    accounts: ['imported--60--fixture'],
  }),
  walletFixture({ id: 'hd-bot--parent-1--0' }),
])(
  'explicit private wallet exports still require verification: $id',
  async (wallet) => {
    mockGetWallets.mockResolvedValue({ wallets: [wallet] });
    const prompt = jest.fn(async () => ({ password: 'fixture-password' }));
    const service = new ServicePrimeTransfer({
      backgroundApi: {
        serviceAccount: accountApi(),
        servicePassword: {
          checkPasswordSet: mockCheckPasswordSet,
          promptPasswordVerify: prompt,
        },
      },
    });
    jest
      .spyOn(service, 'checkWebSocketConnected')
      .mockImplementation(() => undefined);
    const taskId = await service.beginTransferPreparation();
    await service.authorizeTransferPreparation({
      taskId,
      walletIds: [wallet.id],
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(mockGetAllAccounts).not.toHaveBeenCalled();
    expect(mockState.preparationProgress).toEqual({ taskId, percentage: 0 });
    await service.cancelNetworkTransfer();
  },
);

test('private wallet metadata without a configured password fails without opening password setup', async () => {
  mockCheckPasswordSet.mockResolvedValue(false);
  const prompt = jest.fn();
  const service = new ServicePrimeTransfer({
    backgroundApi: {
      serviceAccount: accountApi(),
      servicePassword: {
        checkPasswordSet: mockCheckPasswordSet,
        promptPasswordVerify: prompt,
      },
    },
  });
  jest
    .spyOn(service, 'checkWebSocketConnected')
    .mockImplementation(() => undefined);
  const taskId = await service.beginTransferPreparation();
  await expect(
    service.authorizeTransferPreparation({ taskId }),
  ).rejects.toThrow('Password is required');
  expect(prompt).not.toHaveBeenCalled();
  expect(mockGetAllAccounts).not.toHaveBeenCalled();
  expect(mockState.preparationProgress).toBeUndefined();
  await service.cancelNetworkTransfer();
});

test('reports credential work, then clears preparation on cancellation', async () => {
  const service = new ServicePrimeTransfer({
    backgroundApi: {
      serviceAccount: accountApi(),
      servicePassword: {
        checkPasswordSet: mockCheckPasswordSet,
        promptPasswordVerify: async () => ({ password: 'fixture-password' }),
      },
    },
  });
  jest
    .spyOn(service, 'checkWebSocketConnected')
    .mockImplementation(() => undefined);
  const preparationTaskId = await service.beginTransferPreparation();
  await service.authorizeTransferPreparation({ taskId: preparationTaskId });
  expect(mockState.preparationProgress).toEqual({
    taskId: preparationTaskId,
    percentage: 0,
  });
  await service.decryptTransferDataCredentials({
    data: fixture(),
    preparationTaskId,
  });
  expect(mockPublishedPercentages.at(-1)).toBe(75);
  expect(mockPublishedPercentages).toEqual(
    [...mockPublishedPercentages].toSorted((a, b) => a - b),
  );
  await service.cancelNetworkTransfer();
  expect(mockState.preparationProgress).toBeUndefined();
});

test('cancel during decryption stops remaining credentials and cannot overwrite a new preparation', async () => {
  const service = new ServicePrimeTransfer({
    backgroundApi: {
      serviceAccount: accountApi(),
      servicePassword: {
        checkPasswordSet: mockCheckPasswordSet,
        promptPasswordVerify: async () => ({ password: 'fixture-password' }),
      },
    },
  });
  jest
    .spyOn(service, 'checkWebSocketConnected')
    .mockImplementation(() => undefined);
  const preparationTaskId = await service.beginTransferPreparation();
  await service.authorizeTransferPreparation({ taskId: preparationTaskId });
  let release: (() => void) | undefined;
  let markStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  mockDecryptSeed.mockImplementationOnce(async () => {
    markStarted?.();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return mockSeed;
  });
  const pending = service.decryptTransferDataCredentials({
    data: fixture(),
    preparationTaskId,
  });
  const rejection = pending.catch((error: unknown) => error);
  await started;
  await service.cancelNetworkTransfer();
  const replacementTaskId = await service.beginTransferPreparation();
  await service.authorizeTransferPreparation({ taskId: replacementTaskId });
  release?.();
  expect(await rejection).toEqual(
    expect.objectContaining({ message: 'Transfer cancelled' }),
  );
  expect(mockDecryptImported).not.toHaveBeenCalled();
  expect(mockState.preparationProgress).toEqual({
    taskId: replacementTaskId,
    percentage: 0,
  });
  await service.cancelTransfer({ taskId: preparationTaskId });
  expect(mockState.preparationProgress?.taskId).toBe(replacementTaskId);
  await expect(
    service.sendTransferData({ transferData: fixture(), preparationTaskId }),
  ).rejects.toThrow('Transfer cancelled');
  await service.cancelNetworkTransfer();
});

test.each(['disconnected', 'notification-rejected', 'connected'] as const)(
  'local cancellation completes when the peer is %s and cannot cancel a replacement',
  async (connection) => {
    const service = new ServicePrimeTransfer({
      backgroundApi: {
        serviceAccount: accountApi(),
        servicePassword: {
          checkPasswordSet: mockCheckPasswordSet,
          promptPasswordVerify: async () => ({ password: 'fixture-password' }),
        },
      },
    });
    const checkSocket = jest
      .spyOn(service, 'checkWebSocketConnected')
      .mockImplementation(() => undefined);
    const notify = jest.fn(async () => {
      if (connection === 'notification-rejected')
        throw new OneKeyLocalError('Peer disconnected');
    });
    Object.defineProperty(service, 'e2eeClientToClientApiProxy', {
      value: { api: { cancelTransfer: notify } },
    });
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const taskId = await service.beginTransferPreparation();
      await service.authorizeTransferPreparation({ taskId });
      expect(mockState.preparationProgress).toBeDefined();
      if (connection === 'disconnected') {
        checkSocket.mockImplementationOnce(() => {
          throw new OneKeyLocalError('WebSocket not connected');
        });
      }
      await expect(service.cancelTransfer({ taskId })).resolves.toBeUndefined();
      expect(mockState.preparationProgress).toBeUndefined();
      expect(notify).toHaveBeenCalledTimes(
        connection === 'disconnected' ? 0 : 1,
      );
      expect(log).toHaveBeenCalledTimes(connection === 'connected' ? 0 : 1);

      const nextTask = await service.beginTransferPreparation();
      await service.authorizeTransferPreparation({ taskId: nextTask });
      await service.cancelTransfer({ taskId });
      expect(mockState.preparationProgress).toMatchObject({ taskId: nextTask });
      expect(notify).toHaveBeenCalledTimes(
        connection === 'disconnected' ? 0 : 1,
      );
      await service.cancelNetworkTransfer();
    } finally {
      log.mockRestore();
    }
  },
);

test.each<[boolean, IPbkdf2KdfParams]>([
  [true, { kdfBackend: 'webcrypto', enablePbkdf2Cache: true }],
  [false, { kdfBackend: 'webcrypto', enablePbkdf2Cache: true }],
  [false, { enablePbkdf2Cache: true }],
])(
  'credential preparation respects platform backend and wrapped-data cleanup: %s, %p',
  async (clearWrappedCredentialsAfterDecrypt, kdfParams) => {
    mockKdfParams.mockReturnValue(kdfParams);
    const data = fixture();
    const originalCredentials = data.privateData.credentials;
    const service = new ServicePrimeTransfer({
      backgroundApi: {
        serviceAccount: accountApi(),
        servicePassword: {
          checkPasswordSet: mockCheckPasswordSet,
          promptPasswordVerify: async () => ({ password: 'fixture-password' }),
        },
      },
    });
    await service.decryptTransferDataCredentials({
      data,
      clearWrappedCredentialsAfterDecrypt,
    });
    expect(mockDecryptSeed).toHaveBeenCalledTimes(2);
    expect(mockDecryptImported).toHaveBeenCalledTimes(1);
    for (const rs of ['fixture-hd-ciphertext', 'fixture-ton-ciphertext']) {
      expect(mockDecryptSeed).toHaveBeenCalledWith({
        rs,
        password: 'fixture-password',
        ...kdfParams,
      });
    }
    expect(mockDecryptImported).toHaveBeenCalledWith({
      credential: 'fixture-imported-ciphertext',
      password: 'fixture-password',
      ...kdfParams,
    });
    expect(data.privateData.decryptedCredentials).toEqual({
      'hd-fixture': mockSeed,
      'imported--60--fixture': mockImported,
      'imported--607--fixture--ton_credential': mockSeed,
    });
    expect(data.privateData.credentials).toEqual(
      clearWrappedCredentialsAfterDecrypt ? {} : originalCredentials,
    );
  },
);

test.each(['hd', 'imported'] as const)(
  'remote password validation uses the platform KDF without accepting a wrong password: %s',
  async (kind) => {
    const kdfParams: IPbkdf2KdfParams = {
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: true,
    };
    mockKdfParams.mockReturnValue(kdfParams);
    const service = new ServicePrimeTransfer({ backgroundApi: {} });
    const params = {
      password: 'fixture-password',
      walletCredential: kind === 'hd' ? 'fixture-ciphertext' : undefined,
      importedAccountCredential:
        kind === 'imported' ? 'fixture-ciphertext' : undefined,
    };
    await expect(service.verifyCredentialCanBeDecrypted(params)).resolves.toBe(
      true,
    );
    const decrypt = kind === 'hd' ? mockDecryptSeed : mockDecryptImported;
    expect(decrypt).toHaveBeenCalledWith(expect.objectContaining(kdfParams));
    decrypt.mockRejectedValueOnce(new Error('Incorrect password'));
    await expect(service.verifyCredentialCanBeDecrypted(params)).resolves.toBe(
      false,
    );
  },
);
