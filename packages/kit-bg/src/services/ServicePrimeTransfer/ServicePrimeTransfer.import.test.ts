import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  decryptRevealableSeed,
  decryptStringAsync,
} from '@onekeyhq/core/src/secret';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IPrimeTransferAccount,
  IPrimeTransferHDWallet,
  IPrimeTransferSelectedData,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import localDb from '../../dbs/local/localDb';
import { primeTransferAtom } from '../../states/jotai/atoms/prime';
import ServiceCloudBackupV2 from '../ServiceCloudBackupV2/ServiceCloudBackupV2';

import ServicePrimeTransfer from './ServicePrimeTransfer';

import type ServiceBatchCreateAccount from '../ServiceBatchCreateAccount/ServiceBatchCreateAccount';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const passthrough =
    () =>
    (...args: unknown[]) =>
      args.length === 1 ? args[0] : args[2];
  return {
    backgroundClass: passthrough,
    backgroundMethod: passthrough,
    toastIfError: passthrough,
  };
});
jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('@onekeyhq/core/src/secret', () => ({
  revealEntropyToMnemonic: jest.fn(() => 'synthetic mnemonic'),
  decryptRevealableSeed: jest.fn(),
  decryptStringAsync: jest.fn(),
  encryptRevealableSeed: jest.fn(async () => 'synthetic wrapped seed'),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { prime: { transfer: { importError: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/timerUtils')
  >('@onekeyhq/shared/src/utils/timerUtils');
  return {
    __esModule: true,
    ...actual,
    default: { ...actual.default, wait: jest.fn(async () => undefined) },
  };
});
jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: { saveTonImportedAccountMnemonic: jest.fn() },
}));
jest.mock('../../states/jotai/atoms', () => ({
  devSettingsPersistAtom: { get: jest.fn(async () => ({ enabled: false })) },
}));
jest.mock('../../states/jotai/atoms/prime', () => ({
  primeTransferAtom: {
    get: jest.fn(async () => ({})),
    set: jest.fn(async () => undefined),
  },
}));
jest.mock('../ServiceCloudBackup', () => ({ HDWALLET_BACKUP_VERSION: 1 }));
jest.mock('./e2ee/e2eeClientToClientApi', () => ({}));
jest.mock('./e2ee/e2eeClientToClientApiProxy', () => ({}));
jest.mock('./e2ee/e2eeServerApiProxy', () => ({}));
jest.mock('../../endpoints', () => ({}));

function account(
  id: string,
  overrides: Partial<IPrimeTransferAccount> = {},
): IPrimeTransferAccount {
  return {
    id,
    name: `name-${id}`,
    address: `address-${id}`,
    version: 1,
    type: undefined,
    template: undefined,
    path: undefined,
    createAtNetwork: 'btc--0',
    networks: undefined,
    impl: 'btc',
    coinType: '0',
    accountOrder: undefined,
    accountOrderSaved: undefined,
    pub: undefined,
    xpub: undefined,
    xpubSegwit: undefined,
    ...overrides,
  };
}
function wallet(id: string): IPrimeTransferHDWallet {
  return {
    id,
    name: id,
    type: 'hd',
    backuped: true,
    nextIds: {},
    version: 1,
    accounts: [],
    accountIds: [],
    accountIdsLength: 1,
    indexedAccountUUIDs: [],
    indexedAccountUUIDsLength: 1,
    indexedAccountNames: { 0: 'first', 1: 'second' },
    createNetworkParams: [
      { index: 0, customNetworks: [] },
      { index: 1, customNetworks: [] },
    ],
  };
}
function data(
  overrides: Partial<IPrimeTransferSelectedData> = {},
): IPrimeTransferSelectedData {
  return {
    wallets: [],
    importedAccounts: [],
    watchingAccounts: [],
    ...overrides,
  };
}
function selectedAccount(
  id: string,
  overrides?: Partial<IPrimeTransferAccount>,
) {
  return {
    id,
    item: account(id, overrides),
    credentialDecrypted: { privateKey: 'synthetic key' },
  };
}
function selectedWallet(id: string) {
  return {
    id,
    item: wallet(id),
    credentialDecrypted: {
      seed: 'synthetic seed',
      entropyWithLangPrefixed: 'synthetic entropy',
    },
  };
}
async function prepareTask(service: ServicePrimeTransfer) {
  const taskUUID = await service.prepareImportTask();
  if (!taskUUID) throw new OneKeyLocalError('Expected an import reservation');
  return taskUUID;
}

function setup() {
  const serviceAccount = {
    getAccountCreatedNetworkId: jest.fn(
      async ({ account: item }: { account: { createAtNetwork?: string } }) =>
        item.createAtNetwork,
    ),
    getPrivateKeyOfImportedAccountCredential: jest.fn(
      async ({
        credentialDecrypted,
      }: {
        credentialDecrypted?: { privateKey: string };
      }) => {
        if (!credentialDecrypted)
          throw new OneKeyLocalError(
            'getPrivateKeyOfImportedAccountCredential Error: Encrypted credential is required',
          );
        return credentialDecrypted;
      },
    ),
    getExportedPrivateKeyOfImportedAccount: jest.fn(async () => ({
      privateKey: 'synthetic key',
      exportedPrivateKey: 'synthetic export',
    })),
    restoreImportedAccountByInput: jest.fn(
      async ({
        importedAccount,
      }: {
        importedAccount: IPrimeTransferAccount;
        onError: (params: { stage: string; error: unknown }) => void;
      }) => ({ addedAccounts: [{ id: importedAccount.id }] }),
    ),
    restoreWatchingAccountByInput: jest.fn(
      async ({
        watchingAccount,
      }: {
        watchingAccount: IPrimeTransferAccount;
        onError: (params: { stage: string; error: unknown }) => void;
      }) => ({ addedAccounts: [{ id: watchingAccount.id }] }),
    ),
    createHDWalletWithRevealableSeed: jest.fn(
      async ({ name }: { name: string }) => ({ wallet: { id: name } }),
    ),
    setWalletNameAndAvatar: jest.fn(),
    setAccountName: jest.fn(),
  };
  const serviceNetwork = {
    getDeriveTypeByDBAccount: jest.fn(async () => ({ deriveType: 'BIP86' })),
  };
  const batch = jest.fn(
    async (): Promise<
      Awaited<
        ReturnType<
          ServiceBatchCreateAccount['startBatchCreateAccountsFlowForAllNetwork']
        >
      >
    > => ({ addedAccounts: [], failedAccounts: [] }),
  );
  const service = new ServicePrimeTransfer({
    backgroundApi: {
      serviceAccount,
      serviceNetwork,
      servicePassword: {
        encodeSensitiveText: jest.fn(
          async ({ text }: { text: string }) => text,
        ),
      },
      serviceBatchCreateAccount: {
        startBatchCreateAccountsFlowForAllNetwork: batch,
      },
    },
  });
  jest.spyOn(service, 'finallyImportProgress').mockResolvedValue();
  const run = async (
    selectedTransferData: IPrimeTransferSelectedData,
    isFromCloudBackupRestore = true,
  ) =>
    service.startImport({
      taskUUID: await prepareTask(service),
      selectedTransferData,
      password: 'synthetic password',
      localPassword: 'synthetic password',
      isFromCloudBackupRestore,
    });
  return { service, serviceAccount, serviceNetwork, batch, run };
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

describe('per-item import failures', () => {
  it('restores available items from a synthetic backup with 40 missing credentials', async () => {
    const { serviceAccount: a, run } = setup();
    const result = await run(
      data({
        wallets: Array.from({ length: 5 }, (_, i) => selectedWallet(`hd-${i}`)),
        importedAccounts: Array.from({ length: 43 }, (_, i) =>
          i < 3
            ? selectedAccount(`private-${i}`)
            : { id: `private-${i}`, item: account(`private-${i}`) },
        ),
        watchingAccounts: Array.from({ length: 55 }, (_, i) =>
          selectedAccount(`watching-${i}`),
        ),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.errorsInfo).toHaveLength(40);
    expect(a.createHDWalletWithRevealableSeed).toHaveBeenCalledTimes(5);
    expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(3);
    expect(a.restoreWatchingAccountByInput).toHaveBeenCalledTimes(55);
  });

  it('records a bad HD account parameter and keeps the other accounts in that wallet', async () => {
    const { service, serviceAccount: a } = setup();
    jest.spyOn(accountUtils, 'getHDAccountPathIndex').mockReturnValue(1);
    a.getAccountCreatedNetworkId.mockRejectedValueOnce(
      new Error('synthetic bad HD account'),
    );
    const errorsInfo: Awaited<
      ReturnType<ServicePrimeTransfer['startImport']>
    >['errorsInfo'] = [];
    const result = await service.buildHdWalletAccountsCreateParams({
      walletId: 'hd-test',
      taskUUID: await prepareTask(service),
      errorsInfo,
      accounts: ['bad', 'after'].map((id) => ({
        ...account(id),
        pathIndex: 1,
        indexedAccountId: undefined,
      })),
    });
    expect(errorsInfo).toHaveLength(1);
    expect(result.createNetworkParams).toEqual([
      {
        index: 1,
        customNetworks: [{ networkId: 'btc--0', deriveType: 'BIP86' }],
      },
    ]);
    expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'createHDWallet.createNetworkParams',
        itemIndex: 0,
      }),
    );
  });

  it('redacts unrecognized messages and custom error properties', async () => {
    const { serviceAccount: a, run } = setup();
    a.restoreImportedAccountByInput.mockRejectedValueOnce({
      name: 'synthetic-sensitive-name',
      message: 'synthetic-sensitive-message',
      code: 'synthetic-sensitive-code',
      stack: 'synthetic-sensitive-stack',
    });
    const result = await run(
      data({
        importedAccounts: [selectedAccount('first'), selectedAccount('after')],
      }),
    );
    expect(result.errorsInfo[0].error).toBe('Unknown error (message omitted)');
    expect(
      JSON.stringify(
        jest.mocked(defaultLogger.prime.transfer).importError.mock.calls,
      ),
    ).not.toContain('synthetic-sensitive');
  });

  it.each([true, false])(
    'continues after missing private credentials and reaches watching accounts (cloud=%s)',
    async (cloud) => {
      const { serviceAccount, run } = setup();
      const selected = data({
        importedAccounts: [
          selectedAccount('before'),
          { id: 'missing', item: account('missing') },
          selectedAccount('after'),
        ],
        watchingAccounts: [selectedAccount('watching')],
      });
      const result = await run(selected, cloud);
      expect(result.success).toBe(true);
      expect(result.errorsInfo).toEqual([
        expect.objectContaining({
          accountId: 'missing',
          error: 'Encrypted credential is required',
        }),
      ]);
      expect(
        serviceAccount.restoreImportedAccountByInput.mock.calls.map(
          ([p]) => p.importedAccount.id,
        ),
      ).toEqual(['before', 'after']);
      expect(
        serviceAccount.restoreWatchingAccountByInput,
      ).toHaveBeenCalledTimes(1);
      expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledWith(
        expect.objectContaining({
          flow: cloud ? 'cloudBackupRestore' : 'transfer',
          stage: 'decryptImportedAccountCredential',
          itemIndex: 1,
          error: 'Encrypted credential is required',
        }),
      );
      expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    'network',
    'missingNetwork',
    'decrypt',
    'restore',
    'fallbackDecrypt',
    'fallbackRestore',
  ])('continues after a private account %s failure', async (stage) => {
    const { serviceAccount: a, run } = setup();
    const failure = new Error('synthetic failure');
    if (stage === 'network')
      a.getAccountCreatedNetworkId.mockRejectedValueOnce(failure);
    if (stage === 'missingNetwork')
      a.getAccountCreatedNetworkId.mockResolvedValueOnce(undefined);
    if (stage === 'decrypt')
      a.getPrivateKeyOfImportedAccountCredential.mockRejectedValueOnce(failure);
    if (stage === 'restore')
      a.restoreImportedAccountByInput.mockRejectedValueOnce(failure);
    if (stage.startsWith('fallback')) {
      a.restoreImportedAccountByInput.mockResolvedValueOnce({
        addedAccounts: [],
      });
      if (stage === 'fallbackDecrypt')
        a.getExportedPrivateKeyOfImportedAccount.mockRejectedValueOnce(failure);
      else a.restoreImportedAccountByInput.mockRejectedValueOnce(failure);
    }
    const result = await run(
      data({
        importedAccounts: [selectedAccount('bad'), selectedAccount('after')],
      }),
    );
    expect(result.errorsInfo).toHaveLength(1);
    expect(a.restoreImportedAccountByInput).toHaveBeenLastCalledWith(
      expect.objectContaining({
        importedAccount: expect.objectContaining({ id: 'after' }),
      }),
    );
    expect(result.success).toBe(true);
  });

  it.each([
    'network',
    'missingNetwork',
    'pub',
    'xpub',
    'xpubSegwit',
    'address',
  ])('continues after a watching account %s failure', async (stage) => {
    const { serviceAccount: a, run } = setup();
    const failure = new Error('synthetic watching failure');
    if (stage === 'network')
      a.getAccountCreatedNetworkId.mockRejectedValueOnce(failure);
    else if (stage === 'missingNetwork')
      a.getAccountCreatedNetworkId.mockResolvedValueOnce(undefined);
    else a.restoreWatchingAccountByInput.mockRejectedValueOnce(failure);
    const result = await run(
      data({
        watchingAccounts: [
          selectedAccount('bad', { [stage]: 'synthetic input' }),
          selectedAccount('after'),
        ],
      }),
    );
    expect(result.errorsInfo).toEqual([
      expect.objectContaining({
        accountId: 'bad',
        category: 'importWatchingAccount',
      }),
    ]);
    expect(a.restoreWatchingAccountByInput).toHaveBeenLastCalledWith(
      expect.objectContaining({
        watchingAccount: expect.objectContaining({ id: 'after' }),
      }),
    );
    expect(result.success).toBe(true);
  });

  it.each(['create', 'parameters', 'batch', 'name'])(
    'continues HD imports after %s failure and reaches private accounts',
    async (stage) => {
      const { service, serviceAccount: a, batch, run } = setup();
      const first = selectedWallet('bad');
      const failure = new Error('synthetic HD failure');
      if (stage === 'create')
        a.createHDWalletWithRevealableSeed.mockRejectedValueOnce(failure);
      if (stage === 'parameters') {
        first.item.createNetworkParams = [];
        jest
          .spyOn(service, 'buildHdWalletAccountsCreateParams')
          .mockRejectedValueOnce(failure);
      }
      if (stage === 'batch') batch.mockRejectedValueOnce(failure);
      if (stage === 'name') a.setAccountName.mockRejectedValueOnce(failure);
      const result = await run(
        data({
          wallets: [first, selectedWallet('after')],
          importedAccounts: [selectedAccount('private')],
        }),
      );
      expect(result.errorsInfo).toHaveLength(1);
      expect(a.createHDWalletWithRevealableSeed).toHaveBeenCalledTimes(2);
      expect(batch).toHaveBeenLastCalledWith(
        expect.objectContaining({ walletId: 'after', fromIndex: 1 }),
      );
      if (stage === 'batch')
        expect(batch).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ walletId: 'bad', fromIndex: 1 }),
        );
      expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(1);
    },
  );

  it('continues after an HD wallet with missing credentials', async () => {
    const { serviceAccount: a, run } = setup();
    const result = await run(
      data({
        wallets: [{ id: 'bad', item: wallet('bad') }, selectedWallet('after')],
      }),
    );
    expect(result.errorsInfo).toEqual([
      expect.objectContaining({
        walletId: 'bad',
        error: 'Credential is required',
      }),
    ]);
    expect(a.createHDWalletWithRevealableSeed).toHaveBeenCalledTimes(1);
  });

  it.each(['decrypt', 'save'])(
    'records TON mnemonic %s failure and continues',
    async (stage) => {
      const { serviceAccount: a, run } = setup();
      const first = {
        ...selectedAccount('ton'),
        tonMnemonicCredential: 'synthetic wrapped seed',
      };
      if (stage === 'decrypt')
        jest
          .mocked(decryptRevealableSeed)
          .mockRejectedValueOnce(new Error('synthetic TON failure'));
      else {
        jest.mocked(decryptRevealableSeed).mockResolvedValueOnce({
          seed: 'synthetic seed',
          entropyWithLangPrefixed: 'synthetic entropy',
        });
        jest
          .mocked(localDb)
          .saveTonImportedAccountMnemonic.mockRejectedValueOnce(
            new Error('synthetic TON failure'),
          );
      }
      const result = await run(
        data({ importedAccounts: [first, selectedAccount('after')] }),
      );
      expect(result.errorsInfo).toEqual([
        expect.objectContaining({ category: 'restoreTonMnemonicCredential' }),
      ]);
      expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(2);
    },
  );

  it('keeps raw SDK error payloads and wallet data out of local logs and summaries', async () => {
    const { serviceAccount: a, run } = setup();
    const secret = 'synthetic-sensitive-value';
    const failure = Object.assign(new Error(`Invalid private key: ${secret}`), {
      code: 17,
      cause: { seed: secret },
      privateKey: secret,
    });
    a.restoreImportedAccountByInput.mockRejectedValueOnce(failure);
    const result = await run(
      data({ importedAccounts: [selectedAccount(secret)] }),
    );
    const logged = JSON.stringify(
      jest.mocked(defaultLogger.prime.transfer).importError.mock.calls,
    );
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain('stack');
    expect(logged).toContain('Invalid private key');
    expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 17 }),
    );
    expect(result.errorsInfo[0].error).toBe('Invalid private key');
  });

  it.each([
    EOneKeyErrorClassNames.PasswordPromptDialogCancel,
    EOneKeyErrorClassNames.PrimeTransferImportCancelledError,
    EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable,
    EOneKeyErrorClassNames.LocalDbOpenError,
  ])('propagates serialized %s instead of continuing', async (className) => {
    const { serviceAccount: a, run } = setup();
    const failure = { className, message: 'synthetic fatal failure' };
    a.restoreImportedAccountByInput.mockRejectedValueOnce(failure);
    await expect(
      run(
        data({
          importedAccounts: [
            selectedAccount('first'),
            selectedAccount('after'),
          ],
        }),
      ),
    ).rejects.toBe(failure);
    expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(1);
  });

  it('honors task cancellation after a recoverable error', async () => {
    const { service, serviceAccount: a, run } = setup();
    a.restoreImportedAccountByInput.mockImplementationOnce(async () => {
      service.currentImportTaskUUID = undefined;
      throw new OneKeyLocalError('synthetic failure during cancellation');
    });
    const result = await run(
      data({
        importedAccounts: [selectedAccount('first'), selectedAccount('after')],
        watchingAccounts: [selectedAccount('watching')],
      }),
    );
    expect(result.success).toBe(false);
    expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(1);
    expect(a.restoreWatchingAccountByInput).not.toHaveBeenCalled();
  });

  it('still rejects an undecryptable whole transfer payload', async () => {
    const { service, serviceAccount: a } = setup();
    const failure = new Error('synthetic whole payload failure');
    jest.mocked(decryptStringAsync).mockRejectedValueOnce(failure);
    await expect(
      service.startImport({
        taskUUID: await prepareTask(service),
        selectedTransferData: data({
          importedAccounts: [selectedAccount('first')],
        }),
        decryptedCredentialsHex: 'synthetic wrapped payload',
        password: 'synthetic password',
      }),
    ).rejects.toBe(failure);
    expect(a.restoreImportedAccountByInput).not.toHaveBeenCalled();
  });

  it('finalizes partial imports with failure statistics and completed progress', async () => {
    const { service, run } = setup();
    const result = await run(
      data({
        importedAccounts: [
          { id: 'missing', item: account('missing') },
          selectedAccount('after'),
        ],
      }),
    );
    await service.completeImportProgress(result);
    const updater = jest.mocked(primeTransferAtom.set).mock.calls.at(-1)?.[0];
    if (typeof updater !== 'function')
      throw new OneKeyLocalError('Expected the final progress update');
    const next = updater({
      ...(await primeTransferAtom.get()),
      importProgress: {
        taskUUID: result.taskUUID,
        total: 2,
        current: 1,
        isImporting: true,
      },
    });
    expect(next.importProgress).toEqual(
      expect.objectContaining({
        current: 2,
        isImporting: false,
        stats: expect.objectContaining({
          errorsInfo: result.errorsInfo,
          progressCurrent: 1,
        }),
      }),
    );
  });
});

