import type { IPbkdf2KdfParams } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import ServicePrimeTransfer from './ServicePrimeTransfer';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
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
jest.mock('../../dbs/local/localDb', () => ({}));
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
});

function deferredPassword() {
  let resolvePassword: (result: { password: string }) => void = () => undefined;
  const promise = new Promise<{ password: string }>((resolve) => {
    resolvePassword = resolve;
  });
  return { promise, resolve: resolvePassword };
}

test('password confirmation gates progress and preparation, and the verified password is reused through sending', async () => {
  const password = deferredPassword();
  const prompt = jest.fn(() => password.promise);
  const getWallets = jest.fn();
  const service = new ServicePrimeTransfer({
    backgroundApi: {
      servicePassword: { promptPasswordVerify: prompt },
      serviceAccount: { getWallets },
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
  expect(getWallets).not.toHaveBeenCalled();
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
        servicePassword: {
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
  const oldPassword = deferredPassword();
  const prompt = jest
    .fn()
    .mockReturnValueOnce(oldPassword.promise)
    .mockResolvedValue({ password: 'fixture-new-password' });
  const service = new ServicePrimeTransfer({
    backgroundApi: { servicePassword: { promptPasswordVerify: prompt } },
  });
  jest
    .spyOn(service, 'checkWebSocketConnected')
    .mockImplementation(() => undefined);
  const oldTaskId = await service.beginTransferPreparation();
  const authorization = service
    .authorizeTransferPreparation({ taskId: oldTaskId })
    .catch((error: unknown) => error);
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

test('reports credential work, then clears preparation on cancellation', async () => {
  const service = new ServicePrimeTransfer({
    backgroundApi: {
      servicePassword: {
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
      servicePassword: {
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
        servicePassword: {
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
