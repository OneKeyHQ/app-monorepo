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

import ServicePrimeTransfer from './ServicePrimeTransfer';

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
  primeTransferAtom: { get: jest.fn(async () => ({})), set: jest.fn() },
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
  const batch = jest.fn(async () => undefined);
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
  const run = (
    selectedTransferData: IPrimeTransferSelectedData,
    isFromCloudBackupRestore = true,
  ) =>
    service.startImport({
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
      taskUUID: undefined,
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
          error: 'Encrypted credential is required',
        }),
      );
      expect(defaultLogger.prime.transfer.importError).toHaveBeenCalledWith(
        expect.objectContaining({
          itemIndex: 1,
          stage: 'importPrivateKeyAccount',
        }),
      );
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
      importProgress: { total: 2, current: 1, isImporting: true },
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