describe('errors reported by account restore helpers', () => {
  it('counts a fully failed private restore once and continues to the next account', async () => {
    const { serviceAccount: a, run } = setup();
    const fail = async ({
      onError,
    }: Parameters<typeof a.restoreImportedAccountByInput>[0]) => {
      onError({
        stage: 'addImportedAccountWithCredential',
        error: new Error('sensitive SDK input'),
      });
      return { addedAccounts: [] };
    };
    a.restoreImportedAccountByInput
      .mockImplementationOnce(fail)
      .mockImplementationOnce(fail);
    const result = await run(
      data({
        importedAccounts: [selectedAccount('bad'), selectedAccount('next')],
      }),
    );
    expect(result.errorsInfo).toHaveLength(1);
    expect(result.errorsInfo[0].accountId).toBe('bad');
    expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(3);
    expect(
      JSON.stringify(
        jest.mocked(defaultLogger.prime.transfer.importError).mock.calls,
      ),
    ).not.toContain('sensitive SDK input');
  });

  it('retains a successful private-key fallback after a candidate error', async () => {
    const { serviceAccount: a, run } = setup();
    a.restoreImportedAccountByInput.mockImplementationOnce(
      async ({ onError }) => {
        onError({
          stage: 'addImportedAccountWithCredential',
          error: new Error('unsupported candidate'),
        });
        return { addedAccounts: [] };
      },
    );
    const result = await run(
      data({ importedAccounts: [selectedAccount('fallback')] }),
    );
    expect(result.errorsInfo).toHaveLength(0);
    expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(2);
    expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'addImportedAccountWithCredential',
        itemIndex: 0,
      }),
    );
  });

  it('retains address fallback after a watching public-key error', async () => {
    const { serviceAccount: a, run } = setup();
    a.restoreWatchingAccountByInput.mockImplementationOnce(
      async ({ onError }) => {
        onError({
          stage: 'addWatchingAccount',
          error: new Error('invalid pub'),
        });
        return { addedAccounts: [] };
      },
    );
    const result = await run(
      data({
        watchingAccounts: [
          selectedAccount('fallback', { pub: 'invalid pub' }),
          selectedAccount('next'),
        ],
      }),
    );
    expect(result.errorsInfo).toHaveLength(0);
    expect(a.restoreWatchingAccountByInput).toHaveBeenCalledTimes(3);
  });

  it('counts a fully failed watching restore and continues', async () => {
    const { serviceAccount: a, run } = setup();
    a.restoreWatchingAccountByInput.mockImplementationOnce(
      async ({ onError }) => {
        onError({
          stage: 'addWatchingAccount',
          error: new Error('invalid address'),
        });
        return { addedAccounts: [] };
      },
    );
    const result = await run(
      data({
        watchingAccounts: [selectedAccount('bad'), selectedAccount('next')],
      }),
    );
    expect(result.errorsInfo).toHaveLength(1);
    expect(result.errorsInfo[0].accountId).toBe('bad');
    expect(a.restoreWatchingAccountByInput).toHaveBeenCalledTimes(2);
  });

  it('propagates a fatal error reported from inside a restore helper', async () => {
    const { serviceAccount: a, run } = setup();
    const error = {
      className: EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable,
    };
    a.restoreImportedAccountByInput.mockImplementationOnce(
      async ({ onError }) => {
        onError({ stage: 'addImportedAccountWithCredential', error });
        return { addedAccounts: [] };
      },
    );
    await expect(
      run(
        data({
          importedAccounts: [selectedAccount('fatal'), selectedAccount('next')],
        }),
      ),
    ).rejects.toBe(error);
    expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(1);
  });
});

