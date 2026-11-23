import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';

import {
  getPublicAccountSnapshotId,
  publicAccountSnapshotToAccount,
} from '../publicAccountSnapshot';
import { publicAccountTestSnapshot } from '../publicAccountSnapshot.test-utils';

import { CloudSyncFlowManagerAccount } from './CloudSyncFlowManagerAccount';

import type {
  IDBCloudSyncItem,
  IDBUtxoAccount,
} from '../../../dbs/local/types';

describe('CloudSyncFlowManagerAccount', () => {
  const manager = new CloudSyncFlowManagerAccount({
    backgroundApi: {
      localDb: { getWalletSafe: jest.fn(async () => undefined) },
    } as any,
  });

  test('buildSyncPayload never leaks btc findAddresses (local-only field)', async () => {
    const account: Partial<IDBUtxoAccount> = {
      id: 'watching--0--bc1qxxx',
      name: 'Account #1',
      xpub: 'xpub-test',
      addresses: { '0/0': 'bc1q-main' },
      customAddresses: { '0/1': 'bc1q-custom' },
      findAddresses: { '0/100': 'bc1q-claimed' },
    };
    const payload = await manager.buildSyncPayload({
      target: {
        account,
      } as any,
    });

    expect(payload).toEqual({
      name: 'Account #1',
      accountId: 'watching--0--bc1qxxx',
    });
    expect(payload).not.toHaveProperty('findAddresses');
    expect(payload).not.toHaveProperty('customAddresses');
    expect(payload).not.toHaveProperty('addresses');
  });

  test('restore keeps public snapshots opaque and indexes legacy candidates by exact local account IDs', async () => {
    const snapshot = publicAccountTestSnapshot();
    const fixture = publicAccountSnapshotToAccount(snapshot, 'hd-1');
    const getAllAccounts = jest.fn(async () => ({
      accounts: [
        { ...fixture, id: 'watching--0--bc1qxxx', name: 'Watching fixture' },
        { ...fixture, id: 'imported--0--bc1qxxx', name: 'Imported fixture' },
        { ...fixture, id: 'watching--0--unrelated', name: 'Unrelated fixture' },
      ],
    }));
    const getSyncItemSafe = jest.fn(async () => undefined);
    const restoreManager = new CloudSyncFlowManagerAccount({
      backgroundApi: {
        serviceAccount: { getAllAccounts },
        localDb: { getSyncItemSafe },
      } as any,
    });
    const build = jest.spyOn(restoreManager, '_buildInitSyncDBItems');
    const makeCopy = (accountId: string): IDBCloudSyncItem => {
      const rawKey = `Account >> ${accountId}`;
      return {
        id: restoreManager.rawKeyToHashKey(rawKey),
        dataType: EPrimeCloudSyncDataType.Account,
        rawKey,
        rawData: '',
        data: 'old-ciphertext',
        dataTime: 100,
        isDeleted: false,
        pwdHash: 'hw-dek-old',
        localSceneUpdated: true,
        serverUploaded: true,
      };
    };
    const pub = makeCopy(getPublicAccountSnapshotId(snapshot));
    const legacy = makeCopy('watching--0--bc1qxxx');
    const imported = makeCopy('imported--0--bc1qxxx');
    const syncCredential = {
      primeAccountSalt: '',
      securityPasswordR1: '',
      masterPasswordUUID: '',
      keylessCredential: {
        keylessWalletId: 'test-hardware-source',
        signingPrivateKey: '',
        signingPublicKey: '',
        encryptionKey: '22'.repeat(32),
        pwdHash: 'hw-dek-new',
      },
    };
    await expect(
      restoreManager.buildHardwareRestoreLegacyAccountItems({
        items: [pub],
        syncCredential,
      }),
    ).resolves.toEqual([]);
    expect(getAllAccounts).not.toHaveBeenCalled();
    expect(build).not.toHaveBeenCalled();
    const replacements =
      await restoreManager.buildHardwareRestoreLegacyAccountItems({
        items: [pub, legacy, imported, { ...legacy, id: 'not-canonical' }],
        syncCredential,
      });
    expect(replacements.map((item) => item.id)).toEqual([
      legacy.id,
      imported.id,
    ]);
    for (const item of replacements) {
      expect(item.data).toBeTruthy();
      expect(item.rawData).toContain('fixture');
      expect(item.pwdHash).toBe(syncCredential.keylessCredential.pwdHash);
    }
    expect(getSyncItemSafe).toHaveBeenCalledTimes(2);
    expect(getAllAccounts).toHaveBeenCalledTimes(1);
    expect(getAllAccounts).toHaveBeenCalledWith({
      ids: ['watching--0--bc1qxxx', 'imported--0--bc1qxxx'],
    });
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredSyncItems: new Map([
          [legacy.id, legacy.rawKey],
          [imported.id, imported.rawKey],
        ]),
      }),
    );
  });

  test('isSupportSync excludes accounts without a matching public snapshot wallet', async () => {
    await expect(
      manager.isSupportSync({
        account: { id: "hd-1--m/84'/0'/0'" },
      } as any),
    ).resolves.toBe(false);

    await expect(
      manager.isSupportSync({
        account: { id: 'watching--0--bc1qxxx' },
      } as any),
    ).resolves.toBe(true);
  });
});
