import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPrimeTransferAccount } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { EDBAccountType } from '../../dbs/local/consts';

import ServiceAccount from './ServiceAccount';

import type { IDBAccount } from '../../dbs/local/types';
import type { IAccountDeriveTypes } from '../../vaults/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const passthrough =
    () =>
    (...args: unknown[]) =>
      args.length === 1 ? args[0] : args[2];
  return {
    backgroundClass: passthrough,
    backgroundMethod: passthrough,
    backgroundMethodForDev: passthrough,
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

const account: IPrimeTransferAccount = {
  id: 'synthetic-account',
  name: 'synthetic account',
  address: '',
  version: 1,
  type: EDBAccountType.SIMPLE,
  createAtNetwork: 'evm--1',
  impl: 'evm',
  coinType: '60',
  template: undefined,
  path: undefined,
  networks: undefined,
  accountOrder: undefined,
  accountOrderSaved: undefined,
  pub: undefined,
  xpub: undefined,
  xpubSegwit: undefined,
};
const restoredAccount: IDBAccount = {
  id: 'restored-account',
  name: 'restored account',
  address: 'synthetic address',
  pub: 'synthetic pub',
  addresses: {},
  type: EDBAccountType.SIMPLE,
  path: '',
  coinType: '60',
  impl: 'evm',
};

function setup(kind: 'private' | 'watching') {
  const addAccount = jest.fn(async () => ({ accounts: [restoredAccount] }));
  const deriveTypes = jest.fn(
    async (): Promise<IAccountDeriveTypes[]> => ['default'],
  );
  const service = new ServiceAccount({
    backgroundApi: {
      serviceAccount: {
        addImportedAccountWithCredentialBase: addAccount,
        addWatchingAccount: addAccount,
      },
      serviceNetwork: {
        getAccountImportingDeriveTypes: deriveTypes,
        getDeriveTypeByAddress: jest.fn(async () => 'default'),
      },
      servicePassword: {
        encodeSensitiveText: jest.fn(async () => 'synthetic encoded input'),
      },
      servicePrimeTransfer: {
        recordImportBatchCreateTrace: jest.fn(async () => undefined),
      },
    },
  });
  const onError = jest.fn<void, [{ stage: string; error: unknown }]>();
  const run = () =>
    kind === 'private'
      ? service.restoreImportedAccountByInput({
          importedAccount: account,
          input: 'synthetic input',
          privateKey: 'synthetic key',
          networkId: 'evm--1',
          onError,
        })
      : service.restoreWatchingAccountByInput({
          watchingAccount: account,
          input: 'synthetic input',
          networkId: 'evm--1',
          onError,
        });
  return { run, addAccount, deriveTypes, onError };
}

for (const kind of ['private', 'watching'] as const) {
  describe(`${kind} restore error propagation`, () => {
    it('reports a failed DB insertion through the caller error callback', async () => {
      const { run, addAccount, onError } = setup(kind);
      const error = new OneKeyLocalError('synthetic rejected account');
      addAccount.mockRejectedValueOnce(error);
      await expect(run()).resolves.toEqual({ addedAccounts: [] });
      expect(onError).toHaveBeenCalledWith({
        stage:
          kind === 'private'
            ? 'addImportedAccountWithCredential'
            : 'addWatchingAccount',
        error,
      });
    });

    it('preserves a successful alternative derivation and reports the failed attempt', async () => {
      const { run, addAccount, deriveTypes, onError } = setup(kind);
      deriveTypes.mockResolvedValueOnce(['BIP44', 'BIP84']);
      addAccount.mockRejectedValueOnce(new Error('unsupported derivation'));
      await expect(run()).resolves.toEqual({
        addedAccounts: [restoredAccount],
      });
      expect(addAccount).toHaveBeenCalledTimes(2);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('keeps an intentional empty result without an exception as a no-op', async () => {
      const { run, addAccount, onError } = setup(kind);
      addAccount.mockResolvedValueOnce({ accounts: [] });
      await expect(run()).resolves.toEqual({ addedAccounts: [] });
      expect(onError).not.toHaveBeenCalled();
    });

    it('does not swallow cancellation rethrown by the caller error policy', async () => {
      const { run, addAccount, deriveTypes, onError } = setup(kind);
      const cancellation = new Error('synthetic cancellation');
      deriveTypes.mockResolvedValueOnce(['BIP44', 'BIP84']);
      addAccount.mockRejectedValueOnce(cancellation);
      onError.mockImplementationOnce(({ error }) => {
        throw error;
      });
      await expect(run()).rejects.toBe(cancellation);
      expect(addAccount).toHaveBeenCalledTimes(1);
    });

    it('reports a failed derivation lookup while allowing the default fallback', async () => {
      const { run, deriveTypes, onError } = setup(kind);
      const error = new Error('synthetic lookup failure');
      deriveTypes.mockRejectedValueOnce(error);
      await expect(run()).resolves.toEqual({
        addedAccounts: [restoredAccount],
      });
      expect(onError).toHaveBeenCalledWith({
        stage: 'resolveRestoreDeriveTypesByInput',
        error,
      });
    });
  });
}