describe('task abort boundaries', () => {
  const fatalErrors = [
    { className: EOneKeyErrorClassNames.IncorrectPassword },
    { className: EOneKeyErrorClassNames.WrongPassword },
    { className: EOneKeyErrorClassNames.PasswordPromptDialogCancel },
    { className: EOneKeyErrorClassNames.SecureQRCodeDialogCancel },
    { className: EOneKeyErrorClassNames.OneKeyAbortError },
    { className: EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable },
    { className: EOneKeyErrorClassNames.LocalDbOpenError },
    {
      className: EOneKeyErrorClassNames.OneKeyHardwareError,
      payload: { code: HardwareErrorCode.ActionCancelled },
    },
    {
      className: EOneKeyErrorClassNames.OneKeyHardwareError,
      payload: { code: HardwareErrorCode.WebDeviceNotFoundOrNeedsPermission },
    },
  ];

  it.each(['private', 'watching', 'hd'] as const)(
    'does not retry later items after a %s password, cancellation or device abort',
    async (target) => {
      for (const error of fatalErrors) {
        const { run, batch, serviceAccount: a } = setup();
        if (target === 'hd') batch.mockRejectedValueOnce(error);
        if (target === 'private')
          a.restoreImportedAccountByInput.mockImplementationOnce(
            async ({ onError }) => {
              onError({ stage: 'addImportedAccountWithCredential', error });
              return { addedAccounts: [] };
            },
          );
        if (target === 'watching')
          a.restoreWatchingAccountByInput.mockImplementationOnce(
            async ({ onError }) => {
              onError({ stage: 'addWatchingAccount', error });
              return { addedAccounts: [] };
            },
          );
        await expect(
          run(
            data({
              wallets:
                target === 'hd'
                  ? [selectedWallet('first'), selectedWallet('next')]
                  : [],
              importedAccounts:
                target === 'watching'
                  ? []
                  : [selectedAccount('first'), selectedAccount('next')],
              watchingAccounts: [
                selectedAccount('first-watch'),
                selectedAccount('next-watch'),
              ],
            }),
          ),
        ).rejects.toBe(error);
        if (target === 'hd') {
          expect(batch).toHaveBeenCalledTimes(1);
          expect(a.createHDWalletWithRevealableSeed).toHaveBeenCalledTimes(1);
          expect(a.restoreImportedAccountByInput).not.toHaveBeenCalled();
        }
        if (target === 'private') {
          expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(1);
        }
        if (target !== 'watching') {
          expect(a.restoreWatchingAccountByInput).not.toHaveBeenCalled();
        } else {
          expect(a.restoreWatchingAccountByInput).toHaveBeenCalledTimes(1);
        }
      }
    },
  );

  it('rejects an unprepared password before starting or creating any account', async () => {
    const { service, serviceAccount: a } = setup();
    await expect(
      service.startImport({
        taskUUID: await prepareTask(service),
        selectedTransferData: data({
          importedAccounts: [
            { id: 'missing', item: account('missing') },
            selectedAccount('valid'),
          ],
        }),
        password: '',
      }),
    ).rejects.toThrow('Password is required');
    expect(service.currentImportTaskUUID).toEqual(expect.any(String));
    expect(a.getPrivateKeyOfImportedAccountCredential).not.toHaveBeenCalled();
    expect(a.restoreImportedAccountByInput).not.toHaveBeenCalled();
  });

  it('collects failed HD networks and keeps subsequent indexes and accounts', async () => {
    const { run, batch, serviceAccount: a } = setup();
    batch.mockResolvedValueOnce({
      addedAccounts: [{ networkId: 'evm--1', deriveType: 'default' }],
      failedAccounts: [
        {
          networkId: 'btc--0',
          deriveType: 'BIP86',
          error: new OneKeyLocalError('synthetic invalid path'),
        },
      ],
    });
    const result = await run(
      data({
        wallets: [selectedWallet('hd')],
        importedAccounts: [selectedAccount('next')],
      }),
    );
    expect(batch).toHaveBeenCalledTimes(2);
    expect(batch).toHaveBeenCalledWith(
      expect.objectContaining({ autoHandleExitError: true }),
    );
    expect(result.errorsInfo).toEqual([
      expect.objectContaining({
        category: 'batchCreateHDAccountsForNetwork',
        networkInfo: 'btc--0',
      }),
    ]);
    expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'batchCreateHDAccountsForNetwork',
        networkId: 'btc--0',
        deriveType: 'BIP86',
        pathIndex: 0,
      }),
    );
    expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(1);
  });
});

