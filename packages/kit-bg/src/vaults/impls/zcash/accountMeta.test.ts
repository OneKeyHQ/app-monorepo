import { ZCASH_ADDRESS_SCHEME_VERSION } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';

import { SimpleDbEntityPrivacyChainKeys } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainKeys';
import { SimpleDbEntityZcash } from '../../../dbs/simple/entity/SimpleDbEntityZcash';
import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';
import { getLocalWalletViewingKey } from '../../localWallet/viewingKeyStore';

import { resolveAndSaveZcashAccountMeta } from './accountMeta';
import { isZcashSetupIncompleteError } from './vaultUtils';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBAccount } from '../../../dbs/local/types';

const networkId = 'zec--0';

function withMemoryStorage<T extends object>(entity: T): T {
  let saved: unknown = null;
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
  };
  return entity;
}

function createContext() {
  const zcash = withMemoryStorage(new SimpleDbEntityZcash());
  const privacyChainKeys = withMemoryStorage(
    new SimpleDbEntityPrivacyChainKeys(),
  );
  const account = { id: 'synthetic-account', pathIndex: 0 } as IDBAccount;
  const getDBAccountSafe = jest.fn(
    async (): Promise<IDBAccount | undefined> => account,
  );
  const backgroundApi = {
    simpleDb: { zcash, privacyChainKeys },
    serviceAccount: { getDBAccountSafe },
  } as unknown as IBackgroundApi;
  const derived = {
    ufvk: 'synthetic-ufvk',
    unifiedAddress: 'synthetic-ua',
    transparentAddress: 'synthetic-transparent',
    seedFingerprintHex: '00',
    chainTip: 3_500_000,
  };
  const readKey = () =>
    getLocalWalletViewingKey({
      backgroundApi,
      networkId,
      accountId: account.id,
    });
  return { account, backgroundApi, zcash, derived, getDBAccountSafe, readKey };
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
        networkId,
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
        networkId,
        derive: async () => derived,
      }),
    ).rejects.toThrow('account removed during privacy setup');
    await expect(
      zcash.getAccountMeta({ accountId: account.id }),
    ).resolves.toBeUndefined();
  });

  it('persists a derivation when the account and captured enable intent still exist', async () => {
    const { account, backgroundApi, zcash, derived, readKey } = createContext();
    await zcash.beginPrivacyModeEnable({
      accountId: account.id,
      birthdayHeight: 3_000_000,
    });

    await resolveAndSaveZcashAccountMeta({
      account,
      backgroundApi,
      networkId,
      derive: async () => derived,
    });

    const vkFp = getViewingKeyFingerprint({
      networkId,
      viewingKey: derived.ufvk,
    });
    const meta = await zcash.getAccountMeta({ accountId: account.id });
    expect(meta).toMatchObject({
      vkFp,
      birthdayHeight: 3_000_000,
      addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
    });
    // One owner: the UFVK is only in the viewing key store.
    expect(JSON.stringify(await zcash.getRawData())).not.toContain(
      derived.ufvk,
    );
    await expect(readKey()).resolves.toEqual({ value: derived.ufvk, vkFp });
  });

  it('derives a missing key again and keeps the meta that names it', async () => {
    const { account, backgroundApi, zcash, derived, readKey } = createContext();
    await zcash.beginPrivacyModeEnable({
      accountId: account.id,
      birthdayHeight: 3_000_000,
    });
    await resolveAndSaveZcashAccountMeta({
      account,
      backgroundApi,
      networkId,
      derive: async () => derived,
    });
    const meta = await zcash.getAccountMeta({ accountId: account.id });
    await backgroundApi.simpleDb.privacyChainKeys.removeKeys({
      accountIds: [account.id],
    });

    const derive = jest.fn(async () => derived);
    await resolveAndSaveZcashAccountMeta({
      account,
      backgroundApi,
      networkId,
      derive,
    });

    expect(derive).toHaveBeenCalledTimes(1);
    await expect(readKey()).resolves.toMatchObject({ value: derived.ufvk });
    await expect(
      zcash.getAccountMeta({ accountId: account.id }),
    ).resolves.toEqual(meta);
  });

  it('stops with setup incomplete when a re-derived key differs from the stored identity', async () => {
    const { account, backgroundApi, zcash, derived, readKey } = createContext();
    await zcash.beginPrivacyModeEnable({
      accountId: account.id,
      birthdayHeight: 3_000_000,
    });
    await resolveAndSaveZcashAccountMeta({
      account,
      backgroundApi,
      networkId,
      derive: async () => derived,
    });
    const meta = await zcash.getAccountMeta({ accountId: account.id });
    await backgroundApi.simpleDb.privacyChainKeys.removeKeys({
      accountIds: [account.id],
    });

    const error = await resolveAndSaveZcashAccountMeta({
      account,
      backgroundApi,
      networkId,
      derive: async () => ({ ...derived, ufvk: 'another-ufvk' }),
    }).catch((e: unknown) => e);

    expect(isZcashSetupIncompleteError(error)).toBe(true);
    await expect(
      zcash.getAccountMeta({ accountId: account.id }),
    ).resolves.toEqual(meta);
    // The mismatched key is not adopted.
    await expect(readKey()).resolves.toBeUndefined();
  });

  it('stops with setup incomplete when the device returns a key other than the stored one', async () => {
    const { account, backgroundApi, zcash, derived, readKey } = createContext();
    await zcash.beginPrivacyModeEnable({
      accountId: account.id,
      birthdayHeight: 3_000_000,
    });
    // A key stored by an enable that stopped before its meta was written.
    await backgroundApi.simpleDb.privacyChainKeys.saveKey({
      accountId: account.id,
      record: {
        networkId,
        vkFp: getViewingKeyFingerprint({ networkId, viewingKey: 'first' }),
        sealed: { format: 'plain', value: 'first' },
      },
    });

    const error = await resolveAndSaveZcashAccountMeta({
      account,
      backgroundApi,
      networkId,
      derive: async () => derived,
    }).catch((e: unknown) => e);

    expect(isZcashSetupIncompleteError(error)).toBe(true);
    await expect(
      zcash.getAccountMeta({ accountId: account.id }),
    ).resolves.toBeUndefined();
    await expect(readKey()).resolves.toMatchObject({ value: 'first' });
  });
});
