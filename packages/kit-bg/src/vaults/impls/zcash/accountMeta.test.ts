import { SimpleDbEntityZcash } from '../../../dbs/simple/entity/SimpleDbEntityZcash';

import { resolveAndSaveZcashAccountMeta } from './accountMeta';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBAccount } from '../../../dbs/local/types';

function createContext() {
  let saved: unknown = null;
  const zcash = new SimpleDbEntityZcash();
  (zcash as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
  };
  const account = { id: 'synthetic-account', pathIndex: 0 } as IDBAccount;
  const getDBAccountSafe = jest.fn(
    async (): Promise<IDBAccount | undefined> => account,
  );
  const backgroundApi = {
    simpleDb: { zcash },
    serviceAccount: { getDBAccountSafe },
  } as unknown as IBackgroundApi;
  const derived = {
    ufvk: 'synthetic-ufvk',
    unifiedAddress: 'synthetic-ua',
    transparentAddress: 'synthetic-transparent',
    seedFingerprintHex: '00',
    chainTip: 3_500_000,
  };
  return { account, backgroundApi, zcash, derived, getDBAccountSafe };
}

describe('Zcash viewing metadata derivation lifecycle', () => {
  it('does not recreate state deleted while viewing-key derivation is pending', async () => {
    const { account, backgroundApi, zcash, derived } = createContext();
    await zcash.beginPrivacyModeEnable({
      accountId: account.id,
      birthdayHeight: 3_000_000,
    });

    await expect(
      resolveAndSaveZcashAccountMeta({
        account,
        backgroundApi,
        derive: async () => {
          await zcash.removeAccountState({ accountId: account.id });
          return derived;
        },
      }),
    ).rejects.toThrow('privacy state changed during setup');
    await expect(
      zcash.getAccountMeta({ accountId: account.id }),
    ).resolves.toBeUndefined();
    await expect(zcash.listCleanupAccountIds()).resolves.toEqual([]);
  });

  it('does not write metadata for a removed App account before GC runs', async () => {
    const { account, backgroundApi, zcash, derived, getDBAccountSafe } =
      createContext();
    await zcash.beginPrivacyModeEnable({
      accountId: account.id,
      birthdayHeight: 3_000_000,
    });
    getDBAccountSafe.mockResolvedValue(undefined);

    await expect(
      resolveAndSaveZcashAccountMeta({
        account,
        backgroundApi,
        derive: async () => derived,
      }),
    ).rejects.toThrow('account removed during privacy setup');
    await expect(
      zcash.getAccountMeta({ accountId: account.id }),
    ).resolves.toBeUndefined();
  });

  it('persists a derivation when the account and captured enable intent still exist', async () => {
    const { account, backgroundApi, zcash, derived } = createContext();
    await zcash.beginPrivacyModeEnable({
      accountId: account.id,
      birthdayHeight: 3_000_000,
    });

    await resolveAndSaveZcashAccountMeta({
      account,
      backgroundApi,
      derive: async () => derived,
    });

    await expect(
      zcash.getAccountMeta({ accountId: account.id }),
    ).resolves.toMatchObject({
      ufvk: derived.ufvk,
      birthdayHeight: 3_000_000,
    });
  });
});