describe('cloud restore password preparation', () => {
  it.each(['private', 'hd'] as const)(
    'requests a password once when the first %s credential is missing',
    async (target) => {
      const { service, serviceAccount: a } = setup();
      const selected = data({
        wallets:
          target === 'hd'
            ? [
                { id: 'missing-hd', item: wallet('missing-hd') },
                selectedWallet('valid-hd'),
              ]
            : [],
        importedAccounts:
          target === 'private'
            ? [
                { id: 'missing-private', item: account('missing-private') },
                selectedAccount('valid-private'),
              ]
            : [],
      });
      const promptPasswordVerify = jest.fn(async () => ({
        password: 'synthetic password',
      }));
      const cloud = new ServiceCloudBackupV2({
        backgroundApi: {
          servicePrimeTransfer: service,
          servicePassword: { promptPasswordVerify },
        },
      });
      jest.spyOn(cloud, 'restorePreparePrivateData').mockResolvedValue({
        wallets: {},
        importedAccounts: {},
        watchingAccounts: {},
        credentials: {},
      });
      jest
        .spyOn(service, 'getSelectedTransferData')
        .mockResolvedValue(selected);
      jest.spyOn(service, 'initImportProgress').mockResolvedValue();
      const startImport = jest.spyOn(service, 'startImport');
      const result = await cloud.restore({
        taskUUID: await prepareTask(service),
        payload: {
          appVersion: 'test',
          publicData: undefined,
          isEmptyData: false,
          isWatchingOnly: false,
          privateDataEncrypted: 'synthetic wrapped backup',
        },
        password: 'synthetic backup password',
      });
      expect(promptPasswordVerify).toHaveBeenCalledTimes(1);
      expect(startImport).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'synthetic password',
          localPassword: 'synthetic password',
        }),
      );
      expect(result.errorsInfo).toHaveLength(1);
      if (target === 'hd')
        expect(a.createHDWalletWithRevealableSeed).toHaveBeenCalledTimes(1);
      else expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(1);
    },
  );
});

