import type { IPbkdf2KdfParams } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import ServicePrimeTransfer from './ServicePrimeTransfer';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

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
jest.mock('../../utils/secretEncryptFormat', () => ({}));
jest.mock('../ServiceCloudBackup', () => ({}));
jest.mock('./e2ee/e2eeClientToClientApi', () => ({}));
jest.mock('./e2ee/e2eeClientToClientApiProxy', () => ({}));
jest.mock('./e2ee/e2eeServerApiProxy', () => ({}));
jest.mock('./servicePrimeTransferUtils', () => ({
  normalizePrimeTransferCredential: (value: string) => value,
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
jest.mock('../../states/jotai/atoms/prime', () => ({}));
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
  mockDecryptSeed.mockClear();
  mockDecryptImported.mockClear();
  mockKdfParams.mockReset();
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