describe('watching-only password preparation', () => {
  it.each(['', 'synthetic recipient password'])(
    'ignores unselected wrapped private credentials with password %j',
    async (password) => {
      const { service, serviceAccount: a } = setup();
      const result = await service.startImport({
        taskUUID: await prepareTask(service),
        selectedTransferData: data({
          watchingAccounts: [{ id: 'watching', item: account('watching') }],
        }),
        decryptedCredentialsHex: 'synthetic unselected private credentials',
        password,
        localPassword: password,
      });
      expect(result.errorsInfo).toEqual([]);
      expect(decryptStringAsync).not.toHaveBeenCalled();
      expect(a.restoreWatchingAccountByInput).toHaveBeenCalledTimes(1);
      expect(a.getPrivateKeyOfImportedAccountCredential).not.toHaveBeenCalled();
    },
  );

  it('still requires password preparation for selected wrapped private credentials', async () => {
    const { service } = setup();
    await expect(
      service.startImport({
        taskUUID: await prepareTask(service),
        selectedTransferData: data({
          importedAccounts: [{ id: 'private', item: account('private') }],
        }),
        decryptedCredentialsHex: 'synthetic selected private credentials',
        password: '',
      }),
    ).rejects.toThrow('Password is required');
    expect(service.currentImportTaskUUID).toEqual(expect.any(String));
  });
});

describe('exhausted restore candidates', () => {
  it('records one private-account failure when all candidates return empty without throwing', async () => {
    const { run, serviceAccount: a } = setup();
    a.restoreImportedAccountByInput
      .mockResolvedValueOnce({ addedAccounts: [] })
      .mockResolvedValueOnce({ addedAccounts: [] });
    const result = await run(
      data({
        importedAccounts: [
          selectedAccount('mismatch'),
          selectedAccount('next'),
        ],
      }),
    );
    expect(result.errorsInfo).toEqual([
      expect.objectContaining({
        accountId: 'mismatch',
        category: 'importPrivateKeyAccount',
        error: 'No matching account restored',
      }),
    ]);
    expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(3);
    expect(a.restoreImportedAccountByInput).toHaveBeenLastCalledWith(
      expect.objectContaining({
        importedAccount: expect.objectContaining({ id: 'next' }),
      }),
    );
    expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledTimes(1);
    expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'importPrivateKeyAccount',
        itemIndex: 0,
        error: 'No matching account restored',
      }),
    );
    const logged = JSON.stringify(
      jest.mocked(defaultLogger.prime.transfer.importError).mock.calls,
    );
    expect(logged).not.toContain('address-mismatch');
    expect(logged).not.toContain('synthetic key');
  });

  it('does not report a private candidate mismatch when a later fallback succeeds', async () => {
    const { run, serviceAccount: a } = setup();
    a.restoreImportedAccountByInput.mockResolvedValueOnce({
      addedAccounts: [],
    });
    const result = await run(
      data({ importedAccounts: [selectedAccount('fallback')] }),
    );
    expect(result.errorsInfo).toEqual([]);
    expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(2);
    expect(defaultLogger.prime.transfer.importError).not.toHaveBeenCalled();
  });

  it('records one watching-account failure after all input fallbacks are exhausted', async () => {
    const { run, serviceAccount: a } = setup();
    for (let i = 0; i < 4; i += 1) {
      a.restoreWatchingAccountByInput.mockResolvedValueOnce({
        addedAccounts: [],
      });
    }
    const result = await run(
      data({
        watchingAccounts: [
          selectedAccount('mismatch', {
            pub: 'synthetic pub',
            xpub: 'synthetic xpub',
            xpubSegwit: 'synthetic segwit xpub',
          }),
          selectedAccount('next'),
        ],
      }),
    );
    expect(result.errorsInfo).toEqual([
      expect.objectContaining({
        accountId: 'mismatch',
        category: 'importWatchingAccount',
        error: 'No matching account restored',
      }),
    ]);
    expect(a.restoreWatchingAccountByInput).toHaveBeenCalledTimes(5);
    expect(a.restoreWatchingAccountByInput).toHaveBeenLastCalledWith(
      expect.objectContaining({
        watchingAccount: expect.objectContaining({ id: 'next' }),
      }),
    );
    expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledTimes(1);
  });

  it('does not report a watching candidate mismatch when the address fallback succeeds', async () => {
    const { run, serviceAccount: a } = setup();
    a.restoreWatchingAccountByInput.mockResolvedValueOnce({
      addedAccounts: [],
    });
    const result = await run(
      data({
        watchingAccounts: [
          selectedAccount('fallback', { pub: 'synthetic pub' }),
        ],
      }),
    );
    expect(result.errorsInfo).toEqual([]);
    expect(a.restoreWatchingAccountByInput).toHaveBeenCalledTimes(2);
    expect(defaultLogger.prime.transfer.importError).not.toHaveBeenCalled();
  });
});

describe('per-item diagnostic deduplication', () => {
  it('keeps backup parameter preparation out of the active import diagnostics', async () => {
    const { service, run, serviceAccount: a } = setup();
    jest.spyOn(accountUtils, 'getHDAccountPathIndex').mockReturnValue(1);
    const failure = new Error('synthetic candidate failure');
    a.getAccountCreatedNetworkId.mockImplementation(
      async ({ account: item }) => {
        if (item.createAtNetwork === 'synthetic-export-network') {
          throw new OneKeyLocalError('synthetic backup parameter failure');
        }
        return item.createAtNetwork;
      },
    );
    a.restoreImportedAccountByInput.mockImplementation(async ({ onError }) => {
      onError({ stage: 'addImportedAccountWithCredential', error: failure });
      const exportErrors: Awaited<
        ReturnType<ServicePrimeTransfer['startImport']>
      >['errorsInfo'] = [];
      await service.buildHdWalletAccountsCreateParams({
        walletId: 'hd-export',
        taskUUID: undefined,
        errorsInfo: exportErrors,
        accounts: [
          {
            ...account('export', {
              createAtNetwork: 'synthetic-export-network',
            }),
            pathIndex: 1,
            indexedAccountId: undefined,
          },
        ],
      });
      expect(exportErrors).toHaveLength(1);
      onError({ stage: 'addImportedAccountWithCredential', error: failure });
      return { addedAccounts: [] };
    });
    const result = await run(
      data({ importedAccounts: [selectedAccount('failed')] }),
    );
    expect(result.errorsInfo).toHaveLength(1);
    expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledTimes(1);
    expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'addImportedAccountWithCredential',
        itemIndex: 0,
      }),
    );
  });

  it('does not log an HD parameter failure after its import task is cancelled', async () => {
    const { service, serviceAccount: a } = setup();
    const taskUUID = await prepareTask(service);
    a.getAccountCreatedNetworkId.mockImplementationOnce(async () => {
      service.currentImportTaskUUID = undefined;
      throw new OneKeyLocalError('synthetic late parameter failure');
    });
    await expect(
      service.buildHdWalletAccountsCreateParams({
        walletId: 'hd-cancelled',
        taskUUID,
        errorsInfo: [],
        accounts: [
          {
            ...account('cancelled'),
            pathIndex: 1,
            indexedAccountId: undefined,
          },
        ],
      }),
    ).rejects.toMatchObject({
      className: EOneKeyErrorClassNames.PrimeTransferImportCancelledError,
    });
    expect(defaultLogger.prime.transfer.importError).not.toHaveBeenCalled();
  });

  it('logs a reused error once per private account instead of suppressing later items', async () => {
    const { run, serviceAccount: a } = setup();
    const error = new OneKeyLocalError('Encrypted credential is required');
    a.getPrivateKeyOfImportedAccountCredential
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error);
    const result = await run(
      data({
        importedAccounts: [
          selectedAccount('first'),
          selectedAccount('second'),
          selectedAccount('after'),
        ],
      }),
    );
    expect(result.errorsInfo.map((item) => item.accountId)).toEqual([
      'first',
      'second',
    ]);
    expect(a.restoreImportedAccountByInput).toHaveBeenCalledTimes(1);
    const logs = jest.mocked(defaultLogger.prime.transfer.importError);
    expect(logs).toHaveBeenCalledTimes(2);
    for (const itemIndex of [0, 1]) {
      expect(logs).toHaveBeenNthCalledWith(
        itemIndex + 1,
        expect.objectContaining({
          stage: 'decryptImportedAccountCredential',
          itemIndex,
          error: 'Encrypted credential is required',
        }),
      );
    }
  });

  it('logs an HD fatal error only at its first failing operation before stopping', async () => {
    const { run, serviceAccount: a, batch } = setup();
    const error = {
      className: EOneKeyErrorClassNames.LocalDbOpenError,
      message: 'synthetic unavailable storage',
    };
    a.createHDWalletWithRevealableSeed.mockRejectedValueOnce(error);
    await expect(
      run(
        data({
          wallets: [selectedWallet('first'), selectedWallet('after')],
          importedAccounts: [selectedAccount('private')],
        }),
      ),
    ).rejects.toBe(error);
    expect(a.createHDWalletWithRevealableSeed).toHaveBeenCalledTimes(1);
    expect(batch).not.toHaveBeenCalled();
    expect(a.restoreImportedAccountByInput).not.toHaveBeenCalled();
    expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledTimes(1);
    expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'createHDWallet',
        itemIndex: 0,
        error: EOneKeyErrorClassNames.LocalDbOpenError,
      }),
    );
  });

  it('retains distinct candidate failures while avoiding their final item-log duplicate', async () => {
    const { run, serviceAccount: a } = setup();
    const failures = [
      new Error('first candidate'),
      new Error('second candidate'),
    ];
    for (const error of failures) {
      a.restoreImportedAccountByInput.mockImplementationOnce(
        async ({ onError }) => {
          onError({ stage: 'addImportedAccountWithCredential', error });
          return { addedAccounts: [] };
        },
      );
    }
    const result = await run(
      data({ importedAccounts: [selectedAccount('failed')] }),
    );
    expect(result.errorsInfo).toHaveLength(1);
    expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledTimes(2);
    for (const [params] of jest.mocked(defaultLogger.prime.transfer.importError)
      .mock.calls) {
      expect(params).toEqual(
        expect.objectContaining({
          stage: 'addImportedAccountWithCredential',
          itemIndex: 0,
        }),
      );
    }
  });
});
